import { describe, expect, it } from 'vitest'

import { isLocationSeasonClosed } from './locationSeasons'

const closed = [{ city: 'Madrid', country: 'ES' as const, closedAt: '2026-01-01T00:00:00.000Z' }]

describe('isLocationSeasonClosed (PB-GEO-002 §3.8)', () => {
  it('mantiene el cierre legacy por ciudad en registros sin estancia', () => {
    expect(isLocationSeasonClosed({ city: 'madrid', country: 'ES' }, closed)).toBe(true)
  })

  it('no bloquea registros asociados a una estancia aunque repitan la ciudad cerrada', () => {
    expect(isLocationSeasonClosed({ city: 'Madrid', country: 'ES', seasonStayId: 3 }, closed)).toBe(false)
  })
})
