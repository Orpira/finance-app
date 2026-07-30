import { describe, expect, it } from 'vitest'

import { createDefaultSettings } from '../src/database/db'

describe('createDefaultSettings', () => {
  it('inicializa el método de cálculo de ingreso en "service_duration" (compatibilidad hacia atrás)', () => {
    expect(createDefaultSettings().incomeCalculationMethod).toBe('service_duration')
  })

  it('inicializa el valor por hora en 0', () => {
    expect(createDefaultSettings().hourlyRate).toBe(0)
  })

  it('inicializa la unidad de tiempo trabajado en "minutes"', () => {
    expect(createDefaultSettings().workedTimeUnit).toBe('minutes')
  })
})
