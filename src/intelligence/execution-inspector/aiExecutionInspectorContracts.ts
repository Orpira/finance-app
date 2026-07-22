import type {
  AIConversationMessage,
  AIConversationSessionSnapshot,
} from '../ai-conversation'
import type {
  AIContext,
} from '../context-builder'
import type {
  AIExecutionRequest,
} from '../execution-pipeline'
import type {
  AIResolvedContext,
} from '../context-resolution'
import type {
  AIPromptJsonValue,
  AIPrompt,
} from '../prompt-builder'
import type {
  AIProviderRequest,
  AIProviderResponse,
} from '../provider'

export const AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION = 1 as const

export const AI_EXECUTION_STAGE_NAMES = [
  'CONTEXT_BUILD',
  'CONTEXT_RESOLUTION',
  'PROMPT_BUILD',
  'PROVIDER_REQUEST',
  'PROVIDER_RESPONSE',
  'ASSISTANT_MESSAGE',
  'CONVERSATION_UPDATE',
] as const

export type AIExecutionStageName = (typeof AI_EXECUTION_STAGE_NAMES)[number]

export const AI_EXECUTION_STAGE_STATUSES = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'SKIPPED',
] as const

export type AIExecutionStageStatus = (typeof AI_EXECUTION_STAGE_STATUSES)[number]

export const AI_EXECUTION_TRACE_STATUSES = [
  'RUNNING',
  'SUCCESS',
  'FAILED',
] as const

export type AIExecutionTraceStatus = (typeof AI_EXECUTION_TRACE_STATUSES)[number]

export interface AIExecutionSnapshotFailure {
  readonly code: string
  readonly safeMessage: string
}

export interface AIExecutionSnapshot {
  readonly protocolVersion: typeof AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly executionRequest?: AIExecutionRequest
  readonly context?: AIContext
  readonly resolvedContext?: AIResolvedContext
  readonly prompt?: AIPrompt
  readonly providerRequest?: AIProviderRequest
  readonly providerResponse?: AIProviderResponse
  readonly assistantMessage?: AIConversationMessage
  readonly session?: AIConversationSessionSnapshot
  readonly failure?: AIExecutionSnapshotFailure
}

export interface AIExecutionStage {
  readonly name: AIExecutionStageName
  readonly status: AIExecutionStageStatus
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly duration: number
  readonly snapshot: AIExecutionSnapshot
}

export interface AIExecutionTraceMetadata {
  readonly protocolVersion: typeof AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION
  readonly source: 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly status: AIExecutionTraceStatus
  readonly conversationId: string
  readonly sessionId: string
  readonly providerId: string
  readonly model: string
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIExecutionTrace {
  readonly protocolVersion: typeof AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION
  readonly id: string
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly stages: readonly AIExecutionStage[]
  readonly metadata: AIExecutionTraceMetadata
}

export const AI_EXECUTION_INSPECTOR_ERROR_CODES = [
  'INVALID_TRACE',
  'INVALID_TRACE_ID',
  'INVALID_TRACE_METADATA',
  'INVALID_STAGE',
  'INVALID_STAGE_NAME',
  'INVALID_STAGE_STATUS',
  'INVALID_STAGE_DURATION',
  'INVALID_STAGE_ORDER',
  'INVALID_SNAPSHOT',
  'INVALID_SNAPSHOT_CONTENT',
  'INVALID_TIMESTAMP',
] as const

export type AIExecutionInspectorErrorCode =
  (typeof AI_EXECUTION_INSPECTOR_ERROR_CODES)[number]

export interface AIExecutionInspectorFailure {
  readonly kind: 'failure'
  readonly code: AIExecutionInspectorErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIExecutionSnapshotSuccess {
  readonly kind: 'success'
  readonly snapshot: AIExecutionSnapshot
}

export interface AIExecutionStageSuccess {
  readonly kind: 'success'
  readonly stage: AIExecutionStage
}

export interface AIExecutionTraceSuccess {
  readonly kind: 'success'
  readonly trace: AIExecutionTrace
}

export type AIExecutionSnapshotResult = AIExecutionSnapshotSuccess | AIExecutionInspectorFailure
export type AIExecutionStageResult = AIExecutionStageSuccess | AIExecutionInspectorFailure
export type AIExecutionTraceResult = AIExecutionTraceSuccess | AIExecutionInspectorFailure

export interface CreateAIExecutionSnapshotInput {
  readonly createdAt: string
  readonly executionRequest?: AIExecutionRequest
  readonly context?: AIContext
  readonly resolvedContext?: AIResolvedContext
  readonly prompt?: AIPrompt
  readonly providerRequest?: AIProviderRequest
  readonly providerResponse?: AIProviderResponse
  readonly assistantMessage?: AIConversationMessage
  readonly session?: AIConversationSessionSnapshot
  readonly failure?: AIExecutionSnapshotFailure
}

export interface CreateAIExecutionStageInput {
  readonly name: AIExecutionStageName
  readonly status: AIExecutionStageStatus
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly duration: number
  readonly snapshot: AIExecutionSnapshot
}

export interface CreateAIExecutionTraceInput {
  readonly id: string
  readonly startedAt: string
  readonly finishedAt?: string | null
  readonly stages: readonly AIExecutionStage[]
  readonly metadata: Omit<
    AIExecutionTraceMetadata,
    'protocolVersion' | 'source' | 'deterministic' | 'failClosed'
  > & {
    readonly protocolVersion?: typeof AI_EXECUTION_INSPECTOR_PROTOCOL_VERSION
    readonly source?: 'SYSTEM'
    readonly deterministic?: true
    readonly failClosed?: true
  }
}

export interface AIExecutionInspector {
  beginTrace(input: {
    readonly id: string
    readonly startedAt: string
    readonly metadata: Omit<
      AIExecutionTraceMetadata,
      'protocolVersion' | 'source' | 'deterministic' | 'failClosed' | 'status'
    >
  }): void
  captureStage(input: {
    readonly name: AIExecutionStageName
    readonly status: Exclude<AIExecutionStageStatus, 'PENDING'>
    readonly startedAt: string
    readonly finishedAt: string
    readonly duration: number
    readonly snapshot: CreateAIExecutionSnapshotInput
  }): void
  finishTrace(input: {
    readonly finishedAt: string
    readonly status: Exclude<AIExecutionTraceStatus, 'RUNNING'>
  }): void
  exportTrace(): AIExecutionTrace | null
}

export interface AIExecutionInspectorStageViewModel {
  readonly key: AIExecutionStageName
  readonly label: string
  readonly status: AIExecutionStageStatus
  readonly durationLabel: string
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly sections: readonly {
    readonly label: string
    readonly json: string
  }[]
}

export interface AIExecutionInspectorViewModel {
  readonly traceId: string
  readonly status: AIExecutionTraceStatus
  readonly startedAt: string
  readonly finishedAt: string | null
  readonly totalDurationLabel: string
  readonly stages: readonly AIExecutionInspectorStageViewModel[]
}
