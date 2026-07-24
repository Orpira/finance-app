import type { AIToolFailure, AIToolJsonValue, AIToolPermission } from '../ai-tools'
import type { PromptContext, PromptContextId } from '../prompt-context-builder'

export const AI_RESPONSE_COMPOSER_PROTOCOL_VERSION = 1 as const

export type ConversationResponseId = string & {
  readonly __brand: 'ConversationResponseId'
}

export const CONVERSATION_RESPONSE_FAILURE_CODES = [
  'INVALID_CONVERSATION_RESPONSE',
  'INVALID_CONVERSATION_RESPONSE_ID',
  'INVALID_CONVERSATION_RESPONSE_METADATA',
  'INVALID_CONVERSATION_RESPONSE_PROMPT_CONTEXT',
  'INVALID_CONVERSATION_RESPONSE_BLOCKS',
  'INVALID_CONVERSATION_RESPONSE_BLOCK',
  'INVALID_CONVERSATION_RESPONSE_SERIALIZATION',
] as const

export type ConversationResponseFailureCode = (typeof CONVERSATION_RESPONSE_FAILURE_CODES)[number]

export interface ConversationResponseFailure {
  readonly kind: 'failure'
  readonly code: ConversationResponseFailureCode
  readonly retryable: false
  readonly safeMessage: string
  readonly details?: Readonly<Record<string, AIToolJsonValue>>
}

export interface ConversationResponseMetadata {
  readonly protocolVersion: typeof AI_RESPONSE_COMPOSER_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIToolJsonValue>>
}

export interface ConversationResponseExecutionMetadata {
  readonly promptContextId: PromptContextId
  readonly executionId: PromptContext['execution']['executionId']
  readonly startedAt: string
  readonly finishedAt: string
  readonly status: PromptContext['execution']['status']
  readonly blockCount: number
  readonly stepCount: number
  readonly successCount: number
  readonly failureCount: number
}

export interface ConversationResponseSummaryBlock {
  readonly kind: 'summary'
  readonly blockId: string
  readonly promptContextId: PromptContextId
  readonly executionId: PromptContext['execution']['executionId']
  readonly status: PromptContext['execution']['status']
  readonly stepCount: number
  readonly successCount: number
  readonly failureCount: number
}

export interface ConversationResponseStepSuccessBlock {
  readonly kind: 'step-success'
  readonly blockId: string
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly resolvedToolName: string
  readonly permission: AIToolPermission
  readonly durationMs: number
  readonly output: AIToolJsonValue
}

export interface ConversationResponseStepFailureBlock {
  readonly kind: 'step-failure'
  readonly blockId: string
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly error: AIToolFailure
}

export type ConversationResponseBlock =
  | ConversationResponseSummaryBlock
  | ConversationResponseStepSuccessBlock
  | ConversationResponseStepFailureBlock

export interface ConversationResponse {
  readonly protocolVersion: typeof AI_RESPONSE_COMPOSER_PROTOCOL_VERSION
  readonly responseId: ConversationResponseId
  readonly promptContext: PromptContext
  readonly execution: ConversationResponseExecutionMetadata
  readonly metadata: ConversationResponseMetadata
  readonly blocks: readonly ConversationResponseBlock[]
}

export interface ConversationResponseSuccess {
  readonly kind: 'success'
  readonly response: ConversationResponse
}

export type ConversationResponseResult = ConversationResponseSuccess | ConversationResponseFailure

export interface CreateConversationResponseInput {
  readonly promptContext: PromptContext
  readonly createdAt?: string
  readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIToolJsonValue>>
}
