import { buildBalanceReport, type BalanceReportResult } from './balanceReportService'
import {
  type FinancialEngineShadowOptions,
} from './financialEngineShadowMode'
import {
  runFinancialEngine,
  type FinancialEngineInput,
  type FinancialEngineResult,
} from './financialEngineAdapter'
import { validateFinancialParity } from '../utils/financialParityValidator'
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

interface HomeBalanceSummaryOptions extends FinancialEngineShadowOptions {
  financialEngineEnabled?: boolean
}

function isHomeFinancialEngineEnabled() {
  return import.meta.env.VITE_FINANCIAL_ENGINE_HOME_ENABLED === 'true'
}

/**
 * The legacy result is always calculated and retained as the immediate
 * fallback. Removing the build flag, or setting it to false, is the complete
 * rollback procedure and requires no data migration or cleanup.
 */
export function buildHomeBalanceSummary(
  input: BuildHomeBalanceSummaryInput,
  options: HomeBalanceSummaryOptions = {},
): BalanceReportResult {
  const legacyBalanceReport = buildBalanceReport({
    incomes: [...input.incomes],
    expenses: [...input.expenses],
    currency: input.currency,
  })

  const engineRunner: (input: FinancialEngineInput) => FinancialEngineResult =
    options.engineRunner ?? runFinancialEngine

  try {
    const engineResult = engineRunner({
      incomes: input.incomes,
      expenses: input.expenses,
      currency: input.currency,
      usageMode: input.usageMode,
      earningPeriodId: input.earningPeriodId,
    })

    validateFinancialParity({
      legacyValue: legacyBalanceReport,
      newValue: engineResult.balanceReport,
      context: {
        scope: input.scope,
        usageMode: input.usageMode,
        currency: input.currency,
        earningPeriodId: input.earningPeriodId,
        incomeCount: input.incomes.length,
        expenseCount: input.expenses.length,
        field: 'balanceReport',
      },
    }, { dev: options.dev, logger: options.logger })

    return (options.financialEngineEnabled ?? isHomeFinancialEngineEnabled())
      ? engineResult.balanceReport
      : legacyBalanceReport
  } catch {
    if (options.dev ?? import.meta.env.DEV) {
      const logger = options.logger ?? console.warn
      logger('[financial-engine] Home adapter failed; using legacy fallback', {
        scope: input.scope,
        usageMode: input.usageMode,
        currency: input.currency,
        earningPeriodId: input.earningPeriodId,
        incomeCount: input.incomes.length,
        expenseCount: input.expenses.length,
      })
    }

    return legacyBalanceReport
  }
}
