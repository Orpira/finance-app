import {
  AI_PROVIDER_CAPABILITIES,
  AI_PROVIDER_FAILURE_CODES,
  AI_PROVIDER_PROTOCOL_VERSION,
  type AIProvider,
  type AIProviderCapability,
  type AIProviderConversationGenerationResult,
  type AIProviderFailure,
  type AIProviderFailureCode,
  type AIProviderMetadata,
} from './aiProviderContracts'
import {
  validateIntentResolverResolveResult,
  type IntentResolverResolveResult,
} from '../intent-resolver/intentResolver'
import {
  validateChatMessage,
} from '../mock-conversational-renderer/mockConversationalRenderer'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function createFailure(
  code: AIProviderFailureCode,
  safeMessage: string,
): AIProviderFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

export function validateAIProviderCapability(
  capability: string,
): AIProviderFailure | null {
  if (!AI_PROVIDER_CAPABILITIES.includes(capability as AIProviderCapability)) {
    return createFailure('INVALID_PROVIDER_CAPABILITIES', `The capability '${capability}' is not supported.`)
  }

  return null
}

export function validateAIProviderMetadata(
  metadata: AIProviderMetadata,
): AIProviderFailure | null {
  if (metadata.protocolVersion !== AI_PROVIDER_PROTOCOL_VERSION) {
    return createFailure('INVALID_PROVIDER_METADATA', 'The provider metadata protocol version is invalid.')
  }

  if (!isNonEmptyString(metadata.providerId)) {
    return createFailure('INVALID_PROVIDER_METADATA', 'The provider identifier is invalid.')
  }

  if (!isNonEmptyString(metadata.providerName)) {
    return createFailure('INVALID_PROVIDER_METADATA', 'The provider name is invalid.')
  }

  if (!isNonEmptyString(metadata.providerVersion)) {
    return createFailure('INVALID_PROVIDER_METADATA', 'The provider version is invalid.')
  }

  if (!Array.isArray(metadata.capabilities) || metadata.capabilities.length === 0) {
    return createFailure('INVALID_PROVIDER_CAPABILITIES', 'The provider must declare at least one capability.')
  }

  const seen = new Set<string>()
  for (const capability of metadata.capabilities) {
    const validation = validateAIProviderCapability(capability)
    if (validation !== null) {
      return validation
    }

    if (seen.has(capability)) {
      return createFailure('INVALID_PROVIDER_CAPABILITIES', `The capability '${capability}' is duplicated.`)
    }
    seen.add(capability)
  }

  return null
}

export function validateAIProvider(provider: AIProvider): AIProviderFailure | null {
  const metadataValidation = validateAIProviderMetadata(provider.metadata)
  if (metadataValidation !== null) {
    return metadataValidation
  }

  if (provider.metadata.capabilities.includes('INTENT_RESOLUTION') && typeof provider.resolveIntent !== 'function') {
    return createFailure('INVALID_PROVIDER_INTERFACE', 'The provider declares INTENT_RESOLUTION but does not implement resolveIntent.')
  }

  if (provider.metadata.capabilities.includes('CONVERSATION_GENERATION') && typeof provider.generateConversation !== 'function') {
    return createFailure('INVALID_PROVIDER_INTERFACE', 'The provider declares CONVERSATION_GENERATION but does not implement generateConversation.')
  }

  return null
}

export function validateAIProviderIntentResolutionResult(
  result: IntentResolverResolveResult,
): AIProviderFailure | null {
  const validation = validateIntentResolverResolveResult(result)
  if (validation !== null) {
    return createFailure('INTENT_RESOLUTION_FAILED', validation.safeMessage)
  }

  return null
}

export function validateAIProviderConversationGenerationResult(
  result: AIProviderConversationGenerationResult,
): AIProviderFailure | null {
  if (result.kind === 'failure') {
    if (!AI_PROVIDER_FAILURE_CODES.includes(result.code as AIProviderFailureCode) && !isNonEmptyString(result.code)) {
      return createFailure('CONVERSATION_GENERATION_FAILED', 'The provider generation failure code is invalid.')
    }

    if (!isNonEmptyString(result.safeMessage)) {
      return createFailure('CONVERSATION_GENERATION_FAILED', 'The provider generation safe message is invalid.')
    }

    return null
  }

  const messageValidation = validateChatMessage(result.message)
  if (messageValidation !== null) {
    return createFailure('CONVERSATION_GENERATION_FAILED', messageValidation.safeMessage)
  }

  return null
}
