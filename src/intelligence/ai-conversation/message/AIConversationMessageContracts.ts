import type { AIConversationId } from '../aiConversationContracts'
import type { AIConversationRole } from '../aiConversationContracts'
import type { AIConversationSessionId } from '../session/AIConversationSessionContracts'

export const AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION = 1 as const

export type AIConversationMessageId = string & {
  readonly __brand: 'AIConversationMessageId'
}

export const AI_CONVERSATION_MESSAGE_TYPES = ['TEXT'] as const
export type AIConversationMessageType = (typeof AI_CONVERSATION_MESSAGE_TYPES)[number]

export const AI_CONVERSATION_MESSAGE_FORMATS = ['PLAIN_TEXT'] as const
export type AIConversationMessageFormat =
  (typeof AI_CONVERSATION_MESSAGE_FORMATS)[number]

export interface AIConversationMessageContent {
  readonly kind: AIConversationMessageType
  readonly value: string
  readonly format: AIConversationMessageFormat
}

export const AI_CONVERSATION_MESSAGE_STATUSES = [
  'CREATED',
  'READY',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const
export type AIConversationMessageStatus =
  (typeof AI_CONVERSATION_MESSAGE_STATUSES)[number]

export type AIConversationMessageSequence = number & {
  readonly __brand: 'AIConversationMessageSequence'
}

export interface AIConversationMessageMetadata {
  readonly contractVersion: typeof AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION
  readonly generatedLocally: boolean
  readonly correlationId?: string
  readonly interactionId?: string
  readonly tags?: readonly string[]
}

export interface AIConversationMessage {
  readonly protocolVersion: typeof AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION
  readonly id: AIConversationMessageId
  readonly conversationId: AIConversationId
  readonly sessionId: AIConversationSessionId
  readonly role: AIConversationRole
  readonly content: AIConversationMessageContent
  readonly status: AIConversationMessageStatus
  readonly sequence: AIConversationMessageSequence
  readonly createdAt: string
  readonly metadata: AIConversationMessageMetadata
}

export const AI_CONVERSATION_MESSAGE_FAILURE_CODES = [
  'INVALID_MESSAGE',
  'INVALID_MESSAGE_ID',
  'INVALID_MESSAGE_CONTENT',
  'INVALID_MESSAGE_STATUS',
  'INVALID_MESSAGE_SEQUENCE',
  'INVALID_MESSAGE_METADATA',
  'INVALID_MESSAGE_CONVERSATION',
  'INVALID_MESSAGE_SESSION',
  'INVALID_MESSAGE_ROLE',
  'INVALID_MESSAGE_INTERACTION',
] as const

export type AIConversationMessageFailureCode =
  (typeof AI_CONVERSATION_MESSAGE_FAILURE_CODES)[number]

export interface AIConversationMessageFailure {
  readonly kind: 'failure'
  readonly messageId: string
  readonly code: AIConversationMessageFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface AIConversationMessageSuccess {
  readonly kind: 'success'
  readonly message: AIConversationMessage
}

export type AIConversationMessageResult =
  | AIConversationMessageSuccess
  | AIConversationMessageFailure

export interface CreateAIConversationMessageContentInput {
  readonly kind?: AIConversationMessageType
  readonly value: string
  readonly format?: AIConversationMessageFormat
}

export interface CreateAIConversationMessageInput {
  readonly id: string
  readonly conversationId: string
  readonly sessionId: string
  readonly role: AIConversationRole
  readonly content: CreateAIConversationMessageContentInput
  readonly status?: AIConversationMessageStatus
  readonly sequence: number
  readonly createdAt: string
  readonly metadata: Omit<AIConversationMessageMetadata, 'contractVersion'> & {
    readonly contractVersion?: typeof AI_CONVERSATION_MESSAGE_PROTOCOL_VERSION
  }
}
