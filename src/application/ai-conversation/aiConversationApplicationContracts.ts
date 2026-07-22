import type {
  AIConversationMessage,
  AIConversationSessionSnapshot,
  AIConversationService,
  StartAIConversationInput,
} from '../../intelligence/ai-conversation/service'
import type {
  AIExecutionPipeline,
} from '../../intelligence/execution-pipeline'

export const AI_CONVERSATION_APPLICATION_FAILURE_CODES = [
  'INVALID_REQUEST',
  'CONVERSATION_NOT_FOUND',
  'INVALID_CONVERSATION',
  'AI_UNAVAILABLE',
  'SEND_MESSAGE_FAILED',
] as const

export type AIConversationApplicationFailureCode =
  (typeof AI_CONVERSATION_APPLICATION_FAILURE_CODES)[number]

export interface AIConversationApplicationFailure {
  readonly kind: 'failure'
  readonly code: AIConversationApplicationFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface AIConversationApplicationSuccess<TValue> {
  readonly kind: 'success'
  readonly value: TValue
}

export type AIConversationApplicationResult<TValue> =
  | AIConversationApplicationSuccess<TValue>
  | AIConversationApplicationFailure

export const AI_CONVERSATION_APPLICATION_STATES = [
  'Idle',
  'Sending',
  'Receiving',
  'Success',
  'Error',
] as const

export type AIConversationApplicationState =
  (typeof AI_CONVERSATION_APPLICATION_STATES)[number]

export interface AIConversationApplicationSendRequest {
  readonly session: AIConversationSessionSnapshot | null
  readonly message: string
  readonly cancellationSignal?: AbortSignal | null
  readonly onStateChange?: (state: Exclude<AIConversationApplicationState, 'Idle'>) => void
}

export interface AIConversationApplicationSendResponse {
  readonly session: AIConversationSessionSnapshot
  readonly userMessage: AIConversationMessage
  readonly assistantMessage: AIConversationMessage
}

export interface AIConversationApplicationServiceDependencies {
  readonly conversationService: Pick<
    AIConversationService,
    | 'startConversation'
    | 'createAssistantMessage'
    | 'createUserMessage'
    | 'appendMessage'
  >
  readonly executionPipeline: AIExecutionPipeline
  readonly config: {
    readonly providerId: 'OPENAI'
    readonly model: string
    readonly resolutionStrategy?: 'DEFAULT' | 'MINIMAL' | 'CONVERSATION_ONLY' | 'APPLICATION_ONLY' | 'FINANCIAL_ONLY'
    readonly responseFormat?: 'TEXT' | 'JSON'
    readonly temperature?: number
    readonly maxOutputTokens?: number
    readonly timeoutMs?: number
  }
  readonly now?: () => string
  readonly idFactory?: {
    create(kind: 'execution'): string
  }
}

export interface AIConversationApplicationService {
  startConversation(
    input?: StartAIConversationInput,
  ): AIConversationApplicationResult<AIConversationSessionSnapshot>
  sendMessage(
    input: AIConversationApplicationSendRequest,
  ): Promise<AIConversationApplicationResult<AIConversationApplicationSendResponse>>
}
