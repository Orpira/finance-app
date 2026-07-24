import {
  FINANCIAL_PLANNING_IMPACTS,
  FINANCIAL_PLANNING_PRIORITIES,
  type FinancialActionPlan,
  type FinancialPlanningPrioritizer,
  type FinancialPlanningRegistry,
  type FinancialPlanningStrategy,
  type FinancialRecommendedAction,
} from './financialPlanningContracts'

export interface FinancialPlanningValidationFailure {
  readonly kind: 'failure'
  readonly code:
    | 'INVALID_FINANCIAL_ACTION_PLAN'
    | 'INVALID_FINANCIAL_RECOMMENDED_ACTION'
    | 'INVALID_FINANCIAL_PLANNING_STRATEGY'
    | 'INVALID_FINANCIAL_PLANNING_REGISTRY'
    | 'INVALID_FINANCIAL_PLANNING_PRIORITIZER'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: FinancialPlanningValidationFailure['code'],
  safeMessage: string,
): FinancialPlanningValidationFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPriority(value: unknown): boolean {
  return typeof value === 'string' && FINANCIAL_PLANNING_PRIORITIES.includes(value as (typeof FINANCIAL_PLANNING_PRIORITIES)[number])
}

function isImpact(value: unknown): boolean {
  return typeof value === 'string' && FINANCIAL_PLANNING_IMPACTS.includes(value as (typeof FINANCIAL_PLANNING_IMPACTS)[number])
}

export function validateFinancialRecommendedAction(
  action: FinancialRecommendedAction,
): FinancialPlanningValidationFailure | null {
  if (
    !isNonEmptyString(action.actionId)
    || !isNonEmptyString(action.type)
    || !isNonEmptyString(action.description)
    || !isNonEmptyString(action.expectedBenefit)
    || !['LOW', 'MEDIUM', 'HIGH'].includes(action.effort)
    || !isPriority(action.priority)
    || (action.affectedCategory !== null && !isNonEmptyString(action.affectedCategory))
    || (action.relatedGoal !== null && !isNonEmptyString(action.relatedGoal))
    || typeof action.requiresConfirmation !== 'boolean'
  ) {
    return createFailure('INVALID_FINANCIAL_RECOMMENDED_ACTION', 'The financial recommended action contract is invalid.')
  }

  return null
}

export function validateFinancialActionPlan(
  plan: FinancialActionPlan,
): FinancialPlanningValidationFailure | null {
  if (
    !isNonEmptyString(plan.planId)
    || !isNonEmptyString(plan.createdAt)
    || !isNonEmptyString(plan.title)
    || !isNonEmptyString(plan.summary)
    || !isNonEmptyString(plan.objective)
    || !isPriority(plan.priority)
    || !isImpact(plan.estimatedImpact)
    || !Array.isArray(plan.recommendedActions)
    || !Array.isArray(plan.relatedInsights)
    || !Array.isArray(plan.assumptions)
    || !Array.isArray(plan.warnings)
  ) {
    return createFailure('INVALID_FINANCIAL_ACTION_PLAN', 'The financial action plan contract is invalid.')
  }

  for (const action of plan.recommendedActions) {
    const validation = validateFinancialRecommendedAction(action)
    if (validation !== null) {
      return validation
    }
  }

  if (plan.relatedInsights.some((value) => !isNonEmptyString(value))) {
    return createFailure('INVALID_FINANCIAL_ACTION_PLAN', 'The financial action plan related insights list is invalid.')
  }

  if (plan.assumptions.some((value) => !isNonEmptyString(value))) {
    return createFailure('INVALID_FINANCIAL_ACTION_PLAN', 'The financial action plan assumptions list is invalid.')
  }

  if (plan.warnings.some((value) => !isNonEmptyString(value))) {
    return createFailure('INVALID_FINANCIAL_ACTION_PLAN', 'The financial action plan warnings list is invalid.')
  }

  return null
}

export function validateFinancialPlanningStrategy(
  strategy: FinancialPlanningStrategy,
): FinancialPlanningValidationFailure | null {
  if (
    !isNonEmptyString(strategy.strategyId)
    || typeof strategy.supports !== 'function'
    || typeof strategy.buildPlan !== 'function'
  ) {
    return createFailure('INVALID_FINANCIAL_PLANNING_STRATEGY', 'The financial planning strategy contract is invalid.')
  }

  return null
}

export function validateFinancialPlanningRegistry(
  registry: FinancialPlanningRegistry,
): FinancialPlanningValidationFailure | null {
  if (
    typeof registry.register !== 'function'
    || typeof registry.list !== 'function'
    || typeof registry.findById !== 'function'
    || typeof registry.findSupporting !== 'function'
  ) {
    return createFailure('INVALID_FINANCIAL_PLANNING_REGISTRY', 'The financial planning registry contract is invalid.')
  }

  const strategies = registry.list()
  if (!Array.isArray(strategies) || strategies.length === 0) {
    return createFailure('INVALID_FINANCIAL_PLANNING_REGISTRY', 'The financial planning registry must contain at least one strategy.')
  }

  const seen = new Set<string>()
  for (const strategy of strategies) {
    const validation = validateFinancialPlanningStrategy(strategy)
    if (validation !== null) {
      return validation
    }

    const normalized = strategy.strategyId.trim().toLowerCase()
    if (seen.has(normalized)) {
      return createFailure('INVALID_FINANCIAL_PLANNING_REGISTRY', `Duplicated planning strategy '${strategy.strategyId}'.`)
    }
    seen.add(normalized)
  }

  return null
}

export function validateFinancialPlanningPrioritizer(
  prioritizer: FinancialPlanningPrioritizer,
): FinancialPlanningValidationFailure | null {
  if (typeof prioritizer.prioritize !== 'function') {
    return createFailure('INVALID_FINANCIAL_PLANNING_PRIORITIZER', 'The financial planning prioritizer contract is invalid.')
  }

  return null
}
