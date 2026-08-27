import { describe, expect, it } from 'vitest'

import {
  getReportPeriodLabel,
  getReportPeriodRange,
  shiftReportPeriod,
} from '../src/pages/Reports/reportPeriod'

describe('report period navigation', () => {
  const now = new Date('2026-08-27T12:00:00')

  it('calcula semana local, mes y año completos', () => {
    expect(getReportPeriodRange('week', now)).toEqual({
      from: '2026-08-24',
      to: '2026-08-30',
    })
    expect(getReportPeriodRange('month', now)).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    })
    expect(getReportPeriodRange('year', now)).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  it('desplaza al período anterior y siguiente con la misma granularidad', () => {
    expect(shiftReportPeriod('week', '2026-08-24', -1)).toEqual({
      from: '2026-08-17',
      to: '2026-08-23',
    })
    expect(shiftReportPeriod('month', '2026-08-01', 1)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
    })
    expect(shiftReportPeriod('year', '2026-01-01', -1)).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    })
  })

  it('presenta una etiqueta central acorde con la granularidad', () => {
    expect(getReportPeriodLabel('month', { from: '2026-08-01', to: '2026-08-31' })).toBe('Agosto 2026')
    expect(getReportPeriodLabel('week', { from: '2026-08-24', to: '2026-08-30' })).toBe('24/08/2026 - 30/08/2026')
    expect(getReportPeriodLabel('year', { from: '2026-01-01', to: '2026-12-31' })).toBe('2026')
  })

  it('muestra las fechas reales cuando el usuario define un rango parcial', () => {
    expect(getReportPeriodLabel('month', { from: '2026-08-05', to: '2026-08-27' })).toBe('05/08/2026 - 27/08/2026')
    expect(getReportPeriodLabel('year', { from: '2026-02-01', to: '2026-11-30' })).toBe('01/02/2026 - 30/11/2026')
  })
})