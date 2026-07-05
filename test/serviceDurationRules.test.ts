import { describe, expect, it } from 'vitest'

import { DEFAULT_EXIT_DURATION_MINUTES } from '../src/config/serviceTimer'
import {
  SERVICE_DURATION_OPTIONS,
  calculateEffectiveDuration,
} from '../src/utils/serviceDuration'

describe('service duration rules', () => {
  it('uses configured default for Salida', () => {
    expect(calculateEffectiveDuration({ duration: 25, durationLabel: 'Salida' })).toBe(DEFAULT_EXIT_DURATION_MINUTES)
  })

  it('keeps registered duration for non-Salida services', () => {
    expect(calculateEffectiveDuration({ duration: 45, durationLabel: '60' })).toBe(45)
  })

  it('exposes Salida option with configurable duration', () => {
    const salidaOption = SERVICE_DURATION_OPTIONS.find((option) => option.durationLabel === 'Salida')
    expect(salidaOption?.durationMinutes).toBe(DEFAULT_EXIT_DURATION_MINUTES)
  })
})