import { describe, expect, it } from 'vitest'

import {
  INCOME_CALCULATION_METHODS,
  WORKED_TIME_UNITS,
  getWorkedTimeUnitForMethod,
  isIncomeCalculationMethod,
  isWorkedTimeUnit,
} from '../src/catalogs/incomeCalculationMethods'

describe('INCOME_CALCULATION_METHODS', () => {
  it('expone exactamente los dos métodos aprobados en PB-IS-0007', () => {
    expect(INCOME_CALCULATION_METHODS).toEqual([
      { code: 'service_duration', label: 'Servicio por tiempo' },
      { code: 'hourly_workday', label: 'Jornada por horas' },
    ])
  })
})

describe('WORKED_TIME_UNITS', () => {
  it('expone exactamente las dos unidades de tiempo', () => {
    expect(WORKED_TIME_UNITS).toEqual([
      { code: 'minutes', label: 'Minutos' },
      { code: 'hours', label: 'Horas' },
    ])
  })
})

describe('isIncomeCalculationMethod', () => {
  it.each([
    ['service_duration', true],
    ['hourly_workday', true],
    ['comision', false],
    [undefined, false],
    [null, false],
    [42, false],
  ])('%s -> %s', (value, expected) => {
    expect(isIncomeCalculationMethod(value)).toBe(expected)
  })
})

describe('isWorkedTimeUnit', () => {
  it.each([
    ['minutes', true],
    ['hours', true],
    ['days', false],
    [undefined, false],
  ])('%s -> %s', (value, expected) => {
    expect(isWorkedTimeUnit(value)).toBe(expected)
  })
})

describe('getWorkedTimeUnitForMethod', () => {
  // Regresión: el formulario de "Registrar ingreso" pedía el tiempo
  // trabajado en minutos incluso con "Jornada por horas" seleccionada en el
  // wizard/configuración, porque tomaba la unidad de settings.workedTimeUnit
  // (por defecto 'minutes') en vez de derivarla del método elegido.
  it('"Jornada por horas" siempre pide el tiempo trabajado en horas, nunca en minutos', () => {
    expect(getWorkedTimeUnitForMethod('hourly_workday')).toBe('hours')
  })

  it('"Servicio por tiempo" siempre pide el tiempo trabajado en minutos', () => {
    expect(getWorkedTimeUnitForMethod('service_duration')).toBe('minutes')
  })
})
