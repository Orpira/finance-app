import type { BalanceReportResult } from './balanceReportService'
import {
  runFinancialEngine,
  type FinancialEngineInput,
  type FinancialEngineResult,
} from './financialEngineAdapter'
import { isAdjustmentIncome } from '../utils/incomeTypes'
import { getEffectiveFinancialDuration } from '../utils/serviceDuration'
import {
  validateFinancialParity,
} from '../utils/financialParityValidator'

export interface FinancialEngineShadowInput extends FinancialEngineInput {
  readonly legacyBalanceReport: BalanceReportResult
  readonly scope: string
}

export interface FinancialEngineShadowOptions {
  dev?: boolean
  logger?: (message: string, details: Record<string, unknown>) => void
  engineRunner?: (input: FinancialEngineInput) => FinancialEngineResult
}

interface ParityField {
  name: string
  legacyValue: unknown
  engineValue: unknown
}

/**
 * Runs the minimal adapter in shadow mode. The legacy report is always returned
 * and remains the only result available to the consumer.
 */
export function runFinancialEngineShadowMode(
  input: FinancialEngineShadowInput,
  options: FinancialEngineShadowOptions = {},
): BalanceReportResult {
  const sourceIncomes = input.incomes ?? input.services ?? []
  const engineRunner = options.engineRunner ?? runFinancialEngine

  try {
    const engineResult = engineRunner(input)
    const scheduledMinutes = sourceIncomes.reduce(
      (total, income) => total + income.duration,
      0,
    )
    const actualMinutes = sourceIncomes.reduce(
      (total, income) =>
        total + (getEffectiveFinancialDuration(income) ?? 0),
      0,
    )
    const adjustmentCount =
      sourceIncomes.filter((income) => isAdjustmentIncome(income)).length +
      input.expenses.filter((expense) => expense.type === 'ajuste').length

    const fields: ParityField[] = [
      {
        name: 'balanceReport',
        legacyValue: input.legacyBalanceReport,
        engineValue: engineResult.balanceReport,
      },
      { name: 'scheduledMinutes', legacyValue: scheduledMinutes, engineValue: engineResult.scheduledMinutes },
      { name: 'actualMinutes', legacyValue: actualMinutes, engineValue: engineResult.actualMinutes },
      { name: 'incomeCount', legacyValue: sourceIncomes.length, engineValue: engineResult.incomeCount },
      { name: 'expenseCount', legacyValue: input.expenses.length, engineValue: engineResult.expenseCount },
      { name: 'adjustmentCount', legacyValue: adjustmentCount, engineValue: engineResult.adjustmentCount },
    ]

    fields.forEach((field) => {
      validateFinancialParity(
        {
          legacyValue: field.legacyValue,
          newValue: field.engineValue,
          context: {
            scope: input.scope,
            usageMode: input.usageMode,
            currency: input.currency,
            earningPeriodId: input.earningPeriodId,
            incomeCount: sourceIncomes.length,
            expenseCount: input.expenses.length,
            field: field.name,
          },
        },
        { dev: options.dev, logger: options.logger },
      )
    })
  } catch {
    if (options.dev ?? import.meta.env.DEV) {
      const logger = options.logger ?? console.warn
      logger('[financial-parity] Shadow execution failed', {
        scope: input.scope,
        usageMode: input.usageMode,
        currency: input.currency,
        earningPeriodId: input.earningPeriodId,
        incomeCount: sourceIncomes.length,
        expenseCount: input.expenses.length,
      })
    }
  }

  return input.legacyBalanceReport
}
