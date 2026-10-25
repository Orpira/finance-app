import { describe, expect, it } from 'vitest'

import { calculateStoredRealGain } from '../src/utils/realGain'
import { serviceDurationCalculator } from '../src/utils/incomeCalculation/serviceDurationCalculator'
import { convertWorkedTimeToHours, hourlyWorkdayCalculator } from '../src/utils/incomeCalculation/hourlyWorkdayCalculator'
import {
  assertAdditionalAmountIsValid,
  assertIncomeCalculationInputIsValid,
} from '../src/utils/incomeCalculation/incomeCalculationValidation'
import { runIncomeCalculation } from '../src/utils/incomeCalculation/incomeCalculatorRegistry'

describe('serviceDurationCalculator (equivalencia con calculateStoredRealGain)', () => {
  it.each([
    { totalAmount: 120, percentage: 25, usageMode: 'basic' as const },
    { totalAmount: 100, percentage: 50, usageMode: 'professional' as const, incomeType: 'ingreso' as const },
    { totalAmount: 80, percentage: 40, usageMode: 'professional' as const, incomeType: 'ajuste' as const },
    { totalAmount: 60, percentage: 0, usageMode: 'professional' as const, incomeType: 'otro' as const, storedRealGain: 60 },
  ])(
    'produce EXACTAMENTE el mismo realGain que calculateStoredRealGain directo (%j)',
    (input) => {
      const direct = calculateStoredRealGain(input)
      const viaCalculator = serviceDurationCalculator.calculate(input)

      expect(viaCalculator.realGain).toBe(direct)
    },
  )
})

describe('hourlyWorkdayCalculator', () => {
  it('convierte minutos a horas', () => {
    expect(convertWorkedTimeToHours(120, 'minutes')).toBe(2)
    expect(convertWorkedTimeToHours(90, 'minutes')).toBe(1.5)
  })

  it('usa las horas directamente cuando la unidad es "hours"', () => {
    expect(convertWorkedTimeToHours(3, 'hours')).toBe(3)
  })

  it('por defecto trata el tiempo como minutos si no se especifica unidad', () => {
    expect(convertWorkedTimeToHours(60, undefined)).toBe(1)
  })

  it('calcula el ingreso principal como horas × valor por hora, sin aplicar el % de temporada', () => {
    const result = hourlyWorkdayCalculator.calculate({
      totalAmount: 0,
      percentage: 50, // debe ser ignorado: 100% para la profesional
      usageMode: 'professional',
      workedTime: 120,
      workedTimeUnit: 'minutes',
      hourlyRate: 20,
    })

    expect(result.workedHours).toBe(2)
    expect(result.realGain).toBe(40) // 100%, sin recorte de %
  })

  it('nunca incluye Adicionales: el resultado depende únicamente de horas × valor por hora', () => {
    const result = hourlyWorkdayCalculator.calculate({
      totalAmount: 0,
      percentage: 50,
      usageMode: 'professional',
      workedTime: 1,
      workedTimeUnit: 'hours',
      hourlyRate: 30,
    })

    expect(result.realGain).toBe(30)
  })

  describe('applySeasonPercentage (D-015, opt-in por ingreso)', () => {
    it('por defecto (sin applySeasonPercentage) sigue sin aplicar el %, igual que D-011', () => {
      const result = hourlyWorkdayCalculator.calculate({
        totalAmount: 0,
        percentage: 70,
        usageMode: 'professional',
        workedTime: 10,
        workedTimeUnit: 'hours',
        hourlyRate: 120,
      })

      expect(result.realGain).toBe(1200)
    })

    it('applySeasonPercentage=false se comporta igual que no enviarlo', () => {
      const result = hourlyWorkdayCalculator.calculate({
        totalAmount: 0,
        percentage: 70,
        usageMode: 'professional',
        workedTime: 10,
        workedTimeUnit: 'hours',
        hourlyRate: 120,
        applySeasonPercentage: false,
      })

      expect(result.realGain).toBe(1200)
    })

    it('applySeasonPercentage=true recorta el 100% al % de temporada (caso de aceptación: 10h × 120€/h al 70%)', () => {
      const result = hourlyWorkdayCalculator.calculate({
        totalAmount: 0,
        percentage: 70,
        usageMode: 'professional',
        workedTime: 10,
        workedTimeUnit: 'hours',
        hourlyRate: 120,
        applySeasonPercentage: true,
      })

      expect(result.workedHours).toBe(10)
      expect(result.realGain).toBe(840) // 1200 × 70%
    })

    it('applySeasonPercentage=true con percentage=100 no altera el resultado', () => {
      const result = hourlyWorkdayCalculator.calculate({
        totalAmount: 0,
        percentage: 100,
        usageMode: 'professional',
        workedTime: 2,
        workedTimeUnit: 'hours',
        hourlyRate: 50,
        applySeasonPercentage: true,
      })

      expect(result.realGain).toBe(100)
    })

    it('applySeasonPercentage=true con percentage=0 produce realGain=0 (no se inventa un valor)', () => {
      const result = hourlyWorkdayCalculator.calculate({
        totalAmount: 0,
        percentage: 0,
        usageMode: 'professional',
        workedTime: 5,
        workedTimeUnit: 'hours',
        hourlyRate: 20,
        applySeasonPercentage: true,
      })

      expect(result.realGain).toBe(0)
    })
  })
})

describe('assertIncomeCalculationInputIsValid', () => {
  it('acepta service_duration sin exigir workedTime/hourlyRate', () => {
    expect(() =>
      assertIncomeCalculationInputIsValid('service_duration', {}),
    ).not.toThrow()
  })

  it('rechaza un método fuera del catálogo', () => {
    expect(() =>
      assertIncomeCalculationInputIsValid('comision' as never, {}),
    ).toThrow('Método de cálculo de ingreso no soportado: comision')
  })

  it.each([
    [{ workedTime: 0, hourlyRate: 20 }, 'El tiempo trabajado debe ser mayor a cero para Jornada por horas.'],
    [{ workedTime: -5, hourlyRate: 20 }, 'El tiempo trabajado debe ser mayor a cero para Jornada por horas.'],
    [{ workedTime: 60, hourlyRate: 0 }, 'El valor por hora debe ser mayor a cero.'],
    [{ workedTime: 60, hourlyRate: -1 }, 'El valor por hora debe ser mayor a cero.'],
  ])('hourly_workday rechaza %j', (input, message) => {
    expect(() => assertIncomeCalculationInputIsValid('hourly_workday', input)).toThrow(message)
  })

  it('acepta hourly_workday con workedTime y hourlyRate válidos', () => {
    expect(() =>
      assertIncomeCalculationInputIsValid('hourly_workday', { workedTime: 60, hourlyRate: 20 }),
    ).not.toThrow()
  })

  describe('applySeasonPercentage (D-015, fail-closed)', () => {
    it('rechaza hourly_workday con applySeasonPercentage=true y percentage ausente', () => {
      expect(() =>
        assertIncomeCalculationInputIsValid('hourly_workday', {
          workedTime: 60,
          hourlyRate: 20,
          applySeasonPercentage: true,
        }),
      ).toThrow('No hay un % de temporada válido para aplicar a este ingreso de Jornada por horas.')
    })

    it('rechaza hourly_workday con applySeasonPercentage=true y percentage=0', () => {
      expect(() =>
        assertIncomeCalculationInputIsValid('hourly_workday', {
          workedTime: 60,
          hourlyRate: 20,
          applySeasonPercentage: true,
          percentage: 0,
        }),
      ).toThrow('No hay un % de temporada válido para aplicar a este ingreso de Jornada por horas.')
    })

    it('acepta hourly_workday con applySeasonPercentage=true y percentage válido', () => {
      expect(() =>
        assertIncomeCalculationInputIsValid('hourly_workday', {
          workedTime: 60,
          hourlyRate: 20,
          applySeasonPercentage: true,
          percentage: 70,
        }),
      ).not.toThrow()
    })

    it('acepta hourly_workday con applySeasonPercentage=false sin percentage', () => {
      expect(() =>
        assertIncomeCalculationInputIsValid('hourly_workday', {
          workedTime: 60,
          hourlyRate: 20,
          applySeasonPercentage: false,
        }),
      ).not.toThrow()
    })
  })
})

describe('assertAdditionalAmountIsValid', () => {
  it.each([10, 99.5])('acepta %s', (amount) => {
    expect(() => assertAdditionalAmountIsValid(amount)).not.toThrow()
  })

  it.each([0, -1])('rechaza %s', (amount) => {
    expect(() => assertAdditionalAmountIsValid(amount)).toThrow(
      'El importe del adicional debe ser mayor que cero.',
    )
  })
})

describe('runIncomeCalculation', () => {
  it('despacha a serviceDurationCalculator por defecto cuando no se especifica método', () => {
    const result = runIncomeCalculation(undefined, {
      totalAmount: 100,
      percentage: 50,
      usageMode: 'professional',
      incomeType: 'ingreso',
    })

    expect(result.realGain).toBe(50)
  })

  it('despacha a hourlyWorkdayCalculator', () => {
    const result = runIncomeCalculation('hourly_workday', {
      totalAmount: 0,
      percentage: 50,
      usageMode: 'professional',
      workedTime: 2,
      workedTimeUnit: 'hours',
      hourlyRate: 25,
    })

    expect(result.realGain).toBe(50)
  })

  it('valida el input antes de calcular (rechaza hourly_workday sin tiempo trabajado)', () => {
    expect(() =>
      runIncomeCalculation('hourly_workday', {
        totalAmount: 0,
        percentage: 50,
        usageMode: 'professional',
        hourlyRate: 25,
      }),
    ).toThrow('El tiempo trabajado debe ser mayor a cero para Jornada por horas.')
  })

  it('despacha a hourlyWorkdayCalculator con applySeasonPercentage=true y aplica el %', () => {
    const result = runIncomeCalculation('hourly_workday', {
      totalAmount: 0,
      percentage: 70,
      usageMode: 'professional',
      workedTime: 10,
      workedTimeUnit: 'hours',
      hourlyRate: 120,
      applySeasonPercentage: true,
    })

    expect(result.realGain).toBe(840)
  })
})
