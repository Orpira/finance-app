import { describe, expect, it } from 'vitest'

import type { SeasonStay } from '../../../types/seasonStay'
import {
  buildItinerary,
  computeVisitNumbers,
  describeSeasonLocation,
  formatStayPeriod,
  formatTravelDestination,
  isoToLocalDateTimeInput,
  localDateTimeInputToIso,
} from './stayPresentation'

function stay(overrides: Partial<SeasonStay>): SeasonStay {
  return {
    id: 1,
    earningPeriodId: 7,
    position: 0,
    city: 'Madrid',
    cityNormalized: 'madrid',
    countryCode: 'ES',
    status: 'planned',
    locationSource: 'manual',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('stayPresentation', () => {
  it('numera las visitas repetidas a una ciudad sin contar las canceladas', () => {
    const stays = [
      stay({ id: 1, status: 'completed', actualStartAt: '2026-11-01T08:00:00.000Z', actualEndAt: '2026-11-05T08:00:00.000Z' }),
      stay({ id: 2, city: 'Barcelona', cityNormalized: 'barcelona', status: 'completed', actualStartAt: '2026-11-05T08:00:00.000Z', actualEndAt: '2026-11-08T08:00:00.000Z' }),
      stay({ id: 3, status: 'cancelled', cancelledAt: '2026-11-02T00:00:00.000Z', cancellationReasonCode: 'user_cancelled' }),
      stay({ id: 4, status: 'active', actualStartAt: '2026-11-08T08:00:00.000Z' }),
    ]
    const visits = computeVisitNumbers(stays)
    expect(visits.get(1)).toBe(1)
    expect(visits.get(2)).toBe(1)
    expect(visits.has(3)).toBe(false)
    expect(visits.get(4)).toBe(2)

    const entries = buildItinerary(stays)
    const madridEntries = entries.filter((entry) => entry.type === 'stay' && entry.stay.cityNormalized === 'madrid')
    expect(madridEntries.every((entry) => entry.type === 'stay' && entry.repeated)).toBe(true)
  })

  it('muestra un hueco entre una estancia finalizada y la siguiente iniciada', () => {
    const entries = buildItinerary([
      stay({ id: 1, status: 'completed', actualStartAt: '2026-11-01T08:00:00.000Z', actualEndAt: '2026-11-03T08:00:00.000Z' }),
      stay({ id: 2, city: 'Toledo', cityNormalized: 'toledo', status: 'active', actualStartAt: '2026-11-04T08:00:00.000Z' }),
    ])
    expect(entries.map((entry) => entry.type)).toEqual(['stay', 'gap', 'stay'])
  })

  it('no inventa un hueco cuando el cambio de ciudad es en el mismo instante', () => {
    const entries = buildItinerary([
      stay({ id: 1, status: 'completed', actualStartAt: '2026-11-01T08:00:00.000Z', actualEndAt: '2026-11-10T12:00:00.000Z' }),
      stay({ id: 2, city: 'Barcelona', cityNormalized: 'barcelona', status: 'active', actualStartAt: '2026-11-10T12:00:00.000Z' }),
    ])
    expect(entries.some((entry) => entry.type === 'gap')).toBe(false)
  })

  it('marca un hueco abierto si no hay estancia actual tras la última finalizada', () => {
    const entries = buildItinerary([
      stay({ id: 1, status: 'completed', actualStartAt: '2026-11-01T08:00:00.000Z', actualEndAt: '2026-11-03T08:00:00.000Z' }),
    ])
    const last = entries.at(-1)
    expect(last?.type).toBe('gap')
    expect(last && 'to' in last ? last.to : undefined).toBeUndefined()
  })

  it('describe periodos previstos, reales y sin fechas', () => {
    expect(formatStayPeriod(stay({}))).toBe('Fechas por decidir')
    expect(formatStayPeriod(stay({ plannedStartDate: '2026-11-03', plannedEndDate: '2026-11-10' }))).toMatch(/^Prevista /)
    expect(formatStayPeriod(stay({ status: 'active', actualStartAt: '2026-11-03T09:00:00.000Z', timeZone: 'Europe/Madrid' }))).toMatch(/^Desde /)
  })

  it('formatea destinos sin repetir ciudad y etiqueta', () => {
    expect(formatTravelDestination({ kind: 'city', label: 'Toledo', city: 'Toledo', countryCode: 'ES', source: 'manual' })).toBe('Toledo, España')
    expect(formatTravelDestination({ kind: 'place', label: 'Hotel Sol', city: 'Lisboa', countryCode: 'PT', source: 'manual' })).toBe('Hotel Sol, Lisboa, Portugal')
  })

  it('convierte ida y vuelta entre datetime-local e ISO', () => {
    const iso = localDateTimeInputToIso('2026-11-10T13:00')
    expect(isoToLocalDateTimeInput(iso)).toBe('2026-11-10T13:00')
    expect(localDateTimeInputToIso('no-es-fecha')).toBe('')
  })

  it('describe la ubicación de la temporada a partir del itinerario', () => {
    const active = { city: 'Madrid', status: 'active' as const }
    expect(describeSeasonLocation(active)).toBe('Madrid')
    expect(describeSeasonLocation({ city: '', status: 'active' }, [])).toBe('Ciudad por decidir')
    expect(describeSeasonLocation(active, [])).toBe('Ciudad histórica: Madrid')
    expect(describeSeasonLocation(active, [stay({ id: 2, city: 'Toledo', status: 'active', actualStartAt: '2026-11-01T08:00:00.000Z' })]))
      .toBe('Estancia actual: Toledo')
    expect(describeSeasonLocation(active, [stay({ id: 3 })])).toBe('Sin estancia actual')
    expect(describeSeasonLocation({ city: 'Madrid', status: 'closed' }, [stay({ id: 3 })])).toBe('Sin estancias realizadas')
  })
})

