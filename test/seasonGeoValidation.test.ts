import { describe, expect, it } from 'vitest'

import type { SeasonStay } from '../src/types/seasonStay'
import { normalizeCityName } from '../src/utils/cityNormalization'
import {
  assertNoConfirmedStayOverlaps,
  assertSeasonGeoBackupIsValid,
  SeasonGeoDomainError,
  validateTravelDestination,
} from '../src/utils/seasonGeoValidation'

function stay(overrides: Partial<SeasonStay> = {}): SeasonStay {
  return {
    id: 1,
    earningPeriodId: 4,
    position: 0,
    city: 'Bogotá',
    cityNormalized: 'bogota',
    countryCode: 'CO',
    status: 'completed',
    actualStartAt: '2026-10-01T10:00:00.000Z',
    actualEndAt: '2026-10-05T10:00:00.000Z',
    timeZone: 'America/Bogota',
    locationSource: 'manual',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
    ...overrides,
  }
}

describe('normalización geográfica PB-GEO-002', () => {
  it('unifica mayúsculas, espacios y diacríticos', () => {
    expect(normalizeCityName('  BOGOTÁ   D.C. ')).toBe('bogota d c')
  })

  it('normaliza destinos manuales sin convertirlos en estancias', () => {
    expect(validateTravelDestination({ kind: 'place', label: '  Centro de Medellín ', city: ' Medellín ', source: 'manual' }))
      .toMatchObject({ label: 'Centro de Medellín', city: 'Medellín', cityNormalized: 'medellin' })
  })
})

describe('invariantes de estancias', () => {
  it('admite el cambio de ciudad en el mismo instante con intervalos semiabiertos', () => {
    expect(() => assertNoConfirmedStayOverlaps([
      stay(),
      stay({ id: 2, position: 1, city: 'Cali', cityNormalized: 'cali', actualStartAt: '2026-10-05T10:00:00.000Z', actualEndAt: '2026-10-10T10:00:00.000Z' }),
    ])).not.toThrow()
  })

  it('rechaza solapamientos reales', () => {
    expect(() => assertNoConfirmedStayOverlaps([
      stay(),
      stay({ id: 2, position: 1, actualStartAt: '2026-10-05T09:59:59.000Z', actualEndAt: '2026-10-10T10:00:00.000Z' }),
    ])).toThrowError(SeasonGeoDomainError)
  })

  it('rechaza un backup con una estancia huérfana antes de restaurar', () => {
    expect(() => assertSeasonGeoBackupIsValid({
      seasons: [], stays: [stay()], revisions: [], services: [], expenses: [], appointments: [],
    })).toThrowError(expect.objectContaining({ code: 'BACKUP_SEASON_GEO_INVALID' }))
  })
})
