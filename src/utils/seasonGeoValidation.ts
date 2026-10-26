import type { Appointment } from '../types/appointment'
import type { EarningPeriod } from '../types/earningPeriod'
import type { Expense } from '../types/expense'
import type { SeasonRevision } from '../types/seasonRevision'
import type { SeasonStay } from '../types/seasonStay'
import type { ServiceIncome } from '../types/service'
import type { TravelDestination } from '../types/travelDestination'
import { normalizeCityName } from './cityNormalization'
import { countries } from './countries'
import { resolveRecordUsageMode } from './usageMode'

export type SeasonGeoErrorCode =
  | 'SEASON_NOT_FOUND'
  | 'SEASON_CLOSED'
  | 'STAY_NOT_FOUND'
  | 'STAY_SEASON_MISMATCH'
  | 'STAY_COUNTRY_MISMATCH'
  | 'STAY_STATUS_INVALID'
  | 'STAY_DATE_INVALID'
  | 'STAY_OVERLAP'
  | 'ACTIVE_STAY_ALREADY_EXISTS'
  | 'STAY_STARTED_CANNOT_CANCEL'
  | 'STAY_HAS_LINKED_RECORDS'
  | 'STAY_NOT_STARTED'
  | 'CORRECTION_REASON_REQUIRED'
  | 'RECORD_SEASON_MISMATCH'
  | 'RECORD_STAY_MISMATCH'
  | 'RECORD_OUTSIDE_STAY_INTERVAL'
  | 'TRAVEL_DESTINATION_INVALID'
  | 'REVISION_INVALID'
  | 'BACKUP_SEASON_GEO_INVALID'

export class SeasonGeoDomainError extends Error {
  readonly code: SeasonGeoErrorCode

  constructor(code: SeasonGeoErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = 'SeasonGeoDomainError'
  }
}

function fail(code: SeasonGeoErrorCode, message: string): never {
  throw new SeasonGeoDomainError(code, message)
}

export function isLocalDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
}

export function isIsoInstant(value: string): boolean {
  return !Number.isNaN(Date.parse(value))
}

export function validateTravelDestination(
  destination?: TravelDestination | null,
): TravelDestination | undefined {
  if (destination == null) return undefined
  const label = destination.label.trim().replace(/\s+/g, ' ')
  if (!label || destination.source !== 'manual' ||
    (destination.kind !== 'city' && destination.kind !== 'place') ||
    (destination.countryCode !== undefined &&
      !countries.some((country) => country.value === destination.countryCode))) {
    fail('TRAVEL_DESTINATION_INVALID', 'El destino de desplazamiento no es válido.')
  }
  const city = destination.city?.trim().replace(/\s+/g, ' ') || undefined
  return {
    ...destination,
    label,
    city,
    cityNormalized: city ? normalizeCityName(city) : undefined,
  }
}

export function validateSeasonStayShape(stay: SeasonStay): void {
  if (!Number.isInteger(stay.earningPeriodId) || stay.earningPeriodId <= 0) {
    fail('STAY_SEASON_MISMATCH', 'La estancia no tiene una temporada válida.')
  }
  if (!Number.isInteger(stay.position) || stay.position < 0) {
    fail('STAY_STATUS_INVALID', 'La posición de la estancia no es válida.')
  }
  if (!stay.city.trim() || stay.cityNormalized !== normalizeCityName(stay.city)) {
    fail('STAY_STATUS_INVALID', 'La ciudad de la estancia no es válida.')
  }
  if (stay.plannedStartDate && !isLocalDate(stay.plannedStartDate)) {
    fail('STAY_DATE_INVALID', 'La fecha prevista de inicio no es válida.')
  }
  if (stay.plannedEndDate && !isLocalDate(stay.plannedEndDate)) {
    fail('STAY_DATE_INVALID', 'La fecha prevista de fin no es válida.')
  }
  if (stay.plannedStartDate && stay.plannedEndDate && stay.plannedEndDate < stay.plannedStartDate) {
    fail('STAY_DATE_INVALID', 'La estancia prevista termina antes de empezar.')
  }
  if (stay.actualStartAt && !isIsoInstant(stay.actualStartAt)) {
    fail('STAY_DATE_INVALID', 'El inicio real de la estancia no es válido.')
  }
  if (stay.actualEndAt && !isIsoInstant(stay.actualEndAt)) {
    fail('STAY_DATE_INVALID', 'El fin real de la estancia no es válido.')
  }
  if (stay.actualStartAt && stay.actualEndAt && Date.parse(stay.actualEndAt) <= Date.parse(stay.actualStartAt)) {
    fail('STAY_DATE_INVALID', 'El fin real debe ser posterior al inicio real.')
  }
  if (stay.status === 'planned' && (stay.actualStartAt || stay.actualEndAt)) {
    fail('STAY_STATUS_INVALID', 'Una estancia prevista no puede contener tiempos reales.')
  }
  if (stay.status === 'active' && (!stay.actualStartAt || stay.actualEndAt)) {
    fail('STAY_STATUS_INVALID', 'Una estancia activa requiere inicio real y no admite fin real.')
  }
  if (stay.status === 'completed' && (!stay.actualStartAt || !stay.actualEndAt)) {
    fail('STAY_STATUS_INVALID', 'Una estancia completada requiere inicio y fin reales.')
  }
  if (stay.status === 'cancelled') {
    if (stay.actualStartAt || stay.actualEndAt) {
      fail('STAY_STARTED_CANNOT_CANCEL', 'Una estancia iniciada no puede cancelarse.')
    }
    if (!stay.cancelledAt || !stay.cancellationReasonCode) {
      fail('STAY_STATUS_INVALID', 'Una estancia cancelada requiere fecha y motivo.')
    }
  }
}

export function assertStayBelongsToSeason(stay: SeasonStay, season: EarningPeriod): void {
  if (!season.id || stay.earningPeriodId !== season.id) {
    fail('STAY_SEASON_MISMATCH', 'La estancia pertenece a otra temporada.')
  }
  if (!season.countryCode || stay.countryCode !== season.countryCode) {
    fail('STAY_COUNTRY_MISMATCH', 'La estancia debe pertenecer al país de la temporada.')
  }
}

export function assertNoConfirmedStayOverlaps(stays: readonly SeasonStay[]): void {
  const confirmed = stays
    .filter((stay) => stay.status !== 'cancelled' && stay.actualStartAt)
    .sort((left, right) => left.actualStartAt!.localeCompare(right.actualStartAt!))
  for (let index = 1; index < confirmed.length; index += 1) {
    const previous = confirmed[index - 1]
    const current = confirmed[index]
    if (!previous || !current || !previous.actualEndAt) continue
    if (Date.parse(current.actualStartAt!) < Date.parse(previous.actualEndAt)) {
      fail('STAY_OVERLAP', 'Las estancias confirmadas no pueden solaparse.')
    }
  }
}

export function validateSeasonRevisionShape(revision: SeasonRevision): void {
  if (!Number.isInteger(revision.earningPeriodId) || revision.earningPeriodId <= 0 ||
    !Number.isInteger(revision.sequence) || revision.sequence <= 0 ||
    !isIsoInstant(revision.recordedAt)) {
    fail('REVISION_INVALID', 'La revisión de temporada no es válida.')
  }
  if (revision.kind === 'migration_baseline') {
    if (revision.previousValue !== null ||
      (revision.nextValue.plannedEndDate !== undefined && !isIsoInstant(revision.nextValue.plannedEndDate)) ||
      (revision.nextValue.economicGoal !== undefined &&
        (!Number.isFinite(revision.nextValue.economicGoal) || revision.nextValue.economicGoal <= 0))) {
      fail('REVISION_INVALID', 'La revisión base de migración no es válida.')
    }
    return
  }
  if (revision.kind === 'planned_end_date_revised') {
    if (!isLocalDate(revision.nextValue) ||
      (revision.previousValue !== null && !isLocalDate(revision.previousValue)) ||
      (revision.source === 'user_correction' && !revision.reason?.trim())) {
      fail('REVISION_INVALID', 'La revisión de fecha prevista no es válida.')
    }
    return
  }
  if (revision.kind === 'economic_goal_revised') {
    if (!Number.isFinite(revision.nextValue) || revision.nextValue <= 0 ||
      (revision.previousValue !== null &&
        (!Number.isFinite(revision.previousValue) || revision.previousValue <= 0))) {
      fail('REVISION_INVALID', 'La revisión de objetivo económico no es válida.')
    }
    return
  }
  if (!revision.reason?.trim() || !revision.previousValue.city.trim() ||
    !revision.nextValue.city.trim()) {
    fail('REVISION_INVALID', 'La corrección de estancia no es válida.')
  }
}

type SeasonRecord = ServiceIncome | Expense | Appointment

function recordPeriodId(record: SeasonRecord) {
  if (
    record.earningPeriodId !== undefined &&
    record.seasonPeriodId !== undefined &&
    record.earningPeriodId !== record.seasonPeriodId
  ) return undefined
  return record.earningPeriodId ?? record.seasonPeriodId
}

export function assertSeasonGeoBackupIsValid(input: {
  seasons: readonly EarningPeriod[]
  stays: readonly SeasonStay[]
  revisions: readonly SeasonRevision[]
  services: readonly ServiceIncome[]
  expenses: readonly Expense[]
  appointments: readonly Appointment[]
}): void {
  try {
    const seasons = new Map(input.seasons.flatMap((season) => season.id ? [[season.id, season] as const] : []))
    const stays = new Map<number, SeasonStay>()
    const positions = new Set<string>()
    const sequences = new Set<string>()

    for (const stay of input.stays) {
      if (!stay.id || stays.has(stay.id)) fail('BACKUP_SEASON_GEO_INVALID', 'ID de estancia duplicado o ausente.')
      const season = seasons.get(stay.earningPeriodId)
      if (!season) fail('BACKUP_SEASON_GEO_INVALID', 'La estancia no tiene una temporada existente.')
      validateSeasonStayShape(stay)
      assertStayBelongsToSeason(stay, season)
      const positionKey = `${stay.earningPeriodId}:${stay.position}`
      if (positions.has(positionKey)) fail('BACKUP_SEASON_GEO_INVALID', 'Hay posiciones de estancia duplicadas.')
      positions.add(positionKey)
      stays.set(stay.id, stay)
    }

    for (const season of input.seasons) {
      if (!season.id) continue
      const seasonStays = input.stays.filter((stay) => stay.earningPeriodId === season.id)
      if (seasonStays.filter((stay) => stay.status === 'active').length > 1) {
        fail('BACKUP_SEASON_GEO_INVALID', 'Una temporada contiene varias estancias activas.')
      }
      assertNoConfirmedStayOverlaps(seasonStays)
    }

    for (const revision of input.revisions) {
      if (!seasons.has(revision.earningPeriodId)) fail('BACKUP_SEASON_GEO_INVALID', 'La revisión no tiene temporada.')
      validateSeasonRevisionShape(revision)
      const key = `${revision.earningPeriodId}:${revision.sequence}`
      if (sequences.has(key)) fail('BACKUP_SEASON_GEO_INVALID', 'Hay secuencias de revisión duplicadas.')
      sequences.add(key)
      if (revision.kind === 'season_stay_corrected' && !stays.has(revision.seasonStayId)) {
        fail('BACKUP_SEASON_GEO_INVALID', 'La revisión apunta a una estancia inexistente.')
      }
    }

    const validateRecord = (record: SeasonRecord, kind: 'service' | 'expense' | 'appointment') => {
      validateTravelDestination(record.travelDestination)
      if (record.seasonStayId === undefined) return
      const periodId = recordPeriodId(record)
      if (!periodId) fail('BACKUP_SEASON_GEO_INVALID', 'Un registro con estancia debe tener temporada.')
      if (resolveRecordUsageMode(record) !== 'professional') {
        fail('BACKUP_SEASON_GEO_INVALID', 'Un registro Personal no puede tener estancia.')
      }
      const stay = stays.get(record.seasonStayId)
      if (!stay || stay.earningPeriodId !== periodId) {
        fail('BACKUP_SEASON_GEO_INVALID', 'El registro apunta a una estancia de otra temporada.')
      }
      if (stay.status === 'cancelled') {
        const season = seasons.get(periodId)
        const historicalClosedAppointment = kind === 'appointment' &&
          stay.cancellationReasonCode === 'season_closed' && season?.status === 'closed'
        if (!historicalClosedAppointment) {
          fail('BACKUP_SEASON_GEO_INVALID', 'Un registro no puede apuntar a una estancia cancelada.')
        }
      }
    }
    input.services.forEach((record) => validateRecord(record, 'service'))
    input.expenses.forEach((record) => validateRecord(record, 'expense'))
    input.appointments.forEach((record) => validateRecord(record, 'appointment'))
  } catch (error) {
    if (error instanceof SeasonGeoDomainError && error.code === 'BACKUP_SEASON_GEO_INVALID') throw error
    throw new SeasonGeoDomainError(
      'BACKUP_SEASON_GEO_INVALID',
      error instanceof Error ? error.message : 'El backup geográfico no es válido.',
    )
  }
}
