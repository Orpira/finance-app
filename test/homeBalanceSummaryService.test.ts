import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildBalanceReport } from '../src/services/balanceReportService'
import {
  runFinancialEngine,
  type FinancialEngineResult,
} from '../src/services/financialEngineAdapter'
import { buildHomeBalanceSummary } from '../src/services/homeBalanceSummaryService'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import type { CurrencyCode, UsageMode } from '../src/types/settings'
import type { SnapshotShadowModeInput } from '../src/services/snapshotShadowModeService'
import type { CivilDate, IanaTimeZone, SnapshotCandidateId, SnapshotNormativeCode, UtcInstant } from '../src/types/financialSnapshot'

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
  incomes?: readonly ServiceIncome[]
  expenses?: readonly Expense[]
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

function snapshotContext() {
  return {
    periodStart: '2026-07-01' as CivilDate,
    periodEndExclusive: '2026-08-01' as CivilDate,
    asOf: '2026-07-14T10:00:00.000Z' as UtcInstant,
    timezone: 'Europe/Madrid' as IanaTimeZone,
    candidateId: 'home:test' as SnapshotCandidateId,
    generatedAt: '2026-07-14T10:00:00.000Z' as UtcInstant,
    sealedAt: '2026-07-14T10:00:00.000Z' as UtcInstant,
    persistedAt: '2026-07-14T10:00:00.000Z' as UtcInstant,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
  }
}

describe('buildHomeBalanceSummary controlled pilot', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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

  it('uses legacy when the flag is absent', () => {
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', undefined)
    const input = homeInput()
    const expected = buildBalanceReport(input)
    const result = buildHomeBalanceSummary(input, {
      dev: false,
      engineRunner: divergentRunner,
    })
    expect(result).toEqual(expected)
    expect(result.generalBalance).toBe(80)
  })

  it('uses legacy when the flag is false', () => {
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'false')
    const input = homeInput()
    const result = buildHomeBalanceSummary(input, {
      dev: false,
      engineRunner: divergentRunner,
    })
    expect(result.generalBalance).toBe(80)
  })

  it('uses the Financial Engine when the flag is true', () => {
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'true')
    const result = buildHomeBalanceSummary(homeInput(), {
      dev: false,
      engineRunner: divergentRunner,
    })
    expect(result.generalBalance).toBe(80.01)
  })

  it('rolls back immediately to legacy when the flag is disabled', () => {
    const input = homeInput()
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'true')
    const enabled = buildHomeBalanceSummary(input, {
      dev: false,
      engineRunner: divergentRunner,
    })
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'false')
    const disabled = buildHomeBalanceSummary(input, {
      dev: false,
      engineRunner: divergentRunner,
    })
    expect(enabled.generalBalance).toBe(80.01)
    expect(disabled.generalBalance).toBe(80)
  })

  it.each(['TRUE', '1', 'yes', ' true ', 'invalid'])(
    'uses legacy when the flag has invalid value %j',
    (value) => {
      vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', value)
      const result = buildHomeBalanceSummary(homeInput(), {
        dev: false,
        engineRunner: divergentRunner,
      })
      expect(result.generalBalance).toBe(80)
    },
  )

  it('does not mutate readonly inputs', () => {
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'true')
    const incomes = Object.freeze([Object.freeze(income())])
    const expenses = Object.freeze([Object.freeze(expense())])
    const before = JSON.stringify({ incomes, expenses })
    buildHomeBalanceSummary(homeInput({ incomes, expenses }), {
      dev: false,
    })
    expect(JSON.stringify({ incomes, expenses })).toBe(before)
  })

  it('reuses the existing engine result for Snapshot and always returns the official result', () => {
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'false')
    const engineRunner = vi.fn(runFinancialEngine)
    const snapshotRunner = vi.fn(async (input: SnapshotShadowModeInput) => input.consumer)
    const result = buildHomeBalanceSummary({
      ...homeInput(),
      snapshotShadow: snapshotContext(),
    }, { engineRunner, snapshotRunner, dev: false })
    expect(result.generalBalance).toBe(80)
    expect(engineRunner).toHaveBeenCalledOnce()
    expect(snapshotRunner).toHaveBeenCalledWith(expect.objectContaining({
      financialEngineResult: engineRunner.mock.results[0].value,
    }))
  })

  it('keeps the official result when Snapshot fails synchronously or asynchronously', async () => {
    vi.stubEnv('VITE_FINANCIAL_ENGINE_HOME_ENABLED', 'true')
    const input = { ...homeInput(), snapshotShadow: snapshotContext() }
    for (const snapshotRunner of [
      () => { throw new Error('sync') },
      async () => { throw new Error('async') },
    ]) {
      const result = buildHomeBalanceSummary(input, {
        engineRunner: divergentRunner,
        snapshotRunner,
        dev: false,
      })
      expect(result.generalBalance).toBe(80.01)
    }
    await Promise.resolve()
  })
})
