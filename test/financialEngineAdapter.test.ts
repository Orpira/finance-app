import { describe, expect, it } from 'vitest'

import { buildBalanceReport } from '../src/services/balanceReportService'
import { runFinancialEngine, type FinancialEngineInput } from '../src/services/financialEngineAdapter'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import type { CurrencyCode, UsageMode } from '../src/types/settings'
import { validateFinancialParity } from '../src/utils/financialParityValidator'
import { isAdjustmentIncome } from '../src/utils/incomeTypes'
import { getEffectiveFinancialDuration } from '../src/utils/serviceDuration'
import { recordBelongsToUsageMode } from '../src/utils/usageMode'

function createIncome(partial: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: partial.id,
    date: '2026-01-10',
    duration: 60,
    totalAmount: 0,
    currency: 'EUR',
    percentage: 0,
    realGain: 0,
    eurValue: 0,
    copValue: 0,
    exchangeRateUsed: 1,
    usageMode: 'basic',
    ...partial,
  }
}

function createExpense(partial: Partial<Expense> = {}): Expense {
  return {
    id: partial.id,
    type: 'gasto',
    date: '2026-01-10',
    category: 'General',
    amount: 0,
    currency: 'EUR',
    eurValue: 0,
    copValue: 0,
    usageMode: 'basic',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...partial,
  }
}

function filterByContext(
  records: readonly (ServiceIncome | Expense)[],
  usageMode: UsageMode,
  earningPeriodId?: number,
) {
  return records.filter((record) => {
    const matchesMode = recordBelongsToUsageMode(record, usageMode)
    const matchesPeriod =
      earningPeriodId === undefined ||
      record.earningPeriodId === earningPeriodId ||
      record.seasonPeriodId === earningPeriodId

    return matchesMode && matchesPeriod
  })
}

function buildInput(input: Partial<FinancialEngineInput> = {}): FinancialEngineInput {
  return {
    incomes: input.incomes,
    services: input.services,
    expenses: input.expenses ?? [],
    currency: input.currency ?? 'EUR',
    usageMode: input.usageMode ?? 'basic',
    earningPeriodId: input.earningPeriodId,
  }
}

function assertParity(input: FinancialEngineInput) {
  const sourceIncomes = input.incomes ?? input.services ?? []
  const filteredIncomes = filterByContext(sourceIncomes, input.usageMode, input.earningPeriodId) as ServiceIncome[]
  const filteredExpenses = filterByContext(input.expenses, input.usageMode, input.earningPeriodId) as Expense[]

  const expectedReport = buildBalanceReport({
    incomes: filteredIncomes,
    expenses: filteredExpenses,
    currency: input.currency,
  })

  const result = runFinancialEngine(input)

  expect(
    validateFinancialParity({
      legacyValue: expectedReport,
      newValue: result.balanceReport,
      context: {
        rule: 'balance.report.current',
        mode: input.usageMode,
        currency: input.currency,
      },
    }, { dev: false }),
  ).toBe(true)

  const expectedScheduled = filteredIncomes.reduce(
    (total, income) => total + income.duration,
    0,
  )
  const expectedActual = filteredIncomes.reduce(
    (total, income) => total + (getEffectiveFinancialDuration(income) ?? 0),
    0,
  )
  const expectedAdjustments =
    filteredIncomes.filter((income) => isAdjustmentIncome(income)).length +
    filteredExpenses.filter((expense) => expense.type === 'ajuste').length

  expect(result.scheduledMinutes).toBe(expectedScheduled)
  expect(result.actualMinutes).toBe(expectedActual)
  expect(result.incomeCount).toBe(filteredIncomes.length)
  expect(result.expenseCount).toBe(filteredExpenses.length)
  expect(result.adjustmentCount).toBe(expectedAdjustments)

  return result
}

describe('runFinancialEngine', () => {
  it('1) dataset vacío', () => {
    const result = assertParity(buildInput())

    expect(result.balanceReport.hasData).toBe(false)
    expect(result.appliedRules).toEqual(['balance.report.current'])
  })

  it('2) solo ingresos', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, type: 'ingreso', eurValue: 100, usageMode: 'basic' }),
        createIncome({ id: 2, type: 'otro', eurValue: 50, usageMode: 'basic' }),
      ],
      usageMode: 'basic',
    }))

    expect(result.balanceReport.incomeGrossTotal).toBe(150)
  })

  it('3) solo gastos', () => {
    const result = assertParity(buildInput({
      expenses: [
        createExpense({ id: 1, type: 'gasto', eurValue: 20, usageMode: 'basic' }),
        createExpense({ id: 2, type: 'gasto', eurValue: 80, usageMode: 'basic' }),
      ],
      usageMode: 'basic',
    }))

    expect(result.balanceReport.expenseTotal).toBe(100)
  })

  it('4) ajustes positivos', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, type: 'ajuste', eurValue: 30, usageMode: 'basic' }),
      ],
      expenses: [
        createExpense({ id: 2, type: 'ajuste', eurValue: 5, usageMode: 'basic' }),
      ],
      usageMode: 'basic',
    }))

    expect(result.balanceReport.adjustmentsPositiveTotal).toBe(35)
    expect(result.balanceReport.adjustmentsNegativeTotal).toBe(0)
  })

  it('5) ajustes negativos', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, type: 'ajuste', eurValue: -12, usageMode: 'basic' }),
      ],
      expenses: [
        createExpense({ id: 2, type: 'ajuste', eurValue: -8, usageMode: 'basic' }),
      ],
      usageMode: 'basic',
    }))

    expect(result.balanceReport.adjustmentsNegativeTotal).toBe(20)
    expect(result.balanceReport.adjustmentImpactTotal).toBe(-20)
  })

  it('6) modo básico', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, type: 'ingreso', eurValue: 200, usageMode: 'basic' }),
        createIncome({ id: 2, type: 'ingreso', eurValue: 999, usageMode: 'professional' }),
      ],
      expenses: [
        createExpense({ id: 3, type: 'gasto', eurValue: 60, usageMode: 'basic' }),
        createExpense({ id: 4, type: 'gasto', eurValue: 999, usageMode: 'professional' }),
      ],
      usageMode: 'basic',
    }))

    expect(result.incomeCount).toBe(1)
    expect(result.expenseCount).toBe(1)
    expect(result.balanceReport.generalBalance).toBe(140)
  })

  it('7) modo profesional', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, type: 'ingreso', eurValue: 999, usageMode: 'basic' }),
        createIncome({ id: 2, type: 'ingreso', eurValue: 240, usageMode: 'professional' }),
      ],
      expenses: [
        createExpense({ id: 3, type: 'gasto', eurValue: 999, usageMode: 'basic' }),
        createExpense({ id: 4, type: 'gasto', eurValue: 120, usageMode: 'professional' }),
      ],
      usageMode: 'professional',
    }))

    expect(result.incomeCount).toBe(1)
    expect(result.expenseCount).toBe(1)
    expect(result.balanceReport.generalBalance).toBe(120)
  })

  it('8) registros de ambos modos filtrados', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, usageMode: 'basic', eurValue: 10 }),
        createIncome({ id: 2, usageMode: 'professional', eurValue: 20 }),
        createIncome({ id: 3, usageMode: undefined, earningPeriodId: 80, eurValue: 30 }),
      ],
      expenses: [
        createExpense({ id: 4, usageMode: 'basic', eurValue: 3 }),
        createExpense({ id: 5, usageMode: 'professional', eurValue: 5 }),
        createExpense({ id: 6, usageMode: undefined, earningPeriodId: 80, eurValue: 7 }),
      ],
      usageMode: 'professional',
    }))

    expect(result.incomeCount).toBe(2)
    expect(result.expenseCount).toBe(2)
  })

  it('9) temporada concreta', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, usageMode: 'professional', earningPeriodId: 11, eurValue: 100 }),
        createIncome({ id: 2, usageMode: 'professional', seasonPeriodId: 11, eurValue: 50 }),
        createIncome({ id: 3, usageMode: 'professional', earningPeriodId: 99, eurValue: 999 }),
      ],
      expenses: [
        createExpense({ id: 4, usageMode: 'professional', earningPeriodId: 11, eurValue: 10 }),
        createExpense({ id: 5, usageMode: 'professional', seasonPeriodId: 11, eurValue: 5 }),
        createExpense({ id: 6, usageMode: 'professional', earningPeriodId: 99, eurValue: 999 }),
      ],
      usageMode: 'professional',
      earningPeriodId: 11,
    }))

    expect(result.balanceReport.incomeGrossTotal).toBe(150)
    expect(result.balanceReport.expenseTotal).toBe(15)
  })

  it('10) valores históricos convertidos', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({
          id: 1,
          usageMode: 'basic',
          baseCurrency: 'USD',
          baseCurrencyValue: 210,
          secondaryCurrency: 'EUR',
          secondaryCurrencyValue: 190,
          eurValue: 180,
          copValue: 800000,
        }),
      ],
      expenses: [
        createExpense({
          id: 2,
          usageMode: 'basic',
          baseCurrency: 'USD',
          baseCurrencyValue: 21,
          secondaryCurrency: 'EUR',
          secondaryCurrencyValue: 19,
          eurValue: 18,
          copValue: 80000,
        }),
      ],
      usageMode: 'basic',
      currency: 'USD' as CurrencyCode,
    }))

    expect(result.balanceReport.incomeGrossTotal).toBe(210)
    expect(result.balanceReport.expenseTotal).toBe(21)
  })

  it('11) actualDuration y fallback a duration', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, usageMode: 'basic', duration: 60, actualDuration: 40 }),
        createIncome({ id: 2, usageMode: 'basic', duration: 30 }),
      ],
      usageMode: 'basic',
    }))

    expect(result.scheduledMinutes).toBe(90)
    expect(result.actualMinutes).toBe(70)
  })

  it('12) orden diferente de los mismos registros', () => {
    const incomes = [
      createIncome({ id: 1, usageMode: 'basic', type: 'ingreso', eurValue: 100 }),
      createIncome({ id: 2, usageMode: 'basic', type: 'ajuste', eurValue: 20 }),
      createIncome({ id: 3, usageMode: 'basic', type: 'ingreso', eurValue: 80 }),
    ]
    const expenses = [
      createExpense({ id: 10, usageMode: 'basic', type: 'gasto', eurValue: 30 }),
      createExpense({ id: 11, usageMode: 'basic', type: 'ajuste', eurValue: -5 }),
    ]

    const resultA = runFinancialEngine(buildInput({ incomes, expenses, usageMode: 'basic' }))
    const resultB = runFinancialEngine(buildInput({
      incomes: [incomes[2], incomes[0], incomes[1]],
      expenses: [expenses[1], expenses[0]],
      usageMode: 'basic',
    }))

    expect(
      validateFinancialParity({
        legacyValue: resultA,
        newValue: resultB,
        context: { rule: 'engine.order.parity', mode: 'basic', currency: 'EUR' },
      }, { dev: false }),
    ).toBe(true)
  })

  it('13) entradas readonly/no mutadas', () => {
    const readonlyIncomes = [
      createIncome({ id: 1, usageMode: 'basic', type: 'ingreso', eurValue: 90 }),
      createIncome({ id: 2, usageMode: 'basic', type: 'ajuste', eurValue: -10 }),
    ] as const
    const readonlyExpenses = [
      createExpense({ id: 10, usageMode: 'basic', type: 'gasto', eurValue: 20 }),
    ] as const

    const frozenIncomes = Object.freeze(readonlyIncomes.map((income) => Object.freeze({ ...income })))
    const frozenExpenses = Object.freeze(readonlyExpenses.map((expense) => Object.freeze({ ...expense })))
    const originalIncomes = JSON.parse(JSON.stringify(frozenIncomes))
    const originalExpenses = JSON.parse(JSON.stringify(frozenExpenses))

    runFinancialEngine(buildInput({ incomes: frozenIncomes, expenses: frozenExpenses, usageMode: 'basic' }))

    expect(JSON.parse(JSON.stringify(frozenIncomes))).toEqual(originalIncomes)
    expect(JSON.parse(JSON.stringify(frozenExpenses))).toEqual(originalExpenses)
  })

  it('14) dataset con moneda no resoluble', () => {
    const result = assertParity(buildInput({
      incomes: [
        createIncome({ id: 1, usageMode: 'basic', eurValue: 200, copValue: 900000 }),
      ],
      expenses: [
        createExpense({ id: 2, usageMode: 'basic', eurValue: 100, copValue: 450000 }),
      ],
      usageMode: 'basic',
      currency: 'MXN' as CurrencyCode,
    }))

    expect(result.balanceReport.incomeGrossTotal).toBe(0)
    expect(result.balanceReport.expenseTotal).toBe(0)
  })

  it('15) dataset mixto con ajustes', () => {
    const result = assertParity(buildInput({
      services: [
        createIncome({ id: 1, usageMode: 'professional', type: 'ingreso', eurValue: 300, duration: 120 }),
        createIncome({ id: 2, usageMode: 'professional', type: 'ajuste', eurValue: 40, duration: 15, actualDuration: 10 }),
        createIncome({ id: 3, usageMode: 'professional', type: 'ajuste', eurValue: -12, duration: 20 }),
      ],
      expenses: [
        createExpense({ id: 4, usageMode: 'professional', type: 'gasto', eurValue: 80 }),
        createExpense({ id: 5, usageMode: 'professional', type: 'ajuste', eurValue: 7 }),
        createExpense({ id: 6, usageMode: 'professional', type: 'ajuste', eurValue: -5 }),
      ],
      usageMode: 'professional',
    }))

    expect(result.adjustmentCount).toBe(4)
    expect(result.balanceReport.generalBalance).toBe(250)
    expect(result.appliedRules).toEqual([
      'balance.report.current',
      'currency.stored_income_value',
      'currency.stored_expense_value',
      'income.adjustment_classification',
      'usage_mode.record_resolution',
      'duration.effective_financial',
    ])
  })
})
