import { buildBalanceReport, type BalanceReportResult } from './balanceReportService'
import {
  runFinancialEngineShadowMode,
  type FinancialEngineShadowOptions,
} from './financialEngineShadowMode'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode, UsageMode } from '../types/settings'

interface BuildHomeBalanceSummaryInput {
  readonly incomes: readonly ServiceIncome[]
  readonly expenses: readonly Expense[]
  readonly currency: CurrencyCode
  readonly usageMode: UsageMode
  readonly earningPeriodId?: number
  readonly scope: 'home.current-month' | 'home.previous-month'
}

/**
 * Builds Home's official legacy report and runs the Financial Engine only as a
 * development parity observer. The returned object is always the legacy one.
 */
export function buildHomeBalanceSummary(
  input: BuildHomeBalanceSummaryInput,
  shadowOptions?: FinancialEngineShadowOptions,
): BalanceReportResult {
  const legacyBalanceReport = buildBalanceReport({
    incomes: [...input.incomes],
    expenses: [...input.expenses],
    currency: input.currency,
  })

  return runFinancialEngineShadowMode({
    incomes: input.incomes,
    expenses: input.expenses,
    currency: input.currency,
    usageMode: input.usageMode,
    earningPeriodId: input.earningPeriodId,
    legacyBalanceReport,
    scope: input.scope,
  }, shadowOptions)
}
