import { describe, expect, it, vi } from 'vitest'

import { buildBalanceReport } from '../src/services/balanceReportService'
import {
  runFinancialEngine,
  type FinancialEngineResult,
} from '../src/services/financialEngineAdapter'
import { runFinancialEngineShadowMode } from '../src/services/financialEngineShadowMode'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import type { CurrencyCode, UsageMode } from '../src/types/settings'

function createIncome(partial: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    date: '2026-01-10',
    duration: 60,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 100,
    realGain: 100,
    eurValue: 100,
    copValue: 430000,
    exchangeRateUsed: 4300,
    usageMode: 'basic',
    ...partial,
  }
}

function createExpense(partial: Partial<Expense> = {}): Expense {
  return {
    id: 2,
    type: 'gasto',
    date: '2026-01-10',
    category: 'General',
    amount: 20,
    currency: 'EUR',
    eurValue: 20,
    copValue: 86000,
    usageMode: 'basic',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...partial,
  }
}

function buildShadowInput(options: {
  incomes?: ServiceIncome[]
  expenses?: Expense[]
  currency?: CurrencyCode
  usageMode?: UsageMode
  earningPeriodId?: number
} = {}) {
  const incomes = options.incomes ?? [createIncome()]
  const expenses = options.expenses ?? [createExpense()]
  const currency = options.currency ?? 'EUR'
  const usageMode = options.usageMode ?? 'basic'
  const legacyBalanceReport = buildBalanceReport({ incomes, expenses, currency })

  return {
    incomes,
    expenses,
    currency,
    usageMode,
    earningPeriodId: options.earningPeriodId,
    legacyBalanceReport,
    scope: 'test.reports.balance',
  }
}

function divergentRunner(delta = 0.01) {
  return (input: Parameters<typeof runFinancialEngine>[0]): FinancialEngineResult => {
    const result = runFinancialEngine(input)
    return {
      ...result,
      balanceReport: {
        ...result.balanceReport,
        generalBalance: result.balanceReport.generalBalance + delta,
      },
    }
  }
}

describe('runFinancialEngineShadowMode', () => {
  it('detects exact parity without logging', () => {
    const logger = vi.fn()
    runFinancialEngineShadowMode(buildShadowInput(), { dev: true, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('detects a divergence of 0.01', () => {
    const logger = vi.fn()
    runFinancialEngineShadowMode(buildShadowInput(), {
      dev: true,
      logger,
      engineRunner: divergentRunner(),
    })
    expect(logger).toHaveBeenCalledWith(
      '[financial-parity] Divergence detected',
      expect.objectContaining({ field: 'balanceReport' }),
    )
  })

  it('supports basic mode', () => {
    const logger = vi.fn()
    runFinancialEngineShadowMode(buildShadowInput({ usageMode: 'basic' }), { dev: true, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('supports professional mode and a concrete season', () => {
    const logger = vi.fn()
    const earningPeriodId = 17
    const input = buildShadowInput({
      usageMode: 'professional',
      earningPeriodId,
      incomes: [createIncome({ usageMode: 'professional', earningPeriodId })],
      expenses: [createExpense({ usageMode: 'professional', earningPeriodId })],
    })
    runFinancialEngineShadowMode(input, { dev: true, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('supports income and expense adjustments', () => {
    const logger = vi.fn()
    const input = buildShadowInput({
      incomes: [createIncome({ type: 'ajuste', eurValue: 10 })],
      expenses: [createExpense({ type: 'ajuste', eurValue: -5 })],
    })
    runFinancialEngineShadowMode(input, { dev: true, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('uses stored historical currency values', () => {
    const logger = vi.fn()
    const input = buildShadowInput({
      currency: 'USD',
      incomes: [createIncome({ baseCurrency: 'USD', baseCurrencyValue: 110 })],
      expenses: [createExpense({ baseCurrency: 'USD', baseCurrencyValue: 22 })],
    })
    runFinancialEngineShadowMode(input, { dev: true, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('logs a difference in development with allowed context only', () => {
    const logger = vi.fn()
    runFinancialEngineShadowMode(buildShadowInput(), {
      dev: true,
      logger,
      engineRunner: divergentRunner(),
    })
    expect(logger).toHaveBeenCalledWith(
      '[financial-parity] Divergence detected',
      expect.objectContaining({
        scope: 'test.reports.balance',
        usageMode: 'basic',
        currency: 'EUR',
        incomeCount: 1,
        expenseCount: 1,
        field: 'balanceReport',
      }),
    )
  })

  it('does not log a difference in production', () => {
    const logger = vi.fn()
    runFinancialEngineShadowMode(buildShadowInput(), {
      dev: false,
      logger,
      engineRunner: divergentRunner(),
    })
    expect(logger).not.toHaveBeenCalled()
  })

  it('always returns the exact legacy object as the official result', () => {
    const input = buildShadowInput()
    const officialResult = runFinancialEngineShadowMode(input, {
      dev: false,
      engineRunner: divergentRunner(500),
    })
    expect(officialResult).toBe(input.legacyBalanceReport)
    expect(officialResult.generalBalance).toBe(80)
  })

  it('swallows engine failures and keeps the legacy result', () => {
    const input = buildShadowInput()
    const officialResult = runFinancialEngineShadowMode(input, {
      dev: false,
      engineRunner: () => {
        throw new Error('shadow failure')
      },
    })
    expect(officialResult).toBe(input.legacyBalanceReport)
  })
})
