import type {
  IntentResolutionRequest,
  IntentResolverResolveResult,
} from '../intent-resolver/intentResolver'
import type {
  ChatMessage,
} from '../mock-conversational-renderer/mockConversationalRenderer'
import type {
  ConversationResponse,
} from '../response-composer'

export const AI_PROVIDER_PROTOCOL_VERSION = 1 as const

export const AI_PROVIDER_CAPABILITIES = [
  'INTENT_RESOLUTION',
  'CONVERSATION_GENERATION',
] as const

export type AIProviderCapability =
  (typeof AI_PROVIDER_CAPABILITIES)[number]

export const AI_PROVIDER_FAILURE_CODES = [
  'INVALID_PROVIDER_METADATA',
  'INVALID_PROVIDER_CAPABILITIES',
  'INVALID_PROVIDER_INTERFACE',
  'INTENT_RESOLUTION_FAILED',
  'CONVERSATION_GENERATION_FAILED',
] as const

export type AIProviderFailureCode =
  (typeof AI_PROVIDER_FAILURE_CODES)[number]

export interface AIProviderFailure {
  readonly kind: 'failure'
  readonly code: AIProviderFailureCode | string
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIProviderMetadata {
  readonly protocolVersion: typeof AI_PROVIDER_PROTOCOL_VERSION
  readonly providerId: string
  readonly providerName: string
  readonly providerVersion: string
  readonly capabilities: readonly AIProviderCapability[]
}

export interface IntentResolverProvider {
  resolveIntent(request: IntentResolutionRequest): Promise<IntentResolverResolveResult>
}

export type AIProviderConversationGenerationResult =
  | {
      readonly kind: 'success'
      readonly message: ChatMessage
    }
  | AIProviderFailure

export interface ConversationGeneratorProvider {
  generateConversation(
    response: ConversationResponse,
  ): Promise<AIProviderConversationGenerationResult>
}

export interface AIProvider {
  readonly metadata: AIProviderMetadata
  readonly resolveIntent?: IntentResolverProvider['resolveIntent']
  readonly generateConversation?: ConversationGeneratorProvider['generateConversation']
}
