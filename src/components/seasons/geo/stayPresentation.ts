import type { EarningPeriod } from '../../../types/earningPeriod'
import type { SeasonStay, SeasonStayStatus } from '../../../types/seasonStay'
import type { TravelDestination } from '../../../types/travelDestination'
import { countries } from '../../../utils/countries'

/**
 * Helpers de presentación para PB-GEO-002. No contienen reglas de dominio:
 * la selectividad, los intervalos y la mutabilidad siempre los decide el
 * servicio (seasonStayService / recordGeographyService). Aquí solo se
 * formatea lo que ya está persistido.
 */

export const STAY_STATUS_LABELS: Record<SeasonStayStatus, string> = {
  planned: 'Prevista',
  active: 'Actual',
  completed: 'Finalizada',
  cancelled: 'Cancelada',
}

export function countryLabel(code?: string) {
  if (!code) return ''
  return countries.find((country) => country.value === code)?.label ?? code
}

export function currentTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function formatLocalDate(value: string) {
  // Fechas civiles YYYY-MM-DD: se formatean sin desplazar zona horaria.
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return value
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

function formatInstant(value: string, timeZone?: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  try {
    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
  }
}

/** Periodo visible de una estancia: real si existe, previsto en caso contrario. */
export function formatStayPeriod(stay: Pick<SeasonStay, 'status' | 'plannedStartDate' | 'plannedEndDate' | 'actualStartAt' | 'actualEndAt' | 'timeZone'>) {
  if (stay.actualStartAt) {
    const start = formatInstant(stay.actualStartAt, stay.timeZone)
    return stay.actualEndAt
      ? `${start} – ${formatInstant(stay.actualEndAt, stay.timeZone)}`
      : `Desde ${start}`
  }
  if (stay.plannedStartDate && stay.plannedEndDate) {
    return `Prevista ${formatLocalDate(stay.plannedStartDate)} – ${formatLocalDate(stay.plannedEndDate)}`
  }
  if (stay.plannedStartDate) return `Prevista desde ${formatLocalDate(stay.plannedStartDate)}`
  if (stay.plannedEndDate) return `Prevista hasta ${formatLocalDate(stay.plannedEndDate)}`
  return 'Fechas por decidir'
}

export function formatVisitNumber(visitNumber: number) {
  return `${visitNumber}.ª visita`
}

/**
 * Número de visita por ciudad normalizada, siguiendo el orden recibido
 * (listSeasonStays ya devuelve el orden visible). Las canceladas no cuentan
 * como visita, igual que en listSelectableSeasonStays.
 */
export function computeVisitNumbers(stays: readonly SeasonStay[]) {
  const counts = new Map<string, number>()
  const result = new Map<number, number>()
  for (const stay of stays) {
    if (stay.status === 'cancelled' || stay.id === undefined) continue
    const next = (counts.get(stay.cityNormalized) ?? 0) + 1
    counts.set(stay.cityNormalized, next)
    result.set(stay.id, next)
  }
  return result
}

export function cityHasRepeatedVisits(stays: readonly SeasonStay[], cityNormalized: string) {
  return stays.filter((stay) => stay.status !== 'cancelled' && stay.cityNormalized === cityNormalized).length > 1
}

export function describeStay(
  stay: SeasonStay,
  options: { visitNumber?: number; showVisit?: boolean } = {},
) {
  const country = countryLabel(stay.countryCode)
  const visit = options.showVisit && options.visitNumber ? ` · ${formatVisitNumber(options.visitNumber)}` : ''
  return `${stay.city}${country ? `, ${country}` : ''}${visit}`
}

export type ItineraryEntry =
  | { type: 'stay'; stay: SeasonStay; visitNumber?: number; repeated: boolean }
  | { type: 'gap'; key: string; from: string; to?: string; timeZone?: string }

/**
 * Itinerario visible: estancias en el orden de listSeasonStays con los huecos
 * reales entre una estancia finalizada y la siguiente iniciada. Un hueco es
 * un estado legítimo (tránsito, ciudad aún por decidir), nunca un error.
 */
export function buildItinerary(stays: readonly SeasonStay[]): ItineraryEntry[] {
  const visitNumbers = computeVisitNumbers(stays)
  const entries: ItineraryEntry[] = []
  const started = stays
    .filter((stay) => stay.status !== 'cancelled' && stay.actualStartAt)
    .sort((left, right) => left.actualStartAt!.localeCompare(right.actualStartAt!))
  const gapAfter = new Map<number, ItineraryEntry>()
  started.forEach((stay, index) => {
    const next = started[index + 1]
    if (!stay.actualEndAt || stay.id === undefined) return
    if (!next) {
      // Sin estancia actual tras finalizar la última: hueco abierto.
      if (!stays.some((candidate) => candidate.status === 'active')) {
        gapAfter.set(stay.id, { type: 'gap', key: `gap-${stay.id}`, from: stay.actualEndAt, timeZone: stay.timeZone })
      }
      return
    }
    if (Date.parse(next.actualStartAt!) > Date.parse(stay.actualEndAt)) {
      gapAfter.set(stay.id, {
        type: 'gap',
        key: `gap-${stay.id}`,
        from: stay.actualEndAt,
        to: next.actualStartAt,
        timeZone: stay.timeZone,
      })
    }
  })
  for (const stay of stays) {
    entries.push({
      type: 'stay',
      stay,
      visitNumber: stay.id === undefined ? undefined : visitNumbers.get(stay.id),
      repeated: cityHasRepeatedVisits(stays, stay.cityNormalized),
    })
    const gap = stay.id === undefined ? undefined : gapAfter.get(stay.id)
    if (gap) entries.push(gap)
  }
  return entries
}

export function formatGap(entry: Extract<ItineraryEntry, { type: 'gap' }>) {
  const from = formatInstant(entry.from, entry.timeZone)
  return entry.to
    ? `Sin estancia entre ${from} y ${formatInstant(entry.to, entry.timeZone)}`
    : `Sin estancia desde ${from}`
}

export function formatTravelDestination(destination: TravelDestination) {
  const parts = [destination.label]
  if (destination.city && destination.city !== destination.label) parts.push(destination.city)
  const country = countryLabel(destination.countryCode)
  if (country) parts.push(country)
  return parts.join(', ')
}

/** `<input type="datetime-local">` usa hora local sin zona; se convierte a ISO absoluto. */
export function localDateTimeInputToIso(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

export function isoToLocalDateTimeInput(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatRevisionDate(value: string) {
  return formatInstant(value)
}

export function formatCivilDate(value?: string | null) {
  return value ? formatLocalDate(value) : '—'
}

/**
 * Ubicación visible de una temporada en listados y cabeceras. Con estancias,
 * la fuente es el itinerario; sin estancias, `EarningPeriod.city` es solo la
 * instantánea legacy y se rotula como histórica. `stays === undefined` indica
 * que el llamador no cargó el itinerario y conserva el texto anterior.
 */
export function describeSeasonLocation(
  period: Pick<EarningPeriod, 'city' | 'status'>,
  stays?: readonly SeasonStay[],
) {
  if (!stays) return period.city || 'Sin ciudad'
  if (stays.length === 0) return period.city ? `Ciudad histórica: ${period.city}` : 'Ciudad por decidir'
  const active = stays.find((stay) => stay.status === 'active')
  if (active) return `Estancia actual: ${active.city}`
  const visitedCities = [...new Set(
    stays.filter((stay) => stay.status === 'completed').map((stay) => stay.city),
  )]
  if (period.status === 'closed') {
    return visitedCities.length ? `Ciudades: ${visitedCities.join(', ')}` : 'Sin estancias realizadas'
  }
  return 'Sin estancia actual'
}
