import {
  createDeterministicIntentResolver,
  type CreateDeterministicIntentResolverInput,
} from '../intent-resolver/deterministicIntentResolver'
import type {
  IntentResolverResolveResult,
} from '../intent-resolver/intentResolver'
import {
  createMockConversationalRenderer,
  type CreateMockConversationalRendererInput,
} from '../mock-conversational-renderer/mockConversationalRenderer'
import {
  AI_PROVIDER_PROTOCOL_VERSION,
  type AIProvider,
  type AIProviderConversationGenerationResult,
  type AIProviderMetadata,
} from './aiProviderContracts'
import {
  validateAIProvider,
  validateAIProviderConversationGenerationResult,
  validateAIProviderIntentResolutionResult,
} from './aiProviderValidator'

export const MOCK_AI_PROVIDER_ID = 'mock-ai-provider' as const

export interface CreateMockAIProviderInput {
  readonly now?: () => string
  readonly intentResolver?: CreateDeterministicIntentResolverInput
  readonly renderer?: CreateMockConversationalRendererInput
}

export function createMockAIProvider(
  input: CreateMockAIProviderInput = {},
): AIProvider {
  const intentResolver = createDeterministicIntentResolver(input.intentResolver)
  const renderer = createMockConversationalRenderer(input.renderer)

  const metadata: AIProviderMetadata = {
    protocolVersion: AI_PROVIDER_PROTOCOL_VERSION,
    providerId: MOCK_AI_PROVIDER_ID,
    providerName: 'Mock AI Provider',
    providerVersion: '1.0.0',
    capabilities: ['INTENT_RESOLUTION', 'CONVERSATION_GENERATION'],
  }

  const provider: AIProvider = {
    metadata,

    async resolveIntent(request): Promise<IntentResolverResolveResult> {
      const result = await intentResolver.resolve(request)
      const validation = validateAIProviderIntentResolutionResult(result)
      if (validation !== null) {
        return {
          kind: 'failure',
          code: 'INTENT_RESOLUTION_FAILED',
          retryable: false,
          safeMessage: validation.safeMessage,
        }
      }

      return result
    },

    async generateConversation(response): Promise<AIProviderConversationGenerationResult> {
      const rendered = renderer.render(response)
      if (rendered.kind === 'failure') {
        const failure: AIProviderConversationGenerationResult = {
          kind: 'failure',
          code: rendered.code,
          retryable: false,
          safeMessage: rendered.safeMessage,
        }
        return failure
      }

      const success: AIProviderConversationGenerationResult = {
        kind: 'success',
        message: rendered.message,
      }

      const validation = validateAIProviderConversationGenerationResult(success)
      if (validation !== null) {
        return validation
      }

      return success
    },
  }

  const providerValidation = validateAIProvider(provider)
  if (providerValidation !== null) {
    throw new Error(providerValidation.safeMessage)
  }

  return provider
}
