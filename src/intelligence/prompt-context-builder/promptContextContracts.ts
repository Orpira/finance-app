import type { AIToolFailure, AIToolJsonValue, AIToolPermission } from '../ai-tools'
import type {
  AIConversationExecutionResult,
  AIConversationOrchestratorExecutionId,
} from '../conversation-orchestrator'

export const AI_PROMPT_CONTEXT_PROTOCOL_VERSION = 1 as const

export type PromptContextId = string & {
  readonly __brand: 'PromptContextId'
}

export const PROMPT_CONTEXT_FAILURE_CODES = [
  'INVALID_PROMPT_CONTEXT',
  'INVALID_PROMPT_CONTEXT_ID',
  'INVALID_PROMPT_CONTEXT_METADATA',
  'INVALID_PROMPT_CONTEXT_EXECUTION',
  'INVALID_PROMPT_CONTEXT_STEPS',
  'INVALID_PROMPT_CONTEXT_STEP',
  'INVALID_PROMPT_CONTEXT_SERIALIZATION',
] as const

export type PromptContextFailureCode = (typeof PROMPT_CONTEXT_FAILURE_CODES)[number]

export interface PromptContextFailure {
  readonly kind: 'failure'
  readonly code: PromptContextFailureCode
  readonly retryable: false
  readonly safeMessage: string
  readonly details?: Readonly<Record<string, AIToolJsonValue>>
}

export interface PromptContextMetadata {
  readonly protocolVersion: typeof AI_PROMPT_CONTEXT_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIToolJsonValue>>
}

export interface PromptContextExecutionMetadata {
  readonly executionId: AIConversationOrchestratorExecutionId
  readonly startedAt: string
  readonly finishedAt: string
  readonly status: 'success' | 'partial-failure'
}

export interface PromptContextStepSuccess {
  readonly kind: 'success'
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly resolvedToolName: string
  readonly permission: AIToolPermission
  readonly durationMs: number
  readonly output: AIToolJsonValue
}

export interface PromptContextStepFailure {
  readonly kind: 'failure'
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly error: AIToolFailure
}

export type PromptContextStep = PromptContextStepSuccess | PromptContextStepFailure

export interface PromptContext {
  readonly protocolVersion: typeof AI_PROMPT_CONTEXT_PROTOCOL_VERSION
  readonly contextId: PromptContextId
  readonly execution: PromptContextExecutionMetadata
  readonly metadata: PromptContextMetadata
  readonly steps: readonly PromptContextStep[]
}

export interface PromptContextSuccess {
  readonly kind: 'success'
  readonly context: PromptContext
}

export type PromptContextResult = PromptContextSuccess | PromptContextFailure

export interface CreatePromptContextInput {
  readonly executionResult: AIConversationExecutionResult
  readonly createdAt?: string
  readonly source?: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIToolJsonValue>>
}
