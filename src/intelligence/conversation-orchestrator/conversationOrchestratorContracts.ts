import type {
  AIToolContext,
  AIToolExecutionResult,
  AIToolFailure,
  AIToolJsonValue,
} from '../ai-tools'

export const AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION = 1 as const

export type AIConversationOrchestratorExecutionId = string & {
  readonly __brand: 'AIConversationOrchestratorExecutionId'
}

export interface AIConversationToolCallRequest {
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly arguments: Readonly<Record<string, AIToolJsonValue>>
  readonly timeoutMs?: number
}

export interface AIConversationOrchestratorRequest {
  readonly protocolVersion: typeof AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION
  readonly executionId: AIConversationOrchestratorExecutionId
  readonly context: AIToolContext
  readonly steps: readonly AIConversationToolCallRequest[]
}

export interface AIConversationOrchestratorExecutionSuccess {
  readonly kind: 'success'
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly resolvedToolName: string
  readonly execution: Extract<AIToolExecutionResult, { readonly kind: 'success' }>['value']
}

export interface AIConversationOrchestratorExecutionFailure {
  readonly kind: 'failure'
  readonly stepId: string
  readonly order: number
  readonly toolId: string
  readonly error: AIToolFailure
}

export type AIConversationOrchestratorStepResult =
  | AIConversationOrchestratorExecutionSuccess
  | AIConversationOrchestratorExecutionFailure

export interface AIConversationOrchestratorSummary {
  readonly totalSteps: number
  readonly successfulSteps: number
  readonly failedSteps: number
}

export interface AIConversationExecutionResult {
  readonly executionId: AIConversationOrchestratorExecutionId
  readonly startedAt: string
  readonly finishedAt: string
  readonly status: 'success' | 'partial-failure'
  readonly summary: AIConversationOrchestratorSummary
  readonly steps: readonly AIConversationOrchestratorStepResult[]
}

export type AIConversationOrchestratorResult =
  | {
      readonly kind: 'success'
      readonly result: AIConversationExecutionResult
    }
  | AIToolFailure

export interface AIConversationOrchestrator {
  execute(request: AIConversationOrchestratorRequest): Promise<AIConversationOrchestratorResult>
}

export interface CreateAIConversationOrchestratorRequestInput {
  readonly protocolVersion?: typeof AI_CONVERSATION_ORCHESTRATOR_PROTOCOL_VERSION
  readonly executionId: string
  readonly context: AIToolContext
  readonly steps: readonly AIConversationToolCallRequest[]
}
