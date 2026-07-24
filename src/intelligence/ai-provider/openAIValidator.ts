import type {
  AIProviderFailure,
  AIProviderMetadata,
} from './aiProviderContracts'
import type {
  OpenAIProviderConfiguration,
} from './openAIConfiguration'

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function createFailure(safeMessage: string): AIProviderFailure {
  return {
    kind: 'failure',
    code: 'INVALID_PROVIDER_METADATA',
    retryable: false,
    safeMessage,
  }
}

export function validateOpenAIProviderConfiguration(
  configuration: OpenAIProviderConfiguration,
): AIProviderFailure | null {
  if (!isNonEmptyString(configuration.apiKey)) {
    return createFailure('OpenAI API key is invalid.')
  }

  if (!isNonEmptyString(configuration.intentModel)) {
    return createFailure('OpenAI intent model is invalid.')
  }

  if (!isNonEmptyString(configuration.conversationModel)) {
    return createFailure('OpenAI conversation model is invalid.')
  }

  if (!Number.isSafeInteger(configuration.timeoutMs) || configuration.timeoutMs < 1_000) {
    return createFailure('OpenAI timeout is invalid.')
  }

  if (!Number.isSafeInteger(configuration.retryCount) || configuration.retryCount < 0) {
    return createFailure('OpenAI retry count is invalid.')
  }

  if (typeof configuration.temperature !== 'number' || !Number.isFinite(configuration.temperature)) {
    return createFailure('OpenAI temperature is invalid.')
  }

  if (!Number.isSafeInteger(configuration.maxTokens) || configuration.maxTokens < 1) {
    return createFailure('OpenAI max tokens is invalid.')
  }

  return null
}

export function validateOpenAIProviderMetadata(metadata: AIProviderMetadata): AIProviderFailure | null {
  if (metadata.providerId !== 'openai-provider') {
    return createFailure('OpenAI provider id is invalid.')
  }

  if (!metadata.capabilities.includes('INTENT_RESOLUTION')) {
    return createFailure('OpenAI provider metadata must include INTENT_RESOLUTION capability.')
  }

  if (!metadata.capabilities.includes('CONVERSATION_GENERATION')) {
    return createFailure('OpenAI provider metadata must include CONVERSATION_GENERATION capability.')
  }

  return null
}
