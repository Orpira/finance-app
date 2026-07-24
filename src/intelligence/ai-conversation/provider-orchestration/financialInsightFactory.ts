import {
  createFinancialInsightEngine as createFinancialInsightEngineInstance,
} from './financialInsightEngine'
import {
  createFinancialInsightRegistry as createFinancialInsightRegistryCatalog,
} from './financialInsightRegistry'
import type {
  FinancialInsightEngine,
  FinancialInsightEngineDependencies,
  FinancialInsightRegistry,
} from './financialInsightContracts'
import {
  validateFinancialInsightRegistry,
} from './financialInsightValidator'
import {
  createBudgetOverspendingEvaluator,
} from './insights/budgetOverspendingEvaluator'
import {
  createSavingsGoalRiskEvaluator,
} from './insights/savingsGoalRiskEvaluator'
import {
  createExpenseTrendEvaluator,
} from './insights/expenseTrendEvaluator'
import {
  createIncomeStabilityEvaluator,
} from './insights/incomeStabilityEvaluator'
import {
  createSubscriptionOpportunityEvaluator,
} from './insights/subscriptionOpportunityEvaluator'
import {
  createFinancialHealthEvaluator,
} from './insights/financialHealthEvaluator'

function createDefaultEvaluators() {
  return [
    createBudgetOverspendingEvaluator(),
    createSavingsGoalRiskEvaluator(),
    createExpenseTrendEvaluator(),
    createIncomeStabilityEvaluator(),
    createSubscriptionOpportunityEvaluator(),
    createFinancialHealthEvaluator(),
  ] as const
}

export function createFinancialInsightRegistryInstance(): FinancialInsightRegistry {
  const registry = createFinancialInsightRegistryCatalog(createDefaultEvaluators())
  const validation = validateFinancialInsightRegistry(registry)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return registry
}

export function createFinancialInsightRegistry(): FinancialInsightRegistry {
  return createFinancialInsightRegistryInstance()
}

export function createFinancialInsightEngine(
  dependencies: FinancialInsightEngineDependencies = {},
): FinancialInsightEngine {
  return createFinancialInsightEngineInstance({
    ...dependencies,
    ...(dependencies.registry === undefined ? { registry: createFinancialInsightRegistryInstance() } : {}),
  })
}
