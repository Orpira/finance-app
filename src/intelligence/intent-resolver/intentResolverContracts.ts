import type { AIConversationRequest } from '../ai-conversation'

export const INTENT_RESOLVER_PROTOCOL_VERSION = 1 as const

export const INTENT_RESOLVER_FAILURE_CODES = [
  'INVALID_INTENT_REQUEST',
  'INVALID_INTENT_RESULT',
  'INVALID_INTENT_PROVIDER',
  'INTENT_RESOLUTION_FAILED',
] as const

export type IntentResolverFailureCode =
  (typeof INTENT_RESOLVER_FAILURE_CODES)[number]

export type IntentResolutionDetectedIntent =
  | 'balance'
  | 'transactions'
  | 'budget'
  | 'goals'
  | 'reports'
  | 'insights'
  | 'unknown'

export interface IntentResolutionToolSelection {
  readonly toolId: string
  readonly arguments: AIConversationRequest['steps'][number]['arguments']
}

export interface IntentResolutionRequest {
  readonly protocolVersion: typeof INTENT_RESOLVER_PROTOCOL_VERSION
  readonly conversationRequest: AIConversationRequest
  readonly metadata: {
    readonly userMessage: string
    readonly turn: number
    readonly requestedAt: string
  }
}

export interface IntentResolutionResult {
  readonly protocolVersion: typeof INTENT_RESOLVER_PROTOCOL_VERSION
  readonly detectedIntent: IntentResolutionDetectedIntent
  readonly confidence: number
  readonly tools: readonly IntentResolutionToolSelection[]
  readonly reasoning: string
  readonly provider: string
  readonly timestamp: string
}

export interface IntentResolverFailure {
  readonly kind: 'failure'
  readonly code: IntentResolverFailureCode
  readonly retryable: false
  readonly safeMessage: string
}

export type IntentResolverResolveResult =
  | {
      readonly kind: 'success'
      readonly resolution: IntentResolutionResult
    }
  | IntentResolverFailure

export interface IntentResolver {
  resolve(request: IntentResolutionRequest): Promise<IntentResolverResolveResult>
}
