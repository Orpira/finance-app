import type {
  FinancialInsight,
  FinancialInsightEvaluator,
  FinancialInsightPrioritizer,
  FinancialInsightRegistry,
} from './financialInsightContracts'
import {
  FINANCIAL_INSIGHT_CATEGORIES,
  FINANCIAL_INSIGHT_PROTOCOL_VERSION,
  FINANCIAL_INSIGHT_SEVERITIES,
} from './financialInsightContracts'

export interface FinancialInsightValidationFailure {
  readonly kind: 'failure'
  readonly code:
    | 'INVALID_FINANCIAL_INSIGHT'
    | 'INVALID_FINANCIAL_INSIGHT_EVALUATOR'
    | 'INVALID_FINANCIAL_INSIGHT_PRIORITY'
    | 'INVALID_FINANCIAL_INSIGHT_REGISTRY'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: FinancialInsightValidationFailure['code'],
  safeMessage: string,
): FinancialInsightValidationFailure {
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

function includesValue<TValue extends string>(values: readonly TValue[], value: unknown): value is TValue {
  return typeof value === 'string' && values.includes(value as TValue)
}

export function validateFinancialInsight(insight: FinancialInsight): FinancialInsightValidationFailure | null {
  if (
    insight.protocolVersion !== FINANCIAL_INSIGHT_PROTOCOL_VERSION
    || !isNonEmptyString(insight.insightId)
    || !includesValue(FINANCIAL_INSIGHT_CATEGORIES, insight.category)
    || !includesValue(FINANCIAL_INSIGHT_SEVERITIES, insight.severity)
    || !includesValue(FINANCIAL_INSIGHT_SEVERITIES, insight.priority)
    || !isNonEmptyString(insight.title)
    || !isNonEmptyString(insight.description)
    || !isNonEmptyString(insight.recommendation)
    || !isNonEmptyString(insight.sourceTool)
    || !isNonEmptyString(insight.generatedAt)
  ) {
    return createFailure('INVALID_FINANCIAL_INSIGHT', 'The financial insight contract is invalid.')
  }

  return null
}

export function validateFinancialInsightEvaluator(
  evaluator: FinancialInsightEvaluator,
): FinancialInsightValidationFailure | null {
  if (
    !isNonEmptyString(evaluator.evaluatorId)
    || typeof evaluator.supports !== 'function'
    || typeof evaluator.evaluate !== 'function'
  ) {
    return createFailure('INVALID_FINANCIAL_INSIGHT_EVALUATOR', 'The financial insight evaluator contract is invalid.')
  }

  return null
}

export function validateFinancialInsightRegistry(
  registry: FinancialInsightRegistry,
): FinancialInsightValidationFailure | null {
  if (
    typeof registry.register !== 'function'
    || typeof registry.list !== 'function'
    || typeof registry.findById !== 'function'
    || typeof registry.findSupporting !== 'function'
  ) {
    return createFailure('INVALID_FINANCIAL_INSIGHT_REGISTRY', 'The financial insight registry contract is invalid.')
  }

  const evaluators = registry.list()
  if (!Array.isArray(evaluators) || evaluators.length === 0) {
    return createFailure('INVALID_FINANCIAL_INSIGHT_REGISTRY', 'The financial insight registry must contain at least one evaluator.')
  }

  const seen = new Set<string>()
  for (const evaluator of evaluators) {
    const validation = validateFinancialInsightEvaluator(evaluator)
    if (validation !== null) {
      return validation
    }

    const normalized = evaluator.evaluatorId.trim().toLowerCase()
    if (seen.has(normalized)) {
      return createFailure('INVALID_FINANCIAL_INSIGHT_REGISTRY', `Duplicated insight evaluator '${evaluator.evaluatorId}'.`)
    }

    seen.add(normalized)
  }

  return null
}

export function validateFinancialInsightPrioritizer(
  prioritizer: FinancialInsightPrioritizer,
): FinancialInsightValidationFailure | null {
  if (typeof prioritizer.prioritize !== 'function') {
    return createFailure('INVALID_FINANCIAL_INSIGHT_PRIORITY', 'The financial insight prioritizer contract is invalid.')
  }

  return null
}
