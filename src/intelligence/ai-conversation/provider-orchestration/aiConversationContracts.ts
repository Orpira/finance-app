import type {
  AIConversationRequest,
  AIConversationFacade,
  AIConversationFacadeResult,
} from '../aiConversationFacadeContracts'
import type {
  AIProvider,
  AIProviderFailure,
} from '../../ai-provider/aiProviderContracts'
import type {
  ChatMessage,
} from '../../mock-conversational-renderer/mockConversationalRenderer'
import type {
  IntentResolverResolveResult,
} from '../../intent-resolver/intentResolver'

export const AI_CONVERSATION_SERVICE_PROTOCOL_VERSION = 1 as const

export const AI_CONVERSATION_SERVICE_FAILURE_CODES = [
  'INVALID_SERVICE_INPUT',
  'INTENT_RESOLUTION_FAILED',
  'CONFIDENCE_TOO_LOW',
  'FACADE_EXECUTION_FAILED',
  'CONVERSATION_GENERATION_FAILED',
  'PROVIDER_UNAVAILABLE',
] as const

export type AIConversationServiceFailureCode =
  (typeof AI_CONVERSATION_SERVICE_FAILURE_CODES)[number]

export interface AIConversationServiceFailure {
  readonly kind: 'failure'
  readonly code: AIConversationServiceFailureCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIConversationExecution {
  readonly protocolVersion: typeof AI_CONVERSATION_SERVICE_PROTOCOL_VERSION
  readonly provider: string
  readonly intent: string
  readonly confidence: number
  readonly conversationGenerated: boolean
  readonly executionTime: number
  readonly fallbackUsed: boolean
  readonly success: boolean
  readonly error: string | null
}

export interface AIConversationServiceSuccess {
  readonly kind: 'success'
  readonly message: ChatMessage
  readonly execution: AIConversationExecution
}

export type AIConversationServiceResult =
  | AIConversationServiceSuccess
  | AIConversationServiceFailure

export interface AIConversationConfidencePolicy {
  readonly confidenceThreshold: number
}

export interface AIConversationServiceInput {
  readonly conversationRequest: AIConversationRequest
  readonly userMessage: string
  readonly turn: number
  readonly requestedAt?: string
}

export interface AIConversationServiceDependencies {
  readonly facade: AIConversationFacade
  readonly provider: AIProvider
  readonly fallbackProvider: AIProvider
  readonly confidencePolicy: AIConversationConfidencePolicy
  readonly now?: () => string
  readonly clock?: () => number
  readonly metrics?: {
    readonly record: (entry: {
      readonly provider: string
      readonly durationMs: number
      readonly operation: string
      readonly fallbackUsed: boolean
      readonly success: boolean
      readonly errorCode?: string
    }) => void
  }
}

export interface AIConversationService {
  processConversation(
    input: AIConversationServiceInput,
  ): Promise<AIConversationServiceResult>
}

export interface AIConversationIntentResultSuccess {
  readonly providerUsed: AIProvider
  readonly providerId: string
  readonly fallbackUsed: boolean
  readonly resolution: Extract<IntentResolverResolveResult, { readonly kind: 'success' }>
}

export type AIConversationIntentResolutionResult =
  | AIConversationIntentResultSuccess
  | AIProviderFailure

export type AIConversationFacadeExecutionResult =
  | Extract<AIConversationFacadeResult, { readonly kind: 'success' }>
  | Extract<AIConversationFacadeResult, { readonly kind: 'failure' }>
