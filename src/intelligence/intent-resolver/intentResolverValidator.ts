import {
  INTENT_RESOLVER_FAILURE_CODES,
  INTENT_RESOLVER_PROTOCOL_VERSION,
  type IntentResolutionResult,
  type IntentResolverFailure,
  type IntentResolverFailureCode,
  type IntentResolverResolveResult,
  type IntentResolutionRequest,
} from './intentResolverContracts'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function createFailure(
  code: IntentResolverFailureCode,
  safeMessage: string,
): IntentResolverFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

export function validateIntentResolutionRequest(
  request: IntentResolutionRequest,
): IntentResolverFailure | null {
  if (request.protocolVersion !== INTENT_RESOLVER_PROTOCOL_VERSION) {
    return createFailure('INVALID_INTENT_REQUEST', 'The intent resolution request protocol version is invalid.')
  }

  if (!isRecord(request.conversationRequest)) {
    return createFailure('INVALID_INTENT_REQUEST', 'The conversation request payload is invalid.')
  }

  if (!isRecord(request.metadata)) {
    return createFailure('INVALID_INTENT_REQUEST', 'The intent resolution metadata payload is invalid.')
  }

  if (!isNonEmptyString(request.metadata.userMessage)) {
    return createFailure('INVALID_INTENT_REQUEST', 'The user message is required to resolve intent.')
  }

  if (!Number.isSafeInteger(request.metadata.turn) || request.metadata.turn <= 0) {
    return createFailure('INVALID_INTENT_REQUEST', 'The turn metadata value is invalid.')
  }

  if (!isNonEmptyString(request.metadata.requestedAt) || !UTC_INSTANT_PATTERN.test(request.metadata.requestedAt)) {
    return createFailure('INVALID_INTENT_REQUEST', 'The requestedAt metadata value is invalid.')
  }

  return null
}

export function validateIntentResolutionProvider(
  provider: string,
): IntentResolverFailure | null {
  if (!isNonEmptyString(provider)) {
    return createFailure('INVALID_INTENT_PROVIDER', 'The intent resolver provider identifier is invalid.')
  }

  return null
}

export function validateIntentResolutionResult(
  result: IntentResolutionResult,
): IntentResolverFailure | null {
  if (result.protocolVersion !== INTENT_RESOLVER_PROTOCOL_VERSION) {
    return createFailure('INVALID_INTENT_RESULT', 'The intent resolution result protocol version is invalid.')
  }

  if (typeof result.confidence !== 'number' || !Number.isFinite(result.confidence) || result.confidence < 0 || result.confidence > 1) {
    return createFailure('INVALID_INTENT_RESULT', 'The intent confidence score must be between 0 and 1.')
  }

  if (!Array.isArray(result.tools) || result.tools.length === 0) {
    return createFailure('INVALID_INTENT_RESULT', 'The intent resolution must include at least one tool selection.')
  }

  for (const tool of result.tools) {
    if (!isRecord(tool)) {
      return createFailure('INVALID_INTENT_RESULT', 'A tool selection entry is invalid.')
    }

    if (!isNonEmptyString(tool.toolId)) {
      return createFailure('INVALID_INTENT_RESULT', 'A resolved tool identifier is invalid.')
    }

    if (!isRecord(tool.arguments)) {
      return createFailure('INVALID_INTENT_RESULT', 'A resolved tool arguments payload is invalid.')
    }
  }

  if (!isNonEmptyString(result.reasoning)) {
    return createFailure('INVALID_INTENT_RESULT', 'The intent resolution reasoning is invalid.')
  }

  const providerValidation = validateIntentResolutionProvider(result.provider)
  if (providerValidation !== null) {
    return providerValidation
  }

  if (!isNonEmptyString(result.timestamp) || !UTC_INSTANT_PATTERN.test(result.timestamp)) {
    return createFailure('INVALID_INTENT_RESULT', 'The intent resolution timestamp is invalid.')
  }

  return null
}

export function validateIntentResolverResolveResult(
  result: IntentResolverResolveResult,
): IntentResolverFailure | null {
  if (result.kind === 'failure') {
    if (!INTENT_RESOLVER_FAILURE_CODES.includes(result.code)) {
      return createFailure('INVALID_INTENT_RESULT', 'The intent resolver failure code is invalid.')
    }

    if (!isNonEmptyString(result.safeMessage)) {
      return createFailure('INVALID_INTENT_RESULT', 'The intent resolver failure safe message is invalid.')
    }

    return null
  }

  return validateIntentResolutionResult(result.resolution)
}
