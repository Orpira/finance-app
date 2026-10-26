import { db } from '../database/db'
import type { EarningPeriod } from '../types/earningPeriod'
import type { SeasonStay } from '../types/seasonStay'
import type { TravelDestination } from '../types/travelDestination'
import {
  assertStayBelongsToSeason,
  SeasonGeoDomainError,
  validateTravelDestination,
} from '../utils/seasonGeoValidation'

export type GeographicRecordKind = 'income' | 'expense' | 'appointment'

export interface CreateRecordGeographyInput {
  seasonStayId?: number | null
  travelDestination?: TravelDestination | null
}

export interface UpdateRecordGeographyInput {
  /** Omitir conserva la asociación; null la elimina. */
  seasonStayId?: number | null
  /** Omitir conserva el destino; null lo elimina. */
  travelDestination?: TravelDestination | null
  /** Copia ciudad y país de la estancia de forma explícita. */
  syncLocationFromStay?: boolean
  /** Edición manual explícita de la instantánea; undefined la conserva. */
  city?: string
  country?: string
}

export interface RecordGeographyReadModel {
  seasonStay?: SeasonStay
  season?: EarningPeriod
  historicalLocation: { city?: string; country?: string }
  travelDestination?: TravelDestination
  hasOrphanedStayReference: boolean
}

interface ResolveGeographyOptions {
  kind: GeographicRecordKind
  usageMode: 'basic' | 'professional'
  earningPeriodId?: number
  temporalValue: string
}

function civilDateAt(instant: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant))
}

export function getStayRecordDisabledReason(
  stay: SeasonStay,
  kind: GeographicRecordKind,
  temporalValue?: string,
): 'not_started' | 'cancelled' | 'outside_interval' | undefined {
  if (stay.status === 'cancelled') {
    return 'cancelled'
  }

  if (stay.status === 'planned') {
    if (kind !== 'appointment') return 'not_started'
    if (!temporalValue) return undefined
    const appointmentDate = temporalValue.slice(0, 10)
    if ((stay.plannedStartDate && appointmentDate < stay.plannedStartDate) ||
      (stay.plannedEndDate && appointmentDate > stay.plannedEndDate)) {
      return 'outside_interval'
    }
    return undefined
  }

  if (!stay.actualStartAt) return 'not_started'
  if (!temporalValue) return undefined

  if (kind === 'appointment') {
    const recordTime = Date.parse(temporalValue)
    if (Number.isNaN(recordTime) || recordTime < Date.parse(stay.actualStartAt) ||
      (stay.actualEndAt && recordTime >= Date.parse(stay.actualEndAt))) {
      return 'outside_interval'
    }
    return undefined
  }

  const timeZone = stay.timeZone ?? 'UTC'
  const startDate = civilDateAt(stay.actualStartAt, timeZone)
  const endDate = stay.actualEndAt ? civilDateAt(stay.actualEndAt, timeZone) : undefined
  if (temporalValue < startDate || (endDate && temporalValue > endDate)) {
    return 'outside_interval'
  }
  return undefined
}

function assertRecordFallsInsideStay(
  stay: SeasonStay,
  kind: GeographicRecordKind,
  temporalValue: string,
) {
  const reason = getStayRecordDisabledReason(stay, kind, temporalValue)
  if (reason === 'cancelled') {
    throw new SeasonGeoDomainError('STAY_STATUS_INVALID', 'La estancia seleccionada está cancelada.')
  }
  if (reason === 'not_started') {
    throw new SeasonGeoDomainError('STAY_NOT_STARTED', 'La estancia seleccionada todavía no ha comenzado.')
  }
  if (reason === 'outside_interval') {
    throw new SeasonGeoDomainError('RECORD_OUTSIDE_STAY_INTERVAL', 'El registro queda fuera del intervalo de la estancia.')
  }
}

async function requireSelectableStay(
  seasonStayId: number,
  options: ResolveGeographyOptions,
) {
  if (options.usageMode !== 'professional') {
    throw new SeasonGeoDomainError('RECORD_STAY_MISMATCH', 'Los registros personales no pueden asociarse a estancias.')
  }
  if (!options.earningPeriodId) {
    throw new SeasonGeoDomainError('RECORD_SEASON_MISMATCH', 'El registro debe pertenecer a una temporada.')
  }
  const [season, stay] = await Promise.all([
    db.earningPeriods.get(options.earningPeriodId),
    db.seasonStays.get(seasonStayId),
  ])
  if (!season) throw new SeasonGeoDomainError('SEASON_NOT_FOUND', 'La temporada del registro no existe.')
  if (!stay) throw new SeasonGeoDomainError('STAY_NOT_FOUND', 'La estancia seleccionada no existe.')
  assertStayBelongsToSeason(stay, season)
  assertRecordFallsInsideStay(stay, options.kind, options.temporalValue)
  return stay
}

export async function resolveCreateRecordGeography(
  input: CreateRecordGeographyInput,
  options: ResolveGeographyOptions,
) {
  const travelDestination = validateTravelDestination(input.travelDestination)
  const seasonStayId = input.seasonStayId ?? undefined
  if (seasonStayId === undefined) return { seasonStayId, travelDestination }
  const stay = await requireSelectableStay(seasonStayId, options)
  return {
    seasonStayId,
    travelDestination,
    city: stay.city,
    country: stay.countryCode,
  }
}

export async function resolveUpdateRecordGeography(
  existing: {
    seasonStayId?: number
    travelDestination?: TravelDestination
    city?: string
    country?: string
  },
  updates: UpdateRecordGeographyInput,
  options: ResolveGeographyOptions,
) {
  const requestedStayId = updates.seasonStayId === null
    ? undefined
    : updates.seasonStayId ?? existing.seasonStayId
  const travelDestination = updates.travelDestination === null
    ? undefined
    : updates.travelDestination === undefined
      ? existing.travelDestination
      : validateTravelDestination(updates.travelDestination)
  const stay = requestedStayId === undefined
    ? undefined
    : await requireSelectableStay(requestedStayId, options)

  if (updates.syncLocationFromStay && !stay) {
    throw new SeasonGeoDomainError('RECORD_STAY_MISMATCH', 'No hay una estancia desde la que sincronizar la ubicación.')
  }

  return {
    seasonStayId: requestedStayId,
    travelDestination,
    city: updates.syncLocationFromStay ? stay?.city : updates.city ?? existing.city,
    country: updates.syncLocationFromStay ? stay?.countryCode : updates.country ?? existing.country,
  }
}

export async function getRecordGeographyReadModel(record: {
  earningPeriodId?: number
  seasonPeriodId?: number
  seasonStayId?: number
  travelDestination?: TravelDestination
  city?: string
  country?: string
}): Promise<RecordGeographyReadModel> {
  const earningPeriodId = record.earningPeriodId ?? record.seasonPeriodId
  const [season, seasonStay] = await Promise.all([
    earningPeriodId ? db.earningPeriods.get(earningPeriodId) : undefined,
    record.seasonStayId ? db.seasonStays.get(record.seasonStayId) : undefined,
  ])
  return {
    season,
    seasonStay,
    historicalLocation: { city: record.city, country: record.country },
    travelDestination: record.travelDestination,
    hasOrphanedStayReference: record.seasonStayId !== undefined && !seasonStay,
  }
}
