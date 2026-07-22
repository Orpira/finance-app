export const AI_CONVERSATION_PROTOCOL_VERSION = 1 as const

export const AI_CONVERSATION_STATUSES = [
  'OPEN',
  'ACTIVE',
  'ON_HOLD',
  'CLOSED',
] as const
export type AIConversationStatus = (typeof AI_CONVERSATION_STATUSES)[number]

export const AI_CONVERSATION_ROLES = [
  'USER',
  'ASSISTANT',
  'SYSTEM',
] as const
export type AIConversationRole = (typeof AI_CONVERSATION_ROLES)[number]

export type AIConversationId = string & { readonly __brand: 'AIConversationId' }

export interface AIConversationParticipant {
  readonly participantId: string
  readonly role: AIConversationRole
  readonly displayName?: string
  readonly active: boolean
}

export interface AIConversationMetadata {
  readonly createdAt: string
  readonly updatedAt?: string
  readonly source: 'APPLICATION' | 'AUTOMATION' | 'SYSTEM'
  readonly tags?: readonly string[]
}

export interface AIConversation {
  readonly protocolVersion: typeof AI_CONVERSATION_PROTOCOL_VERSION
  readonly conversationId: AIConversationId
  readonly status: AIConversationStatus
  readonly participants: readonly AIConversationParticipant[]
  readonly metadata: AIConversationMetadata
}

export const AI_CONVERSATION_FAILURE_CODES = [
  'INVALID_CONVERSATION',
  'INVALID_CONVERSATION_ID',
  'INVALID_CONVERSATION_STATUS',
  'INVALID_PARTICIPANT',
  'INVALID_ROLE',
  'INVALID_METADATA',
] as const
export type AIConversationFailureCode =
  (typeof AI_CONVERSATION_FAILURE_CODES)[number]

export interface AIConversationFailure {
  readonly kind: 'failure'
  readonly conversationId: string
  readonly code: AIConversationFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface AIConversationSuccess {
  readonly kind: 'success'
  readonly conversation: AIConversation
}

export type AIConversationResult = AIConversationSuccess | AIConversationFailure
