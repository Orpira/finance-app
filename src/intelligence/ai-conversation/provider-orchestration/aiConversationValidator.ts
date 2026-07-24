import type {
  AIConversationConfidencePolicy,
  AIConversationExecution,
} from './aiConversationContracts'

export interface AIConversationServiceValidationFailure {
  readonly kind: 'failure'
  readonly code: 'INVALID_EXECUTION' | 'INVALID_CONFIDENCE_POLICY' | 'INVALID_PROVIDER' | 'INVALID_FALLBACK'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: AIConversationServiceValidationFailure['code'],
  safeMessage: string,
): AIConversationServiceValidationFailure {
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

export function validateAIConversationConfidencePolicy(
  policy: AIConversationConfidencePolicy,
): AIConversationServiceValidationFailure | null {
  if (
    typeof policy.confidenceThreshold !== 'number'
    || !Number.isFinite(policy.confidenceThreshold)
    || policy.confidenceThreshold < 0
    || policy.confidenceThreshold > 1
  ) {
    return createFailure(
      'INVALID_CONFIDENCE_POLICY',
      'The AI conversation confidence policy is invalid.',
    )
  }

  return null
}

export function validateAIConversationProviderIdentifier(
  providerId: string,
): AIConversationServiceValidationFailure | null {
  if (!isNonEmptyString(providerId)) {
    return createFailure('INVALID_PROVIDER', 'The AI provider identifier is invalid.')
  }

  return null
}

export function validateAIConversationFallback(
  providerId: string,
  fallbackUsed: boolean,
): AIConversationServiceValidationFailure | null {
  if (fallbackUsed && !isNonEmptyString(providerId)) {
    return createFailure('INVALID_FALLBACK', 'The fallback provider is invalid.')
  }

  return null
}

export function validateAIConversationExecution(
  execution: AIConversationExecution,
): AIConversationServiceValidationFailure | null {
  if (
    execution.protocolVersion !== 1
    || !isNonEmptyString(execution.provider)
    || !isNonEmptyString(execution.intent)
    || typeof execution.confidence !== 'number'
    || !Number.isFinite(execution.confidence)
    || execution.confidence < 0
    || execution.confidence > 1
    || typeof execution.executionTime !== 'number'
    || !Number.isFinite(execution.executionTime)
    || execution.executionTime < 0
    || typeof execution.conversationGenerated !== 'boolean'
    || typeof execution.fallbackUsed !== 'boolean'
    || typeof execution.success !== 'boolean'
  ) {
    return createFailure('INVALID_EXECUTION', 'The AI conversation execution payload is invalid.')
  }

  if (execution.success && execution.error !== null) {
    return createFailure('INVALID_EXECUTION', 'A successful execution cannot contain an error.')
  }

  if (!execution.success && !isNonEmptyString(execution.error)) {
    return createFailure('INVALID_EXECUTION', 'A failed execution must contain an error.')
  }

  return null
}
