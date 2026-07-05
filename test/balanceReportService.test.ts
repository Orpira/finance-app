import { describe, expect, it } from 'vitest'

import { buildBalanceReport } from '../src/services/balanceReportService'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'

function createIncome(partial: Partial<ServiceIncome>): ServiceIncome {
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
    ...partial,
  }
}

function createExpense(partial: Partial<Expense>): Expense {
  return {
    type: 'gasto',
    date: '2026-01-10',
    category: 'General',
    amount: 0,
    currency: 'EUR',
    eurValue: 0,
    copValue: 0,
    createdAt: '2026-01-10T10:00:00.000Z',
    ...partial,
  }
}

describe('buildBalanceReport', () => {
  it('returns empty totals when there is no data', () => {
    const report = buildBalanceReport({
      incomes: [],
      expenses: [],
      currency: 'EUR',
    })

    expect(report.hasData).toBe(false)
    expect(report.incomeGrossTotal).toBe(0)
    expect(report.expenseTotal).toBe(0)
    expect(report.adjustmentsPositiveTotal).toBe(0)
    expect(report.adjustmentsNegativeTotal).toBe(0)
    expect(report.generalBalance).toBe(0)
  })

  it('calculates positive balance when there are incomes and no expenses', () => {
    const report = buildBalanceReport({
      incomes: [
        createIncome({ type: 'ingreso', eurValue: 140 }),
        createIncome({ type: 'otro', eurValue: 60 }),
      ],
      expenses: [],
      currency: 'EUR',
    })

    expect(report.incomeGrossTotal).toBe(200)
    expect(report.expenseTotal).toBe(0)
    expect(report.netProfit).toBe(200)
    expect(report.generalBalance).toBe(200)
  })

  it('calculates negative balance when there are expenses and no incomes', () => {
    const report = buildBalanceReport({
      incomes: [],
      expenses: [
        createExpense({ type: 'gasto', eurValue: 50, category: 'Taxi' }),
        createExpense({ type: 'gasto', eurValue: 30, category: 'Comida' }),
      ],
      currency: 'EUR',
    })

    expect(report.incomeGrossTotal).toBe(0)
    expect(report.expenseTotal).toBe(80)
    expect(report.netProfit).toBe(-80)
    expect(report.generalBalance).toBe(-80)
  })

  it('separates adjustment impact from gross income and expenses', () => {
    const report = buildBalanceReport({
      incomes: [
        createIncome({ id: 1, type: 'ingreso', eurValue: 200 }),
        createIncome({ id: 2, type: 'ajuste', eurValue: 30, notes: 'Bono' }),
        createIncome({ id: 3, type: 'ajuste', eurValue: -10, notes: 'Corrección' }),
      ],
      expenses: [
        createExpense({ id: 10, type: 'gasto', eurValue: 70 }),
        createExpense({ id: 11, type: 'ajuste', eurValue: 5, notes: 'Reembolso menor' }),
        createExpense({ id: 12, type: 'ajuste', eurValue: -15, notes: 'Descuento extra' }),
      ],
      currency: 'EUR',
    })

    expect(report.incomeGrossTotal).toBe(200)
    expect(report.expenseTotal).toBe(70)
    expect(report.adjustmentsPositiveTotal).toBe(35)
    expect(report.adjustmentsNegativeTotal).toBe(25)
    expect(report.impactByAdjustments).toBe(10)
    expect(report.netProfit).toBe(130)
    expect(report.generalBalance).toBe(140)
    expect(report.adjustments).toHaveLength(4)
  })

  it('supports different datasets for professional vs basic mode consumers', () => {
    const professionalReport = buildBalanceReport({
      incomes: [
        createIncome({ type: 'ingreso', eurValue: 300, seasonPeriodId: 100 }),
        createIncome({ type: 'ajuste', eurValue: -20, seasonPeriodId: 100 }),
      ],
      expenses: [
        createExpense({ type: 'gasto', eurValue: 120, seasonPeriodId: 100 }),
      ],
      currency: 'EUR',
    })

    const basicReport = buildBalanceReport({
      incomes: [createIncome({ type: 'ingreso', eurValue: 90 })],
      expenses: [createExpense({ type: 'gasto', eurValue: 40 })],
      currency: 'EUR',
    })

    expect(professionalReport.generalBalance).toBe(160)
    expect(basicReport.generalBalance).toBe(50)
  })
})
