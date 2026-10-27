import { describe, expect, it } from 'vitest'

import { elapsedPercentage } from './seasonGoalShared'

describe('elapsedPercentage', () => {
  it('calcula fechas civiles sin desplazarlas por zona horaria', () => {
    const result = elapsedPercentage(
      { startDate: '2026-10-01', plannedEndDate: '2026-10-10' },
      new Date('2026-10-05T23:59:59.999Z'),
    )
    expect(result).toBeCloseTo(50, 4)
  })

  it('respeta instantes ISO completos sin concatenar sufijos', () => {
    expect(elapsedPercentage(
      { startDate: '2026-10-01T10:00:00.000Z', plannedEndDate: '2026-10-11T10:00:00.000Z' },
      new Date('2026-10-06T10:00:00.000Z'),
    )).toBe(50)
  })

  it('respeta offsets ISO y limita el resultado entre cero y cien', () => {
    const period = {
      startDate: '2026-10-01T10:00:00+02:00',
      plannedEndDate: '2026-10-02T10:00:00+02:00',
    }
    expect(elapsedPercentage(period, new Date('2026-09-01T00:00:00Z'))).toBe(0)
    expect(elapsedPercentage(period, new Date('2026-11-01T00:00:00Z'))).toBe(100)
  })

  it('devuelve undefined ante fechas inválidas, orden inverso o now inválido', () => {
    expect(elapsedPercentage({ startDate: 'x', plannedEndDate: '2026-10-10' }, new Date())).toBeUndefined()
    expect(elapsedPercentage({ startDate: '2026-10-10', plannedEndDate: '2026-10-01' }, new Date())).toBeUndefined()
    expect(elapsedPercentage({ startDate: '2026-10-01', plannedEndDate: '2026-10-10' }, new Date('x'))).toBeUndefined()
  })
})
