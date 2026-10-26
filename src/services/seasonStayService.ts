import { db } from '../database/db'
import type { SeasonStay, SelectableSeasonStay } from '../types/seasonStay'
import { normalizeCityName } from '../utils/cityNormalization'
import { isReported } from '../catalogs/reportStatuses'
import { getStayRecordDisabledReason } from './recordGeographyService'
import {
  assertNoConfirmedStayOverlaps,
  assertStayBelongsToSeason,
  isIsoInstant,
  isLocalDate,
  SeasonGeoDomainError,
  validateSeasonStayShape,
} from '../utils/seasonGeoValidation'

export interface CreatePlannedStayInput {
  earningPeriodId: number
  city: string
  plannedStartDate?: string
  plannedEndDate?: string
}

export interface SwitchActiveStayInput {
  earningPeriodId: number
  next: { kind: 'existing'; seasonStayId: number } | { kind: 'new'; city: string }
  effectiveAt: string
  timeZone: string
}

export interface CorrectStayInput {
  seasonStayId: number
  changes: Partial<Pick<SeasonStay, 'city' | 'plannedStartDate' | 'plannedEndDate' | 'actualStartAt' | 'actualEndAt' | 'timeZone'>>
  reason: string
}

function cleanCity(city: string) {
  const value = city.trim().replace(/\s+/g, ' ')
  if (!normalizeCityName(value)) throw new SeasonGeoDomainError('STAY_STATUS_INVALID', 'Indica una ciudad válida.')
  return value
}

function civilDateAt(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function assertActualDateInsideSeason(value: string, timeZone: string, startDate: string, endDate?: string) {
  const civilDate = civilDateAt(value, timeZone)
  if (civilDate < startDate.slice(0, 10) || (endDate && civilDate > endDate.slice(0, 10))) {
    throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'La estancia queda fuera de la temporada.')
  }
}

async function requireSeason(id: number) {
  const season = await db.earningPeriods.get(id)
  if (!season) throw new SeasonGeoDomainError('SEASON_NOT_FOUND', 'La temporada no existe.')
  if (season.status !== 'active') throw new SeasonGeoDomainError('SEASON_CLOSED', 'La temporada está cerrada.')
  if (!season.countryCode) throw new SeasonGeoDomainError('STAY_COUNTRY_MISMATCH', 'La temporada no tiene país definido.')
  return season
}

async function nextPosition(earningPeriodId: number) {
  const stays = await db.seasonStays.where('earningPeriodId').equals(earningPeriodId).toArray()
  return stays.reduce((maximum, stay) => Math.max(maximum, stay.position), -1) + 1
}

export async function listSeasonStays(earningPeriodId: number) {
  const stays = await db.seasonStays.where('earningPeriodId').equals(earningPeriodId).toArray()
  return stays.sort((left, right) => {
    const leftKey = left.actualStartAt ?? left.plannedStartDate ?? `9999-${String(left.position).padStart(8, '0')}`
    const rightKey = right.actualStartAt ?? right.plannedStartDate ?? `9999-${String(right.position).padStart(8, '0')}`
    return leftKey.localeCompare(rightKey) || left.position - right.position
  })
}

export function getSeasonStayById(id: number) {
  return db.seasonStays.get(id)
}

export async function getActiveSeasonStay(earningPeriodId: number) {
  const active = await db.seasonStays.where('[earningPeriodId+status]').equals([earningPeriodId, 'active']).toArray()
  if (active.length > 1) throw new SeasonGeoDomainError('ACTIVE_STAY_ALREADY_EXISTS', 'La temporada tiene varias estancias activas.')
  return active[0]
}

export async function createPlannedSeasonStay(input: CreatePlannedStayInput, now = new Date()) {
  return db.transaction('rw', [db.earningPeriods, db.seasonStays], async () => {
    const season = await requireSeason(input.earningPeriodId)
    if (input.plannedStartDate && !isLocalDate(input.plannedStartDate)) throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'La fecha prevista no es válida.')
    if (input.plannedEndDate && !isLocalDate(input.plannedEndDate)) throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'La fecha prevista no es válida.')
    const seasonStart = season.startDate.slice(0, 10)
    const seasonEnd = season.plannedEndDate?.slice(0, 10)
    if ((input.plannedStartDate && input.plannedStartDate < seasonStart) ||
      (seasonEnd && input.plannedEndDate && input.plannedEndDate > seasonEnd)) {
      throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'La estancia prevista queda fuera de la temporada.')
    }
    const city = cleanCity(input.city)
    const timestamp = now.toISOString()
    const stay: SeasonStay = {
      earningPeriodId: input.earningPeriodId,
      position: await nextPosition(input.earningPeriodId),
      city,
      cityNormalized: normalizeCityName(city),
      countryCode: season.countryCode!,
      status: 'planned',
      plannedStartDate: input.plannedStartDate,
      plannedEndDate: input.plannedEndDate,
      locationSource: 'manual',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    validateSeasonStayShape(stay)
    const id = await db.seasonStays.add(stay)
    return { ...stay, id }
  })
}

export async function switchActiveSeasonStay(input: SwitchActiveStayInput, now = new Date()) {
  if (!isIsoInstant(input.effectiveAt) || Date.parse(input.effectiveAt) > now.getTime()) {
    throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'El instante efectivo no es válido.')
  }
  return db.transaction('rw', [db.earningPeriods, db.seasonStays], async () => {
    const season = await requireSeason(input.earningPeriodId)
    assertActualDateInsideSeason(input.effectiveAt, input.timeZone, season.startDate, season.endDate)
    const stays = await db.seasonStays.where('earningPeriodId').equals(input.earningPeriodId).toArray()
    const active = stays.find((stay) => stay.status === 'active')
    let next: SeasonStay
    if (input.next.kind === 'existing') {
      const seasonStayId = input.next.seasonStayId
      const found = stays.find((stay) => stay.id === seasonStayId)
      if (!found) throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia no existe.')
      if (found.status !== 'planned') throw new SeasonGeoDomainError('STAY_STATUS_INVALID', 'Solo puede activarse una estancia prevista.')
      next = found
    } else {
      const city = cleanCity(input.next.city)
      const timestamp = now.toISOString()
      next = {
        earningPeriodId: input.earningPeriodId,
        position: await nextPosition(input.earningPeriodId),
        city,
        cityNormalized: normalizeCityName(city),
        countryCode: season.countryCode!,
        status: 'planned',
        locationSource: 'manual',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      next.id = await db.seasonStays.add(next)
    }
    const timestamp = now.toISOString()
    const completedStay = active ? {
      ...active,
      status: 'completed' as const,
      actualEndAt: input.effectiveAt,
      completedAt: timestamp,
      updatedAt: timestamp,
    } : undefined
    const activeStay: SeasonStay = {
      ...next,
      status: 'active',
      actualStartAt: input.effectiveAt,
      actualEndAt: undefined,
      timeZone: input.timeZone,
      updatedAt: timestamp,
    }
    const candidate = stays
      .filter((stay) => stay.id !== active?.id && stay.id !== next.id)
      .concat(completedStay ? [completedStay] : [], activeStay)
    candidate.forEach(validateSeasonStayShape)
    candidate.forEach((stay) => assertStayBelongsToSeason(stay, season))
    assertNoConfirmedStayOverlaps(candidate)
    if (completedStay) await db.seasonStays.put(completedStay)
    await db.seasonStays.put(activeStay)
    return { completedStay, activeStay }
  })
}

export async function completeSeasonStay(id: number, effectiveAt: string, timeZone: string, now = new Date()) {
  return db.transaction('rw', [db.earningPeriods, db.seasonStays], async () => {
    const stay = await db.seasonStays.get(id)
    if (!stay) throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia no existe.')
    const season = await requireSeason(stay.earningPeriodId)
    if (stay.status !== 'active') throw new SeasonGeoDomainError('STAY_STATUS_INVALID', 'La estancia no está activa.')
    if (!isIsoInstant(effectiveAt) || Date.parse(effectiveAt) > now.getTime()) throw new SeasonGeoDomainError('STAY_DATE_INVALID', 'El fin real no es válido.')
    assertActualDateInsideSeason(effectiveAt, timeZone, season.startDate, season.endDate)
    const timestamp = now.toISOString()
    const completed: SeasonStay = { ...stay, status: 'completed', actualEndAt: effectiveAt, timeZone, completedAt: timestamp, updatedAt: timestamp }
    validateSeasonStayShape(completed)
    const others = (await db.seasonStays.where('earningPeriodId').equals(stay.earningPeriodId).toArray()).filter((item) => item.id !== id)
    assertNoConfirmedStayOverlaps([...others, completed])
    await db.seasonStays.put(completed)
    return completed
  })
}

export async function correctSeasonStay(input: CorrectStayInput, now = new Date()) {
  if (!input.reason.trim()) throw new SeasonGeoDomainError('CORRECTION_REASON_REQUIRED', 'La corrección requiere un motivo.')
  return db.transaction('rw', [db.earningPeriods, db.seasonStays, db.seasonRevisions, db.services, db.expenses, db.appointments], async () => {
    const stay = await db.seasonStays.get(input.seasonStayId)
    if (!stay) throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia no existe.')
    const season = await requireSeason(stay.earningPeriodId)
    const linkedRecords = await Promise.all([
      db.services.where('seasonStayId').equals(input.seasonStayId).toArray(),
      db.expenses.where('seasonStayId').equals(input.seasonStayId).toArray(),
      db.appointments.where('seasonStayId').equals(input.seasonStayId).toArray(),
    ])
    if (linkedRecords.flat().some(isReported)) {
      throw new SeasonGeoDomainError('STAY_HAS_LINKED_RECORDS', 'Una estancia con registros reportados no puede corregirse.')
    }
    const city = input.changes.city === undefined ? stay.city : cleanCity(input.changes.city)
    const updated: SeasonStay = { ...stay, ...input.changes, city, cityNormalized: normalizeCityName(city), countryCode: stay.countryCode, updatedAt: now.toISOString() }
    validateSeasonStayShape(updated)
    assertStayBelongsToSeason(updated, season)
    const others = (await db.seasonStays.where('earningPeriodId').equals(stay.earningPeriodId).toArray()).filter((item) => item.id !== stay.id)
    assertNoConfirmedStayOverlaps([...others, updated])
    const revisions = await db.seasonRevisions.where('earningPeriodId').equals(stay.earningPeriodId).toArray()
    await db.seasonRevisions.add({
      earningPeriodId: stay.earningPeriodId,
      sequence: revisions.reduce((maximum, revision) => Math.max(maximum, revision.sequence), 0) + 1,
      kind: 'season_stay_corrected',
      source: 'user_correction',
      seasonStayId: stay.id!,
      previousValue: stay,
      nextValue: updated,
      reason: input.reason.trim(),
      recordedAt: now.toISOString(),
    })
    await db.seasonStays.put(updated)
    return updated
  })
}

export async function cancelPlannedSeasonStay(
  id: number,
  reason: string,
  options: { detachLinkedAppointments?: boolean } = {},
  now = new Date(),
) {
  if (!reason.trim()) throw new SeasonGeoDomainError('CORRECTION_REASON_REQUIRED', 'La cancelación requiere un motivo.')
  return db.transaction('rw', [db.earningPeriods, db.seasonStays, db.services, db.expenses, db.appointments], async () => {
    const stay = await db.seasonStays.get(id)
    if (!stay) throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia no existe.')
    await requireSeason(stay.earningPeriodId)
    if (stay.status !== 'planned' || stay.actualStartAt || stay.actualEndAt) {
      throw new SeasonGeoDomainError('STAY_STARTED_CANNOT_CANCEL', 'Una estancia iniciada no puede cancelarse.')
    }
    const appointments = await db.appointments.where('seasonStayId').equals(id).toArray()
    const [services, expenses] = await Promise.all([
      db.services.where('seasonStayId').equals(id).toArray(),
      db.expenses.where('seasonStayId').equals(id).toArray(),
    ])
    if (services.length || expenses.length) {
      throw new SeasonGeoDomainError('STAY_HAS_LINKED_RECORDS', 'La estancia tiene movimientos financieros vinculados.')
    }
    if (appointments.length && !options.detachLinkedAppointments) {
      throw new SeasonGeoDomainError('STAY_HAS_LINKED_RECORDS', 'La estancia tiene citas vinculadas.')
    }
    for (const appointment of appointments) {
      if (isReported(appointment)) {
        throw new SeasonGeoDomainError('STAY_HAS_LINKED_RECORDS', 'Una cita reportada impide cancelar la estancia.')
      }
    }
    if (appointments.length) {
      await db.appointments.bulkPut(appointments.map((appointment) => ({
        ...appointment,
        seasonStayId: undefined,
      })))
    }
    const timestamp = now.toISOString()
    const cancelled: SeasonStay = {
      ...stay,
      status: 'cancelled',
      cancelledAt: timestamp,
      cancellationReasonCode: 'user_cancelled',
      cancellationReason: reason.trim(),
      updatedAt: timestamp,
    }
    validateSeasonStayShape(cancelled)
    await db.seasonStays.put(cancelled)
    return { stay: cancelled, detachedAppointmentIds: appointments.flatMap((appointment) => appointment.id ? [appointment.id] : []) }
  })
}

export async function reorderSeasonStays(earningPeriodId: number, orderedStayIds: number[], now = new Date()) {
  return db.transaction('rw', [db.earningPeriods, db.seasonStays], async () => {
    await requireSeason(earningPeriodId)
    const stays = await db.seasonStays.where('earningPeriodId').equals(earningPeriodId).toArray()
    const currentIds = stays.map((stay) => stay.id).filter((id): id is number => id !== undefined).sort((a, b) => a - b)
    const requestedIds = [...orderedStayIds].sort((a, b) => a - b)
    if (new Set(orderedStayIds).size !== orderedStayIds.length ||
      currentIds.length !== requestedIds.length || currentIds.some((id, index) => id !== requestedIds[index])) {
      throw new SeasonGeoDomainError('STAY_STATUS_INVALID', 'El itinerario debe incluir cada estancia exactamente una vez.')
    }
    const positionById = new Map(orderedStayIds.map((id, position) => [id, position]))
    const timestamp = now.toISOString()
    const reordered = stays.map((stay) => ({
      ...stay,
      position: positionById.get(stay.id!)!,
      updatedAt: timestamp,
    }))
    await db.seasonStays.bulkPut(stays.map((stay, index) => ({
      ...stay,
      position: -(index + 1),
      updatedAt: timestamp,
    })))
    await db.seasonStays.bulkPut(reordered)
    return reordered.sort((left, right) => left.position - right.position)
  })
}

export async function listSelectableSeasonStays(input: {
  earningPeriodId: number
  recordKind: 'income' | 'expense' | 'appointment'
  currentSeasonStayId?: number
  /** Fecha civil para movimientos o instante ISO para citas. Si se omite, solo valida estado. */
  temporalValue?: string
}) : Promise<SelectableSeasonStay[]> {
  const stays = await listSeasonStays(input.earningPeriodId)
  const visitCounts = new Map<string, number>()
  return stays.map((stay) => {
    const count = stay.status === 'cancelled' ? (visitCounts.get(stay.cityNormalized) ?? 0) : (visitCounts.get(stay.cityNormalized) ?? 0) + 1
    if (stay.status !== 'cancelled') visitCounts.set(stay.cityNormalized, count)
    const disabledReason = getStayRecordDisabledReason(stay, input.recordKind, input.temporalValue)
    const selectable = disabledReason === undefined
    const selected = stay.id === input.currentSeasonStayId
    const range = stay.plannedStartDate && stay.plannedEndDate ? ` · ${stay.plannedStartDate}–${stay.plannedEndDate}` : ''
    return {
      stay, id: stay.id!, earningPeriodId: stay.earningPeriodId, status: stay.status, city: stay.city,
      visitNumber: count, label: `${stay.city} · ${count}.ª visita${range}`, selectable, selected,
      disabledReason,
    }
  })
}
