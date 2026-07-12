import { describe, expect, it, vi } from 'vitest'

import { buildBalanceReport } from '../src/services/balanceReportService'
import {
  runFinancialEngine,
  type FinancialEngineResult,
} from '../src/services/financialEngineAdapter'
import { buildHomeBalanceSummary } from '../src/services/homeBalanceSummaryService'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import type { CurrencyCode, UsageMode } from '../src/types/settings'

function income(partial: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    date: '2026-07-10',
    duration: 60,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 100,
    realGain: 100,
    eurValue: 100,
    copValue: 440000,
    exchangeRateUsed: 4400,
    usageMode: 'basic',
    ...partial,
  }
}

function expense(partial: Partial<Expense> = {}): Expense {
  return {
    id: 2,
    type: 'gasto',
    date: '2026-07-10',
    category: 'General',
    amount: 20,
    currency: 'EUR',
    eurValue: 20,
    copValue: 88000,
    usageMode: 'basic',
    createdAt: '2026-07-10T10:00:00.000Z',
    ...partial,
  }
}

function homeInput(options: {
  incomes?: ServiceIncome[]
  expenses?: Expense[]
  currency?: CurrencyCode
  usageMode?: UsageMode
  earningPeriodId?: number
} = {}) {
  return {
    incomes: options.incomes ?? [income()],
    expenses: options.expenses ?? [expense()],
    currency: options.currency ?? 'EUR' as CurrencyCode,
    usageMode: options.usageMode ?? 'basic' as UsageMode,
    earningPeriodId: options.earningPeriodId,
    scope: 'home.current-month' as const,
  }
}

function divergentRunner(input: Parameters<typeof runFinancialEngine>[0]): FinancialEngineResult {
  const result = runFinancialEngine(input)
  return {
    ...result,
    balanceReport: {
      ...result.balanceReport,
      generalBalance: result.balanceReport.generalBalance + 0.01,
    },
  }
}

describe('buildHomeBalanceSummary shadow consumer', () => {
  it.each([
    ['basic mode', homeInput()],
    ['professional mode', homeInput({
      usageMode: 'professional',
      earningPeriodId: 9,
      incomes: [income({ usageMode: 'professional', earningPeriodId: 9 })],
      expenses: [expense({ usageMode: 'professional', earningPeriodId: 9 })],
    })],
    ['positive and negative adjustments', homeInput({
      incomes: [income({ type: 'ajuste', eurValue: 15 })],
      expenses: [expense({ type: 'ajuste', eurValue: -4 })],
    })],
    ['historical currency', homeInput({
      currency: 'USD',
      incomes: [income({ baseCurrency: 'USD', baseCurrencyValue: 115 })],
      expenses: [expense({ baseCurrency: 'USD', baseCurrencyValue: 23 })],
    })],
    ['empty dataset', homeInput({ incomes: [], expenses: [] })],
  ])('has exact Home parity for %s', (_label, input) => {
    const logger = vi.fn()
    buildHomeBalanceSummary(input, { dev: true, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('detects a difference of 0.01 in Home', () => {
    const logger = vi.fn()
    buildHomeBalanceSummary(homeInput(), { dev: true, logger, engineRunner: divergentRunner })
    expect(logger).toHaveBeenCalledWith(
      '[financial-parity] Divergence detected',
      expect.objectContaining({ scope: 'home.current-month', field: 'balanceReport' }),
    )
  })

  it('keeps Home operational when the adapter fails', () => {
    const input = homeInput()
    const expected = buildBalanceReport(input)
    const result = buildHomeBalanceSummary(input, {
      dev: false,
      engineRunner: () => { throw new Error('adapter failure') },
    })
    expect(result).toEqual(expected)
  })

  it('does not log in production', () => {
    const logger = vi.fn()
    buildHomeBalanceSummary(homeInput(), { dev: false, logger, engineRunner: divergentRunner })
    expect(logger).not.toHaveBeenCalled()
  })

  it('keeps the legacy report as Home official result', () => {
    const input = homeInput()
    const expected = buildBalanceReport(input)
    const result = buildHomeBalanceSummary(input, {
      dev: false,
      engineRunner: divergentRunner,
    })
    expect(result).toEqual(expected)
    expect(result.generalBalance).toBe(80)
  })
})
