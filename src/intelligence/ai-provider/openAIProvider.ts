import type {
  AIProvider,
  AIProviderConversationGenerationResult,
  AIProviderFailure,
  AIProviderMetadata,
} from './aiProviderContracts'
import {
  validateAIProviderMetadata,
} from './aiProviderValidator'
import {
  createOpenAIAdapter,
  type OpenAIAdapter,
} from './openAIAdapter'
import {
  resolveOpenAIProviderConfiguration,
  type ResolveOpenAIConfigurationInput,
} from './openAIConfiguration'
import {
  validateOpenAIProviderConfiguration,
  validateOpenAIProviderMetadata,
} from './openAIValidator'
import {
  MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION,
} from '../mock-conversational-renderer/mockConversationalRenderer'
import type {
  IntentResolverFailure,
  IntentResolverResolveResult,
} from '../intent-resolver/intentResolver'

export interface CreateOpenAIProviderInput extends ResolveOpenAIConfigurationInput {
  readonly adapter?: OpenAIAdapter
}

function createFailure(
  safeMessage: string,
  code: AIProviderFailure['code'] = 'PROVIDER_UNAVAILABLE',
): AIProviderFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function createIntentFailure(
  safeMessage: string,
  code: IntentResolverFailure['code'] = 'INTENT_RESOLUTION_FAILED',
): IntentResolverFailure {
  return {
    kind: 'failure',
    code,
    retryable: false,
    safeMessage,
  }
}

function createMetadata(): AIProviderMetadata {
  return {
    providerId: 'openai-provider',
    providerName: 'OpenAI Provider',
    protocolVersion: 1,
    providerVersion: '1.0.0',
    capabilities: ['INTENT_RESOLUTION', 'CONVERSATION_GENERATION'],
  }
}

export function createOpenAIProvider(input: CreateOpenAIProviderInput = {}): AIProvider {
  const metadata = createMetadata()

  const metadataValidation = validateOpenAIProviderMetadata(metadata)
    ?? validateAIProviderMetadata(metadata)

  const configurationResult = resolveOpenAIProviderConfiguration(input)
  const adapter =
    configurationResult.kind === 'success'
      ? (input.adapter ?? createOpenAIAdapter({ configuration: configurationResult.configuration }))
      : input.adapter

  return {
    metadata,

    async resolveIntent(request): Promise<IntentResolverResolveResult> {
      if (metadataValidation !== null) {
        return createIntentFailure(metadataValidation.safeMessage)
      }

      if (configurationResult.kind !== 'success') {
        return createIntentFailure(configurationResult.safeMessage)
      }

      const configValidation = validateOpenAIProviderConfiguration(configurationResult.configuration)
      if (configValidation !== null) {
        return createIntentFailure(configValidation.safeMessage)
      }

      if (adapter === undefined) {
        return createIntentFailure('OpenAI adapter is unavailable.')
      }

      const resolution = await adapter.resolveIntent(request)
      if (resolution.kind === 'failure') {
        return resolution.code === 'INVALID_INTENT_RESULT'
          ? {
              kind: 'failure',
              code: 'INTENT_RESOLUTION_FAILED',
              retryable: false,
              safeMessage: 'OpenAI no devolvió una intención válida.',
            }
          : resolution
      }

      return resolution
    },

    async generateConversation(response): Promise<AIProviderConversationGenerationResult> {
      if (metadataValidation !== null) {
        return createFailure(metadataValidation.safeMessage, metadataValidation.code)
      }

      if (configurationResult.kind !== 'success') {
        return createFailure(configurationResult.safeMessage, configurationResult.code)
      }

      const configValidation = validateOpenAIProviderConfiguration(configurationResult.configuration)
      if (configValidation !== null) {
        return createFailure(configValidation.safeMessage, configValidation.code)
      }

      if (adapter === undefined) {
        return createFailure('OpenAI adapter is unavailable.')
      }

      let serializedResponse: string
      try {
        serializedResponse = JSON.stringify(response)
      } catch {
        return createFailure('Unable to serialize conversation response for OpenAI.', 'CONVERSATION_GENERATION_FAILED')
      }

      const generated = await adapter.generateConversationText(serializedResponse)
      return generated.kind === 'failure'
        ? generated
        : {
            kind: 'success',
            message: {
              protocolVersion: MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION,
              messageId: `${response.responseId}:openai`,
              type: 'assistant',
              origin: 'MOCK_RENDERER',
              timestamp: new Date().toISOString(),
              text: generated.text,
              responseId: response.responseId,
              conversationResponse: response,
              traceability: {
                executionId: response.execution.executionId,
                promptContextId: response.execution.promptContextId,
              },
            },
          }
    },
  }
}
