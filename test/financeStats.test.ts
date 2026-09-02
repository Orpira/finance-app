import { describe, expect, it } from 'vitest'

import {
  getStoredAdditionalsValue,
  getStoredExpenseValue,
  getStoredIncomePrincipalValue,
  getStoredIncomeValue,
  sumIncomeAdditionalsValue,
} from '../src/utils/financeStats'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    date: '2026-01-01',
    duration: 0,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 50,
    // realGain/eurValue/copValue/baseCurrencyValue reflejan SOLO el importe
    // principal (servicio u horas) — nunca incluyen additionalsTotal, ese es
    // el invariante del registro del ingreso.
    realGain: 50,
    eurValue: 50,
    copValue: 215000,
    baseCurrency: 'EUR',
    baseCurrencyValue: 50,
    secondaryCurrency: 'COP',
    secondaryCurrencyValue: 215000,
    exchangeRateUsed: 4300,
    additionalsTotal: 20,
    ...overrides,
  }
}

describe('getStoredAdditionalsValue', () => {
  it('devuelve la porción de additionalsTotal ya convertida a la moneda pedida', () => {
    // additionalsTotal (20) escalado con la misma tasa que realGain->eurValue (1:1 en EUR)
    expect(getStoredAdditionalsValue(income(), 'EUR')).toBe(20)
  })

  it('escala correctamente a una moneda secundaria', () => {
    // additionalsTotal (20) × tasa EUR→COP (4300) = 86000
    expect(getStoredAdditionalsValue(income(), 'COP')).toBe(86000)
  })

  it('devuelve 0 cuando el ingreso no tiene adicionales', () => {
    expect(getStoredAdditionalsValue(income({ additionalsTotal: 0 }), 'EUR')).toBe(0)
    expect(getStoredAdditionalsValue(income({ additionalsTotal: undefined }), 'EUR')).toBe(0)
  })

  it('conserva el adicional en la moneda original cuando la ganancia del servicio es 0', () => {
    expect(
      getStoredAdditionalsValue(income({ realGain: 0, additionalsTotal: 20 }), 'EUR'),
    ).toBe(20)
  })
})

describe('sumIncomeAdditionalsValue', () => {
  it('suma la porción de adicionales de varios ingresos en la moneda pedida', () => {
    const incomes = [income(), income({ additionalsTotal: 0, realGain: 50 })]
    expect(sumIncomeAdditionalsValue(incomes, 'EUR')).toBe(20)
  })

  it('devuelve 0 para una lista vacía', () => {
    expect(sumIncomeAdditionalsValue([], 'EUR')).toBe(0)
  })
})

describe('getStoredIncomeValue', () => {
  it('mantiene el importe principal separado para superficies de movimiento individual', () => {
    expect(getStoredIncomePrincipalValue(income(), 'EUR')).toBe(50)
  })

  it('para agregados de balance, suma el importe principal + la porción de Adicionales', () => {
    // baseCurrencyValue (50, principal) + additionalsTotal convertido (20) = 70
    expect(getStoredIncomeValue(income(), 'EUR')).toBe(70)
  })

  it('sin adicionales, devuelve exactamente el valor principal almacenado (regresión)', () => {
    expect(getStoredIncomeValue(income({ additionalsTotal: 0 }), 'EUR')).toBe(50)
  })

  it('escala correctamente en una moneda secundaria', () => {
    // baseCurrencyValue no aplica (currency pedida es COP): copValue (215000) + adicional convertido (86000)
    expect(getStoredIncomeValue(income(), 'COP')).toBe(301000)
  })

  it('usa realGain en la moneda original para registros históricos sin snapshots base', () => {
    expect(
      getStoredIncomeValue(
        income({
          currency: 'USD',
          realGain: 30,
          baseCurrency: undefined,
          baseCurrencyValue: undefined,
          additionalsTotal: 0,
        }),
        'USD',
      ),
    ).toBe(30)
  })
})

describe('calculateFinancialTotals', () => {
  it('ADR-035: Ingresos = solo principal, Adicionales quedan aparte y Ganancia los excluye', async () => {
    const { calculateFinancialTotals } = await import('../src/utils/financeStats')
    const totals = calculateFinancialTotals(
      [income()],
      [{
        type: 'gasto',
        date: '2026-01-01',
        category: 'General',
        amount: 10,
        currency: 'EUR',
        eurValue: 10,
        copValue: 43000,
        baseCurrency: 'EUR',
        baseCurrencyValue: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
      'EUR',
      'COP',
    )

    expect(totals.primaryIncome).toBe(50)
    expect(totals.primaryAdditionals).toBe(20)
    expect(totals.primaryGain).toBe(50)
    expect(totals.primaryNet).toBe(40)
  })

  it('caso de referencia: ingreso base 80, adicional 10, egreso 10 -> Ingresos 80, Adicionales 10, Ganancia 70', async () => {
    const { calculateFinancialTotals } = await import('../src/utils/financeStats')
    const totals = calculateFinancialTotals(
      [income({
        totalAmount: 80,
        realGain: 80,
        eurValue: 80,
        copValue: 344000,
        baseCurrencyValue: 80,
        secondaryCurrencyValue: 344000,
        additionalsTotal: 10,
      })],
      [{
        type: 'gasto',
        date: '2026-01-01',
        category: 'General',
        amount: 10,
        currency: 'EUR',
        eurValue: 10,
        copValue: 43000,
        baseCurrency: 'EUR',
        baseCurrencyValue: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
      'EUR',
      'COP',
    )

    expect(totals.primaryIncome).toBe(80)
    expect(totals.primaryAdditionals).toBe(10)
    expect(totals.primaryExpenses).toBe(10)
    expect(totals.primaryNet).toBe(70)
  })

  it('caso sin egresos: ingreso base 80, adicional 10, egresos 0 -> Ganancia 80', async () => {
    const { calculateFinancialTotals } = await import('../src/utils/financeStats')
    const totals = calculateFinancialTotals(
      [income({
        totalAmount: 80,
        realGain: 80,
        eurValue: 80,
        copValue: 344000,
        baseCurrencyValue: 80,
        secondaryCurrencyValue: 344000,
        additionalsTotal: 10,
      })],
      [],
      'EUR',
      'COP',
    )

    expect(totals.primaryIncome).toBe(80)
    expect(totals.primaryAdditionals).toBe(10)
    expect(totals.primaryExpenses).toBe(0)
    expect(totals.primaryNet).toBe(80)
  })

  it('caso sin adicionales: ingreso base 80, adicional 0, egreso 10 -> Ganancia 70', async () => {
    const { calculateFinancialTotals } = await import('../src/utils/financeStats')
    const totals = calculateFinancialTotals(
      [income({
        totalAmount: 80,
        realGain: 80,
        eurValue: 80,
        copValue: 344000,
        baseCurrencyValue: 80,
        secondaryCurrencyValue: 344000,
        additionalsTotal: 0,
      })],
      [{
        type: 'gasto',
        date: '2026-01-01',
        category: 'General',
        amount: 10,
        currency: 'EUR',
        eurValue: 10,
        copValue: 43000,
        baseCurrency: 'EUR',
        baseCurrencyValue: 10,
        createdAt: '2026-01-01T00:00:00.000Z',
      }],
      'EUR',
      'COP',
    )

    expect(totals.primaryIncome).toBe(80)
    expect(totals.primaryAdditionals).toBe(0)
    expect(totals.primaryExpenses).toBe(10)
    expect(totals.primaryNet).toBe(70)
  })
})

describe('getStoredExpenseValue', () => {
  it('usa amount en la moneda original para registros históricos sin snapshots base', () => {
    const expense: Expense = {
      type: 'gasto',
      date: '2026-01-01',
      category: 'Materiales',
      amount: 25,
      currency: 'USD',
      eurValue: 0,
      copValue: 0,
      createdAt: '2026-01-01T10:00:00.000Z',
    }

    expect(getStoredExpenseValue(expense, 'USD')).toBe(25)
  })
})
