import { describe, expect, it } from 'vitest'

import { buildBalanceReport } from '../src/services/balanceReportService'
import {
  buildFinancialBalanceAsOf,
  buildFinancialBalanceText,
  isValidCutoff,
} from '../src/services/financialBalanceService'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'

function createIncome(partial: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    date: '2026-01-10',
    duration: 60,
    totalAmount: 0,
    currency: 'EUR',
    percentage: 0,
    realGain: 0,
    eurValue: 0,
    copValue: 0,
    exchangeRateUsed: 1,
    usageMode: 'professional',
    ...partial,
  }
}

function createExpense(partial: Partial<Expense> = {}): Expense {
  return {
    type: 'gasto',
    date: '2026-01-10',
    category: 'General',
    amount: 0,
    currency: 'EUR',
    eurValue: 0,
    copValue: 0,
    usageMode: 'professional',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...partial,
  }
}

// Dataset de referencia del diseño: P = 5200, A = 1000, E = 2100, ajustes = -100 → 4000
const referenceIncomes: ServiceIncome[] = [
  createIncome({ id: 1, date: '2026-03-01', realGain: 3000, eurValue: 3000, totalAmount: 3000, additionalsTotal: 600 }),
  createIncome({ id: 2, date: '2026-09-15', realGain: 2200, eurValue: 2200, totalAmount: 2200, additionalsTotal: 400 }),
]
const referenceExpenses: Expense[] = [
  createExpense({ id: 1, date: '2026-04-01', amount: 2100, eurValue: 2100 }),
  createExpense({ id: 2, date: '2026-10-01', type: 'ajuste', amount: -100, eurValue: -100 }),
]

function build(cutoff: string, overrides: Partial<Parameters<typeof buildFinancialBalanceAsOf>[0]> = {}) {
  return buildFinancialBalanceAsOf({
    incomes: referenceIncomes,
    expenses: referenceExpenses,
    currency: 'EUR',
    usageMode: 'professional',
    cutoff,
    ...overrides,
  })
}

describe('financialBalanceService', () => {
  it('reproduce el dataset de referencia: (P + A) - E + ajustes = 4000', () => {
    const result = build('2026-10-30')

    expect(result.principalIncomeTotal).toBe(5200)
    expect(result.additionalIncomeTotal).toBe(1000)
    expect(result.report.incomeGrossTotal).toBe(6200)
    expect(result.report.expenseTotal).toBe(2100)
    expect(result.report.adjustmentImpactTotal).toBe(-100)
    expect(result.report.generalBalance).toBe(4000)
    expect(result.report.netProfit).toBe(3100)
  })

  it('coincide exactamente con buildBalanceReport cuando el corte incluye todo', () => {
    const result = build('2026-12-31')
    expect(result.report).toEqual(
      buildBalanceReport({ incomes: referenceIncomes, expenses: referenceExpenses, currency: 'EUR' }),
    )
  })

  it('acumula hasta la fecha de corte inclusive y excluye movimientos posteriores', () => {
    const result = build('2026-09-15')
    // Entran: ingreso 1 (3600), ingreso 2 (2600, mismo día del corte), gasto 2100. Ajuste del 1/10 fuera.
    expect(result.report.incomeGrossTotal).toBe(6200)
    expect(result.report.adjustmentImpactTotal).toBe(0)
    expect(result.report.generalBalance).toBe(4100)

    const earlier = build('2026-03-31')
    expect(earlier.report.incomeGrossTotal).toBe(3600)
    expect(earlier.report.expenseTotal).toBe(0)
    expect(earlier.report.generalBalance).toBe(3600)
  })

  it('es acumulado, no mensual: un corte en octubre incluye meses anteriores', () => {
    const result = build('2026-10-30')
    expect(result.incomeCount).toBe(2)
    expect(result.expenseCount).toBe(2)
  })

  it('trata fechas con hora usando solo la fecha civil', () => {
    const result = build('2026-03-01', {
      incomes: [createIncome({ date: '2026-03-01T23:30:00', realGain: 100, eurValue: 100 })],
      expenses: [],
    })
    expect(result.report.generalBalance).toBe(100)
  })

  it('no mezcla modos: los registros del otro modo no cuentan', () => {
    const basicIncome = createIncome({ id: 9, usageMode: 'basic', realGain: 999, eurValue: 999 })
    const basicExpense = createExpense({ id: 9, usageMode: 'basic', amount: 50, eurValue: 50 })

    const professional = build('2026-10-30', {
      incomes: [...referenceIncomes, basicIncome],
      expenses: [...referenceExpenses, basicExpense],
    })
    expect(professional.report.generalBalance).toBe(4000)

    const basic = build('2026-10-30', {
      incomes: [...referenceIncomes, basicIncome],
      expenses: [...referenceExpenses, basicExpense],
      usageMode: 'basic',
    })
    expect(basic.report.generalBalance).toBe(949)
  })

  it('aplica cada ajuste exactamente una vez', () => {
    const result = build('2026-10-30')
    expect(result.adjustmentCount).toBe(1)
    expect(result.report.adjustments).toHaveLength(1)
    expect(result.report.expenseTotal).toBe(2100)
  })

  it('no modifica los registros de entrada', () => {
    const incomesCopy = structuredClone(referenceIncomes)
    const expensesCopy = structuredClone(referenceExpenses)
    build('2026-10-30')
    expect(referenceIncomes).toEqual(incomesCopy)
    expect(referenceExpenses).toEqual(expensesCopy)
  })

  it('rechaza una fecha de corte inválida (fail-closed)', () => {
    expect(isValidCutoff('2026-02-30')).toBe(false)
    expect(isValidCutoff('30/10/2026')).toBe(false)
    expect(isValidCutoff('2026-10-30')).toBe(true)
    expect(() => build('2026-13-01')).toThrow('INVALID_FINANCIAL_BALANCE_CUTOFF')
  })

  it('devuelve un balance vacío sin datos', () => {
    const result = build('2026-10-30', { incomes: [], expenses: [] })
    expect(result.report.hasData).toBe(false)
    expect(result.report.generalBalance).toBe(0)
  })

  it('la exportación de texto usa las mismas cifras que la pantalla', () => {
    const result = build('2026-10-30')
    const text = buildFinancialBalanceText(result, (value) => value.toFixed(2))
    expect(text).toContain('Fecha de corte: 2026-10-30')
    expect(text).toContain('Balance neto acumulado: 4000.00')
    expect(text).toContain('Ingresos principales: 5200.00')
    expect(text).toContain('Ingresos adicionales: 1000.00')
    expect(text).toContain('Egresos: 2100.00')
    expect(text).toContain('Impacto neto de ajustes: -100.00')
  })
})
