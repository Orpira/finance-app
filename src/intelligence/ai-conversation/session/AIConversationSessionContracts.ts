import type {
  AIConversation,
  AIConversationParticipant,
} from '../aiConversationContracts'
import type { AIInteractionPolicyDecisionKind } from '../../ai-interaction/policies'
import type { AIInteractionState } from '../../ai-interaction/lifecycle'
import type { AIConversationSessionStatus } from './AIConversationSessionStatus'
import type { AIConversationMessage } from '../message/AIConversationMessageContracts'

export const AI_CONVERSATION_SESSION_PROTOCOL_VERSION = 1 as const

export type AIConversationSessionId = string & {
  readonly __brand: 'AIConversationSessionId'
}

export interface AIConversationSessionMetadata {
  readonly createdAt: string
  readonly updatedAt?: string
  readonly source: 'APPLICATION' | 'AUTOMATION' | 'SYSTEM'
  readonly tags?: readonly string[]
}

export interface AIConversationSessionInteraction {
  readonly interactionId: string
  readonly lifecycleState: AIInteractionState
  readonly policyDecision: AIInteractionPolicyDecisionKind
}

export interface AIConversationSessionSnapshot {
  readonly protocolVersion: typeof AI_CONVERSATION_SESSION_PROTOCOL_VERSION
  readonly sessionId: AIConversationSessionId
  readonly conversation: AIConversation
  readonly status: AIConversationSessionStatus
  readonly participants: readonly AIConversationParticipant[]
  readonly messages: readonly AIConversationMessage[]
  readonly metadata: AIConversationSessionMetadata
  readonly interaction: AIConversationSessionInteraction | null
}

export interface CreateAIConversationSessionInput {
  readonly sessionId: string
  readonly conversation: AIConversation
  readonly status?: AIConversationSessionStatus
  readonly messages?: readonly AIConversationMessage[]
  readonly metadata: AIConversationSessionMetadata
}

export const AI_CONVERSATION_SESSION_FAILURE_CODES = [
  'INVALID_SESSION',
  'INVALID_SESSION_ID',
  'INVALID_SESSION_STATUS',
  'INVALID_SESSION_METADATA',
  'INVALID_SESSION_TRANSITION',
  'INVALID_SESSION_MESSAGES',
  'INVALID_INTERACTION',
  'POLICY_DENIED',
  'INTERACTION_LIFECYCLE_ERROR',
] as const

export type AIConversationSessionFailureCode =
  (typeof AI_CONVERSATION_SESSION_FAILURE_CODES)[number]

export interface AIConversationSessionFailure {
  readonly kind: 'failure'
  readonly sessionId: string
  readonly code: AIConversationSessionFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface AIConversationSessionSuccess {
  readonly kind: 'success'
  readonly session: AIConversationSessionSnapshot
}

export type AIConversationSessionResult =
  | AIConversationSessionSuccess
  | AIConversationSessionFailure
