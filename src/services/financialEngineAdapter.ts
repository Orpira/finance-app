import { buildBalanceReport, type BalanceReportResult } from './balanceReportService'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode, UsageMode } from '../types/settings'
import { isAdjustmentIncome } from '../utils/incomeTypes'
import { getEffectiveFinancialDuration } from '../utils/serviceDuration'
import { recordBelongsToUsageMode } from '../utils/usageMode'

export interface FinancialEngineInput {
  readonly incomes?: readonly ServiceIncome[]
  readonly services?: readonly ServiceIncome[]
  readonly expenses: readonly Expense[]
  readonly currency: CurrencyCode
  readonly usageMode: UsageMode
  readonly earningPeriodId?: number
}

export interface FinancialEngineResult {
  readonly balanceReport: BalanceReportResult
  readonly scheduledMinutes: number
  readonly actualMinutes: number
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
  readonly engineVersion: string
  readonly appliedRules: readonly string[]
}

const FINANCIAL_ENGINE_ADAPTER_VERSION = '1.0.0-phase-1a-minimal'

const APPLIED_RULE_ORDER = [
  'balance.report.current',
  'currency.stored_income_value',
  'currency.stored_expense_value',
  'income.adjustment_classification',
  'usage_mode.record_resolution',
  'duration.effective_financial',
] as const

function belongsToEarningPeriod(
  record: Pick<ServiceIncome | Expense, 'earningPeriodId' | 'seasonPeriodId'>,
  earningPeriodId?: number,
) {
  if (earningPeriodId === undefined) {
    return true
  }

  return (
    record.earningPeriodId === earningPeriodId ||
    record.seasonPeriodId === earningPeriodId
  )
}

export function runFinancialEngine(input: FinancialEngineInput): FinancialEngineResult {
  const sourceIncomes = input.incomes ?? input.services ?? []

  const incomes = sourceIncomes.filter(
    (income) =>
      recordBelongsToUsageMode(income, input.usageMode) &&
      belongsToEarningPeriod(income, input.earningPeriodId),
  )
  const expenses = input.expenses.filter(
    (expense) =>
      recordBelongsToUsageMode(expense, input.usageMode) &&
      belongsToEarningPeriod(expense, input.earningPeriodId),
  )

  const balanceReport = buildBalanceReport({
    incomes,
    expenses,
    currency: input.currency,
  })

  const scheduledMinutes = incomes.reduce(
    (total, income) => total + income.duration,
    0,
  )
  const actualMinutes = incomes.reduce(
    (total, income) => total + (getEffectiveFinancialDuration(income) ?? 0),
    0,
  )
  const adjustmentCount =
    incomes.filter((income) => isAdjustmentIncome(income)).length +
    expenses.filter((expense) => expense.type === 'ajuste').length

  const appliedRules = new Set<string>()
  appliedRules.add('balance.report.current')

  if (sourceIncomes.length > 0 || input.expenses.length > 0) {
    appliedRules.add('usage_mode.record_resolution')
  }
  if (incomes.length > 0) {
    appliedRules.add('currency.stored_income_value')
    appliedRules.add('income.adjustment_classification')
    appliedRules.add('duration.effective_financial')
  }
  if (expenses.length > 0) {
    appliedRules.add('currency.stored_expense_value')
  }

  return {
    balanceReport,
    scheduledMinutes,
    actualMinutes,
    incomeCount: incomes.length,
    expenseCount: expenses.length,
    adjustmentCount,
    engineVersion: FINANCIAL_ENGINE_ADAPTER_VERSION,
    appliedRules: APPLIED_RULE_ORDER.filter((rule) => appliedRules.has(rule)),
  }
}
