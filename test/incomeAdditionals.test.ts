import { describe, expect, it } from 'vitest'

import {
  assertAdditionalAmountIsValid,
  assertAllIncomeAdditionalsAreValid,
  calculateAdditionalsTotal,
} from '../src/utils/incomeAdditionals'

describe('assertAdditionalAmountIsValid', () => {
  it.each([10, 250.5])('acepta %s (> 0)', (amount) => {
    expect(() => assertAdditionalAmountIsValid(amount)).not.toThrow()
  })

  it.each([0, -1, -0.01, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza %s',
    (amount) => {
      expect(() => assertAdditionalAmountIsValid(amount)).toThrow(
        'El importe del adicional debe ser mayor que cero.',
      )
    },
  )
})

describe('calculateAdditionalsTotal', () => {
  it('suma los importes de todos los adicionales', () => {
    expect(
      calculateAdditionalsTotal([{ amount: 10 }, { amount: 5.5 }, { amount: 0 }]),
    ).toBe(15.5)
  })

  it('devuelve 0 para una lista vacía', () => {
    expect(calculateAdditionalsTotal([])).toBe(0)
  })
})

describe('assertAllIncomeAdditionalsAreValid', () => {
  const incomes = [{ id: 1 }, { id: 2 }]

  it('no lanza cuando todos los adicionales referencian ingresos existentes con importes válidos', () => {
    expect(() =>
      assertAllIncomeAdditionalsAreValid(incomes, [
        { incomeId: 1, amount: 10 },
        { incomeId: 2, amount: 5 },
      ]),
    ).not.toThrow()
  })

  it('lanza si un adicional referencia un incomeId inexistente', () => {
    expect(() =>
      assertAllIncomeAdditionalsAreValid(incomes, [{ incomeId: 999, amount: 10 }]),
    ).toThrow(/ingreso inexistente/)
  })

  it('lanza si un adicional no tiene un importe positivo', () => {
    expect(() =>
      assertAllIncomeAdditionalsAreValid(incomes, [{ incomeId: 1, amount: -5 }]),
    ).toThrow('El importe del adicional debe ser mayor que cero.')
  })
})
