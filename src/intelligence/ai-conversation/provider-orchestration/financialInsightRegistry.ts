import type {
  FinancialInsightEvaluator,
  FinancialInsightRegistry,
  FinancialInsightRegistryRegisterResult,
} from './financialInsightContracts'
import {
  validateFinancialInsightEvaluator,
} from './financialInsightValidator'

function createFailure(
  code: Extract<FinancialInsightRegistryRegisterResult, { readonly kind: 'failure' }>['code'],
  safeMessage: string,
): FinancialInsightRegistryRegisterResult {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

export function createFinancialInsightRegistry(
  evaluators: readonly FinancialInsightEvaluator[],
): FinancialInsightRegistry {
  const items: FinancialInsightEvaluator[] = []

  for (const evaluator of evaluators) {
    const validation = validateFinancialInsightEvaluator(evaluator)
    if (validation !== null) {
      continue
    }

    const normalized = evaluator.evaluatorId.trim().toLowerCase()
    if (items.some((item) => item.evaluatorId.trim().toLowerCase() === normalized)) {
      continue
    }

    items.push(evaluator)
  }

  return {
    register(evaluator) {
      const validation = validateFinancialInsightEvaluator(evaluator)
      if (validation !== null) {
        return createFailure('INVALID_INSIGHT_EVALUATOR', validation.safeMessage)
      }

      const normalized = evaluator.evaluatorId.trim().toLowerCase()
      if (items.some((item) => item.evaluatorId.trim().toLowerCase() === normalized)) {
        return createFailure('DUPLICATED_INSIGHT_EVALUATOR', `The insight evaluator '${evaluator.evaluatorId}' is duplicated.`)
      }

      items.push(evaluator)
      return {
        kind: 'success',
        evaluator,
      }
    },
    list() {
      return [...items]
    },
    findById(evaluatorId) {
      const normalized = evaluatorId.trim().toLowerCase()
      return items.find((item) => item.evaluatorId.trim().toLowerCase() === normalized) ?? null
    },
    findSupporting(input) {
      return items.filter((evaluator) => evaluator.supports(input))
    },
  }
}
