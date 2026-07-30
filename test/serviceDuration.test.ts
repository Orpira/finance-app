import { describe, expect, it } from 'vitest'

import { DEFAULT_EXIT_DURATION_MINUTES } from '../src/config/serviceTimer'
import {
  calculateEffectiveDuration,
  getEffectiveFinancialDuration,
  getIncomeDurationDisplay,
} from '../src/utils/serviceDuration'

describe('getEffectiveFinancialDuration', () => {
  it.each([
    ['prefers actual duration', { actualDuration: 47, duration: 60 }, 47],
    ['falls back to planned duration', { duration: 60 }, 60],
    ['returns undefined when both values are absent', {}, undefined],
    ['preserves a zero actual duration', { actualDuration: 0, duration: 60 }, 0],
    ['preserves the stored duration for Salida', { duration: 480, durationLabel: 'Salida' }, 480],
    ['preserves a completed appointment duration', { actualDuration: 73, duration: 60 }, 73],
    ['supports a legacy planned-only record', { duration: 30 }, 30],
    ['preserves a decimal duration', { duration: 30.5 }, 30.5],
    ['preserves an existing negative value without adding a new rule', { duration: -1 }, -1],
  ])('%s', (_label, input, expected) => {
    expect(getEffectiveFinancialDuration(input)).toBe(expected)
  })

  it('keeps the existing Salida normalization separate', () => {
    expect(calculateEffectiveDuration({ duration: 12, durationLabel: 'Salida' })).toBe(
      DEFAULT_EXIT_DURATION_MINUTES,
    )
  })
})

describe('getIncomeDurationDisplay — PB-IS-0007', () => {
  it('"Servicio por tiempo" conserva el formato existente (regresión)', () => {
    expect(
      getIncomeDurationDisplay({ duration: 60, durationLabel: '60' }),
    ).toBe('60 minutos')
  })

  it('"Jornada por horas" muestra el tiempo trabajado en minutos cuando esa es la unidad', () => {
    expect(
      getIncomeDurationDisplay({
        duration: 0,
        incomeCalculationMethod: 'hourly_workday',
        workedTime: 90,
        workedTimeUnit: 'minutes',
      }),
    ).toBe('90 minutos')
  })

  it('"Jornada por horas" muestra el tiempo trabajado en horas cuando esa es la unidad', () => {
    expect(
      getIncomeDurationDisplay({
        duration: 0,
        incomeCalculationMethod: 'hourly_workday',
        workedTime: 2,
        workedTimeUnit: 'hours',
      }),
    ).toBe('2 horas')
  })
})
