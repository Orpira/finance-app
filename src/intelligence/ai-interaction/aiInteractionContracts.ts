import type { AIAllowedPurpose, AIProcessingMode } from '../ai-foundation/aiFoundationContracts'

export const AI_INTERACTION_PROTOCOL_VERSION = 1 as const

export const AI_INTERACTION_INTENTS = [
  'EXPLAIN_INSIGHT',
  'SUMMARIZE_FINANCIAL_STATE',
  'GENERATE_ACTION_OPTIONS',
  'CLASSIFY_USER_QUERY',
  'EDUCATIONAL_GUIDANCE',
  'DIAGNOSTIC_ANALYSIS',
] as const
export type AIInteractionIntent = (typeof AI_INTERACTION_INTENTS)[number]

export const AI_INTERACTION_CAPABILITIES = [
  'TEXT_GENERATION',
  'STRUCTURED_OUTPUT',
  'CONTEXT_GROUNDING',
  'CLASSIFICATION',
  'EXPLANATION',
] as const
export type AIInteractionCapability = (typeof AI_INTERACTION_CAPABILITIES)[number]

export const AI_INTERACTION_STATUSES = [
  'CREATED',
  'AUTHORIZED',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const
export type AIInteractionStatus = (typeof AI_INTERACTION_STATUSES)[number]

export interface AIInteractionPolicyRef {
  readonly policyId: string
  readonly policyVersion: string
  readonly purpose: AIAllowedPurpose
  readonly processingMode: AIProcessingMode
}

export interface AIInteractionMetadata {
  readonly createdAt: string
  readonly correlationId?: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'AUTOMATION' | 'SYSTEM'
  readonly tags?: readonly string[]
}

export interface AIInteraction {
  readonly protocolVersion: typeof AI_INTERACTION_PROTOCOL_VERSION
  readonly interactionId: string
  readonly intent: AIInteractionIntent
  readonly requiredCapabilities: readonly AIInteractionCapability[]
  readonly policy: AIInteractionPolicyRef
  readonly status: AIInteractionStatus
  readonly metadata: AIInteractionMetadata
}

export const AI_INTERACTION_FAILURE_CODES = [
  'INVALID_INTERACTION',
  'UNSUPPORTED_INTENT',
  'UNSUPPORTED_CAPABILITY',
  'POLICY_REJECTED',
  'AUTHORIZATION_REQUIRED',
  'PROVIDER_UNAVAILABLE',
  'ADAPTER_FAILURE',
  'CANCELLED',
] as const
export type AIInteractionFailureCode = (typeof AI_INTERACTION_FAILURE_CODES)[number]

export interface AIInteractionFailure {
  readonly kind: 'failure'
  readonly interactionId: string
  readonly code: AIInteractionFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface AIInteractionSuccess<TOutput = unknown> {
  readonly kind: 'success'
  readonly interactionId: string
  readonly policyId: string
  readonly policyVersion: string
  readonly output: TOutput
  readonly completedAt: string
}

export type AIInteractionResult<TOutput = unknown> =
  | AIInteractionSuccess<TOutput>
  | AIInteractionFailure
