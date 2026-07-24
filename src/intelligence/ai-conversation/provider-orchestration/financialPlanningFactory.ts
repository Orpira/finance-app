import {
  createFinancialPlanningEngine as createFinancialPlanningEngineInstance,
} from './financialPlanningEngine'
import {
  createFinancialPlanningRegistry as createFinancialPlanningRegistryCatalog,
} from './financialPlanningRegistry'
import type {
  FinancialPlanningEngine,
  FinancialPlanningEngineDependencies,
  FinancialPlanningRegistry,
} from './financialPlanningContracts'
import {
  validateFinancialPlanningRegistry,
} from './financialPlanningValidator'
import {
  createBudgetOptimizationStrategy,
} from './planning/budgetOptimizationStrategy'
import {
  createSavingsImprovementStrategy,
} from './planning/savingsImprovementStrategy'
import {
  createGoalRecoveryStrategy,
} from './planning/goalRecoveryStrategy'
import {
  createExpenseReductionStrategy,
} from './planning/expenseReductionStrategy'
import {
  createCashFlowStabilizationStrategy,
} from './planning/cashFlowStabilizationStrategy'
import {
  createFinancialHealthImprovementStrategy,
} from './planning/financialHealthImprovementStrategy'

function createDefaultStrategies() {
  return [
    createBudgetOptimizationStrategy(),
    createSavingsImprovementStrategy(),
    createGoalRecoveryStrategy(),
    createExpenseReductionStrategy(),
    createCashFlowStabilizationStrategy(),
    createFinancialHealthImprovementStrategy(),
  ] as const
}

export function createFinancialPlanningRegistryInstance(): FinancialPlanningRegistry {
  const registry = createFinancialPlanningRegistryCatalog(createDefaultStrategies())
  const validation = validateFinancialPlanningRegistry(registry)
  if (validation !== null) {
    throw new Error(validation.safeMessage)
  }

  return registry
}

export function createFinancialPlanningRegistry(): FinancialPlanningRegistry {
  return createFinancialPlanningRegistryInstance()
}

export function createFinancialPlanningEngine(
  dependencies: FinancialPlanningEngineDependencies = {},
): FinancialPlanningEngine {
  return createFinancialPlanningEngineInstance({
    ...dependencies,
    ...(dependencies.registry === undefined ? { registry: createFinancialPlanningRegistryInstance() } : {}),
  })
}
