import type {
  AIConversation,
  AIConversationMessage,
  AIConversationSessionSnapshot,
  AIConversationService,
} from '../ai-conversation'
import type {
  AIContext,
  AIContextResult,
} from '../context-builder'
import type {
  AIContextResolutionResult,
  AIResolvedContext,
  AIResolutionStrategy,
} from '../context-resolution'
import type {
  AIPromptJsonValue,
  AIPromptResult,
} from '../prompt-builder'
import type {
  AIProvider,
  AIProviderId,
  AIProviderResponse,
  AIProviderResponseFormat,
} from '../provider'
import type {
  AIToolExecutor,
} from '../ai-tools'
import type {
  AIExecutionInspector,
} from '../execution-inspector'

export const AI_EXECUTION_PROTOCOL_VERSION = 1 as const

export type AIExecutionId = string & {
  readonly __brand: 'AIExecutionId'
}

export interface AIExecutionMetadata {
  readonly protocolVersion: typeof AI_EXECUTION_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly providerId: AIProviderId
  readonly model: string
  readonly resolutionStrategy?: AIResolutionStrategy
  readonly temperature?: number
  readonly maxOutputTokens?: number
  readonly timeoutMs?: number
  readonly responseFormat?: AIProviderResponseFormat
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIExecutionRequest {
  readonly protocolVersion: typeof AI_EXECUTION_PROTOCOL_VERSION
  readonly id: AIExecutionId
  readonly conversation: AIConversation
  readonly session: AIConversationSessionSnapshot
  readonly userMessage: AIConversationMessage
  readonly metadata: AIExecutionMetadata
}

export interface AIExecutionResponseMetadata {
  readonly protocolVersion: typeof AI_EXECUTION_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly requestId: AIExecutionId
  readonly conversationId: string
  readonly sessionId: string
  readonly contextId: string
  readonly resolvedContextId: string
  readonly promptId: string
  readonly providerId: AIProviderId
  readonly model: string
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIExecutionResponse {
  readonly protocolVersion: typeof AI_EXECUTION_PROTOCOL_VERSION
  readonly id: AIExecutionId
  readonly session: AIConversationSessionSnapshot
  readonly assistantMessage: AIConversationMessage
  readonly providerResponse: AIProviderResponse
  readonly metadata: AIExecutionResponseMetadata
}

export const AI_EXECUTION_ERROR_CODES = [
  'INVALID_EXECUTION_ID',
  'INVALID_EXECUTION_REQUEST',
  'INVALID_EXECUTION_RESPONSE',
  'INVALID_EXECUTION_METADATA',
  'INVALID_CONVERSATION',
  'INVALID_SESSION',
  'INVALID_MESSAGE',
  'CONTEXT_BUILD_FAILED',
  'CONTEXT_RESOLUTION_FAILED',
  'PROMPT_BUILD_FAILED',
  'PROVIDER_EXECUTION_FAILED',
  'TOOL_EXECUTION_FAILED',
  'CONVERSATION_UPDATE_FAILED',
  'PIPELINE_EXECUTION_FAILED',
] as const

export type AIExecutionErrorCode = (typeof AI_EXECUTION_ERROR_CODES)[number]

export interface AIExecutionFailure {
  readonly kind: 'failure'
  readonly code: AIExecutionErrorCode
  readonly retryable: boolean
  readonly safeMessage: string
  readonly details?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIExecutionRequestSuccess {
  readonly kind: 'success'
  readonly request: AIExecutionRequest
}

export interface AIExecutionResponseSuccess {
  readonly kind: 'success'
  readonly response: AIExecutionResponse
}

export interface AIExecutionSuccess {
  readonly kind: 'success'
  readonly response: AIExecutionResponse
}

export type AIExecutionRequestResult = AIExecutionRequestSuccess | AIExecutionFailure
export type AIExecutionResponseResult = AIExecutionResponseSuccess | AIExecutionFailure
export type AIExecutionResult = AIExecutionSuccess | AIExecutionFailure

export interface AIExecutionContextBuilderPort {
  buildContext(input: {
    readonly request: AIExecutionRequest
  }): AIContextResult
}

export interface AIExecutionContextResolverPort {
  resolveContext(input: {
    readonly request: AIExecutionRequest
    readonly context: AIContext
  }): AIContextResolutionResult
}

export interface AIExecutionPromptBuilderPort {
  buildPrompt(input: {
    readonly request: AIExecutionRequest
    readonly context: AIContext
    readonly resolvedContext: AIResolvedContext
  }): AIPromptResult
}

export type AIExecutionConversationPort = Pick<
  AIConversationService,
  'createAssistantMessage' | 'appendMessage'
>

export interface AIExecutionPipelineDependencies {
  readonly conversationPort: AIExecutionConversationPort
  readonly contextBuilder: AIExecutionContextBuilderPort
  readonly contextResolver: AIExecutionContextResolverPort
  readonly promptBuilder: AIExecutionPromptBuilderPort
  readonly provider: AIProvider
  readonly toolExecutor?: AIToolExecutor
  readonly inspector?: AIExecutionInspector
}

export interface AIExecutionPipeline {
  execute(request: AIExecutionRequest): Promise<AIExecutionResult>
}

export interface CreateAIExecutionRequestInput {
  readonly id: string
  readonly conversation: AIConversation
  readonly session: AIConversationSessionSnapshot
  readonly userMessage: AIConversationMessage
  readonly metadata: Omit<
    AIExecutionMetadata,
    'protocolVersion' | 'deterministic' | 'failClosed'
  > & {
    readonly protocolVersion?: typeof AI_EXECUTION_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}

export interface CreateAIExecutionResponseInput {
  readonly id: string
  readonly session: AIConversationSessionSnapshot
  readonly assistantMessage: AIConversationMessage
  readonly providerResponse: AIProviderResponse
  readonly metadata: Omit<
    AIExecutionResponseMetadata,
    'protocolVersion' | 'deterministic' | 'failClosed'
  > & {
    readonly protocolVersion?: typeof AI_EXECUTION_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}
