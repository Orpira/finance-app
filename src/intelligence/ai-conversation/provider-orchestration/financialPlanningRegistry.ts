import type {
  FinancialPlanningRegistry,
  FinancialPlanningRegistryRegisterResult,
  FinancialPlanningStrategy,
} from './financialPlanningContracts'
import {
  validateFinancialPlanningStrategy,
} from './financialPlanningValidator'

function createFailure(
  code: Extract<FinancialPlanningRegistryRegisterResult, { readonly kind: 'failure' }>['code'],
  safeMessage: string,
): FinancialPlanningRegistryRegisterResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

export function createFinancialPlanningRegistry(
  strategies: readonly FinancialPlanningStrategy[],
): FinancialPlanningRegistry {
  const items: FinancialPlanningStrategy[] = []

  for (const strategy of strategies) {
    const validation = validateFinancialPlanningStrategy(strategy)
    if (validation !== null) {
      continue
    }

    const normalized = strategy.strategyId.trim().toLowerCase()
    if (items.some((item) => item.strategyId.trim().toLowerCase() === normalized)) {
      continue
    }

    items.push(strategy)
  }

  return {
    register(strategy) {
      const validation = validateFinancialPlanningStrategy(strategy)
      if (validation !== null) {
        return createFailure('INVALID_FINANCIAL_PLANNING_STRATEGY', validation.safeMessage)
      }

      const normalized = strategy.strategyId.trim().toLowerCase()
      if (items.some((item) => item.strategyId.trim().toLowerCase() === normalized)) {
        return createFailure('DUPLICATED_FINANCIAL_PLANNING_STRATEGY', `The planning strategy '${strategy.strategyId}' is duplicated.`)
      }

      items.push(strategy)
      return {
        kind: 'success',
        strategy,
      }
    },
    list() {
      return [...items]
    },
    findById(strategyId) {
      const normalized = strategyId.trim().toLowerCase()
      return items.find((item) => item.strategyId.trim().toLowerCase() === normalized) ?? null
    },
    findSupporting(input) {
      return items.filter((item) => item.supports(input))
    },
  }
}
