import type {
  ConversationResponse,
  ConversationResponseStepSuccessBlock,
} from '../response-composer'

export const MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION = 1 as const

export const MOCK_CONVERSATIONAL_RENDERER_FAILURE_CODES = [
  'INVALID_RENDER_RULES',
  'INVALID_CHAT_MESSAGE',
] as const

export type MockConversationalRendererFailureCode =
  (typeof MOCK_CONVERSATIONAL_RENDERER_FAILURE_CODES)[number]

export interface MockConversationalRendererFailure {
  readonly kind: 'failure'
  readonly code: MockConversationalRendererFailureCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface ChatMessage {
  readonly protocolVersion: typeof MOCK_CONVERSATIONAL_RENDERER_PROTOCOL_VERSION
  readonly messageId: string
  readonly type: 'assistant' | 'error'
  readonly origin: 'MOCK_RENDERER'
  readonly timestamp: string
  readonly text: string
  readonly responseId: ConversationResponse['responseId']
  readonly conversationResponse: ConversationResponse
  readonly traceability: {
    readonly executionId: ConversationResponse['execution']['executionId']
    readonly promptContextId: ConversationResponse['execution']['promptContextId']
  }
}

export type MockConversationalRendererResult =
  | {
      readonly kind: 'success'
      readonly message: ChatMessage
    }
  | MockConversationalRendererFailure

export interface MockConversationalRenderRule {
  readonly ruleId: string
  readonly toolIds: readonly string[]
  readonly render: (input: {
    readonly stepBlock: ConversationResponseStepSuccessBlock
    readonly response: ConversationResponse
  }) => string
}

export interface MockConversationalRenderer {
  render(response: ConversationResponse): MockConversationalRendererResult
}
