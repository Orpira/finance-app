import type { AIToolJsonValue } from '../ai-tools'
import type {
  AIConversationExecutionResult,
  AIConversationOrchestrator,
  AIConversationOrchestratorRequest,
} from '../conversation-orchestrator'
import type { PromptContext } from '../prompt-context-builder'
import type { ConversationResponse } from '../response-composer'

export const AI_CONVERSATION_FACADE_PROTOCOL_VERSION = 1 as const

export const AI_CONVERSATION_FACADE_FAILURE_CODES = [
  'INVALID_CONVERSATION_REQUEST',
  'INVALID_CONVERSATION_EXECUTION_RESULT',
  'INVALID_PROMPT_CONTEXT',
  'INVALID_CONVERSATION_RESPONSE',
  'CONVERSATION_ORCHESTRATION_FAILED',
  'PROMPT_CONTEXT_BUILD_FAILED',
  'CONVERSATION_RESPONSE_BUILD_FAILED',
] as const

export type AIConversationFacadeFailureCode =
  (typeof AI_CONVERSATION_FACADE_FAILURE_CODES)[number]

export interface AIConversationFacadeFailure {
  readonly kind: 'failure'
  readonly code: AIConversationFacadeFailureCode
  readonly retryable: false
  readonly safeMessage: string
  readonly details?: Readonly<Record<string, AIToolJsonValue>>
}

export interface AIConversationFacadeSuccess {
  readonly kind: 'success'
  readonly response: ConversationResponse
}

export type AIConversationFacadeResult =
  | AIConversationFacadeSuccess
  | AIConversationFacadeFailure

export type AIConversationRequest = AIConversationOrchestratorRequest
export type AIConversationExecution = AIConversationExecutionResult

export interface CreateAIConversationFacadeInput {
  readonly orchestrator: AIConversationOrchestrator
  readonly promptContextBuilder: {
    build(input: { readonly executionResult: AIConversationExecution }):
      | { readonly kind: 'success'; readonly context: PromptContext }
      | AIConversationFacadeFailure
  }
  readonly responseComposer: {
    build(input: { readonly promptContext: PromptContext }):
      | { readonly kind: 'success'; readonly response: ConversationResponse }
      | AIConversationFacadeFailure
  }
}

export interface AIConversationFacade {
  execute(request: AIConversationRequest): Promise<AIConversationFacadeResult>
}
