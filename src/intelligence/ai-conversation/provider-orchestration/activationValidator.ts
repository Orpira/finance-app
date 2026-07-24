import {
  ACTIVATION_ENGINE_PROTOCOL_VERSION,
  ACTIVATION_TYPES,
  type ActivationDecision,
  type ActivationPolicy,
  type ActivationRoutingStrategy,
} from './activationContracts'

export interface ActivationValidationFailure {
  readonly kind: 'failure'
  readonly code: 'INVALID_ACTIVATION_DECISION' | 'INVALID_ACTIVATION_POLICY' | 'INVALID_ROUTING_STRATEGY'
  readonly retryable: false
  readonly safeMessage: string
}

function createFailure(
  code: ActivationValidationFailure['code'],
  safeMessage: string,
): ActivationValidationFailure {
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

export function validateActivationPolicy(
  policy: ActivationPolicy,
): ActivationValidationFailure | null {
  if (
    typeof policy.minimumConfidence !== 'number'
    || !Number.isFinite(policy.minimumConfidence)
    || policy.minimumConfidence < 0
    || policy.minimumConfidence > 1
    || typeof policy.enableFallback !== 'boolean'
    || typeof policy.enableAIExplanation !== 'boolean'
    || typeof policy.enableDirectTools !== 'boolean'
  ) {
    return createFailure('INVALID_ACTIVATION_POLICY', 'The activation policy is invalid.')
  }

  return null
}

export function validateActivationRoutingStrategy(
  strategy: ActivationRoutingStrategy,
): ActivationValidationFailure | null {
  if (typeof strategy.exists !== 'function') {
    return createFailure('INVALID_ROUTING_STRATEGY', 'The activation routing strategy is invalid.')
  }

  return null
}

export function validateActivationDecision(
  decision: ActivationDecision,
): ActivationValidationFailure | null {
  if (
    decision.protocolVersion !== ACTIVATION_ENGINE_PROTOCOL_VERSION
    || !ACTIVATION_TYPES.includes(decision.activationType)
    || !isNonEmptyString(decision.provider)
    || typeof decision.confidence !== 'number'
    || !Number.isFinite(decision.confidence)
    || decision.confidence < 0
    || decision.confidence > 1
    || typeof decision.requiresAI !== 'boolean'
    || typeof decision.requiresTool !== 'boolean'
    || typeof decision.requiresExplanation !== 'boolean'
    || typeof decision.fallback?.used !== 'boolean'
    || !isNonEmptyString(decision.reason)
    || !isNonEmptyString(decision.intent)
  ) {
    return createFailure('INVALID_ACTIVATION_DECISION', 'The activation decision is invalid.')
  }

  if (decision.requiresTool && !isNonEmptyString(decision.toolId)) {
    return createFailure('INVALID_ACTIVATION_DECISION', 'Tool-based activation requires a toolId.')
  }

  if (!decision.requiresTool && decision.toolId !== null && decision.activationType !== 'FALLBACK') {
    return createFailure('INVALID_ACTIVATION_DECISION', 'Non tool-based activation must not provide a toolId.')
  }

  return null
}
