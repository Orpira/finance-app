import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EarningPeriod } from '../types/earningPeriod'
import type { SeasonStay } from '../types/seasonStay'

const earningPeriods = { get: vi.fn() }
const seasonStays = { get: vi.fn() }

vi.mock('../database/db', () => ({ db: { earningPeriods, seasonStays } }))

const {
  getRecordGeographyReadModel,
  resolveCreateRecordGeography,
  resolveUpdateRecordGeography,
} = await import('./recordGeographyService')

const season: EarningPeriod = {
  id: 7,
  name: 'Colombia',
  percentage: 50,
  startDate: '2026-01-01T00:00:00.000Z',
  status: 'active',
  countryCode: 'CO',
  createdAt: '2026-01-01T00:00:00.000Z',
}

function stay(overrides: Partial<SeasonStay> = {}): SeasonStay {
  return {
    id: 3,
    earningPeriodId: 7,
    position: 0,
    city: 'Bogotá',
    cityNormalized: 'bogota',
    countryCode: 'CO',
    status: 'active',
    actualStartAt: '2026-01-02T00:00:00.000Z',
    timeZone: 'America/Bogota',
    locationSource: 'manual',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  earningPeriods.get.mockResolvedValue(season)
  seasonStays.get.mockResolvedValue(stay())
})

describe('recordGeographyService', () => {
  it('copia la ciudad y el país de la estancia al crear un movimiento', async () => {
    await expect(resolveCreateRecordGeography({ seasonStayId: 3 }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toEqual({
      seasonStayId: 3, travelDestination: undefined, city: 'Bogotá', country: 'CO',
    })
  })

  it('mantiene compatible la creación sin estancia y normaliza un destino manual', async () => {
    await expect(resolveCreateRecordGeography({
      travelDestination: { kind: 'place', label: '  Feria local ', city: ' Medellín ', source: 'manual' },
    }, {
      kind: 'expense', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toEqual({
      seasonStayId: undefined,
      travelDestination: expect.objectContaining({ label: 'Feria local', cityNormalized: 'medellin' }),
    })
  })

  it('rechaza destinos manipulados antes de persistir', async () => {
    await expect(resolveCreateRecordGeography({
      travelDestination: { kind: 'city', label: 'Destino', countryCode: 'XX' as 'ES', source: 'manual' },
    }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).rejects.toMatchObject({ code: 'TRAVEL_DESTINATION_INVALID' })
  })

  it('rechaza estancias planificadas para ingresos y egresos', async () => {
    seasonStays.get.mockResolvedValue(stay({ status: 'planned', actualStartAt: undefined, plannedStartDate: '2026-02-01' }))
    await expect(resolveCreateRecordGeography({ seasonStayId: 3 }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-02-01',
    })).rejects.toMatchObject({ code: 'STAY_NOT_STARTED' })
  })

  it('permite planificar una cita dentro de una estancia futura', async () => {
    seasonStays.get.mockResolvedValue(stay({
      status: 'planned', actualStartAt: undefined,
      plannedStartDate: '2026-02-01', plannedEndDate: '2026-02-10',
    }))
    await expect(resolveCreateRecordGeography({ seasonStayId: 3 }, {
      kind: 'appointment', usageMode: 'professional', earningPeriodId: 7,
      temporalValue: '2026-02-05T10:00:00.000Z',
    })).resolves.toMatchObject({ seasonStayId: 3, city: 'Bogotá' })
  })

  it('rechaza estancias de otra temporada y movimientos fuera del intervalo', async () => {
    seasonStays.get.mockResolvedValueOnce(stay({ earningPeriodId: 8 }))
    await expect(resolveCreateRecordGeography({ seasonStayId: 3 }, {
      kind: 'expense', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).rejects.toMatchObject({ code: 'STAY_SEASON_MISMATCH' })

    seasonStays.get.mockResolvedValueOnce(stay({ actualEndAt: '2026-01-05T00:00:00.000Z', status: 'completed' }))
    await expect(resolveCreateRecordGeography({ seasonStayId: 3 }, {
      kind: 'appointment', usageMode: 'professional', earningPeriodId: 7,
      temporalValue: '2026-01-05T00:00:00.000Z',
    })).rejects.toMatchObject({ code: 'RECORD_OUTSIDE_STAY_INTERVAL' })
  })

  it('distingue ausencia, null y sincronización explícita al editar', async () => {
    const existing = {
      seasonStayId: 3,
      city: 'Ciudad histórica',
      country: 'CO',
      travelDestination: { kind: 'city' as const, label: 'Cali', source: 'manual' as const },
    }
    await expect(resolveUpdateRecordGeography(existing, {}, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toMatchObject({ seasonStayId: 3, city: 'Ciudad histórica', travelDestination: { label: 'Cali' } })

    await expect(resolveUpdateRecordGeography(existing, {
      seasonStayId: undefined, travelDestination: undefined,
    }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toMatchObject({ seasonStayId: 3, travelDestination: { label: 'Cali' } })

    await expect(resolveUpdateRecordGeography(existing, {
      seasonStayId: null, travelDestination: null,
    }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toEqual({
      seasonStayId: undefined, travelDestination: undefined, city: 'Ciudad histórica', country: 'CO',
    })

    await expect(resolveUpdateRecordGeography(existing, { syncLocationFromStay: true }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toMatchObject({ city: 'Bogotá', country: 'CO' })

    await expect(resolveUpdateRecordGeography(existing, { city: 'Cali' }, {
      kind: 'income', usageMode: 'professional', earningPeriodId: 7, temporalValue: '2026-01-03',
    })).resolves.toMatchObject({ city: 'Cali', country: 'CO' })
  })

  it('expone registros legacy sin estancia y detecta referencias huérfanas', async () => {
    seasonStays.get.mockResolvedValue(undefined)
    await expect(getRecordGeographyReadModel({
      earningPeriodId: 7, seasonStayId: 99, city: 'Cali', country: 'CO',
    })).resolves.toMatchObject({
      historicalLocation: { city: 'Cali', country: 'CO' },
      hasOrphanedStayReference: true,
    })
  })
})
