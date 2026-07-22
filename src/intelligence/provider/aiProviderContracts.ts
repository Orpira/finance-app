import type {
  AIPrompt,
  AIPromptJsonValue,
} from '../prompt-builder'

export const AI_PROVIDER_PROTOCOL_VERSION = 1 as const

export type AIProviderRequestId = string & {
  readonly __brand: 'AIProviderRequestId'
}

export type AIProviderResponseId = string & {
  readonly __brand: 'AIProviderResponseId'
}

export const AI_PROVIDER_IDS = ['OPENAI'] as const

export type AIProviderId = (typeof AI_PROVIDER_IDS)[number]

export const AI_PROVIDER_FINISH_REASONS = [
  'STOP',
  'MAX_TOKENS',
  'CONTENT_FILTER',
  'CANCELLED',
  'ERROR',
  'UNKNOWN',
] as const

export type AIProviderFinishReason = (typeof AI_PROVIDER_FINISH_REASONS)[number]

export type AIProviderResponseFormat = 'TEXT' | 'JSON'

export interface AIProviderMetadata {
  readonly protocolVersion: typeof AI_PROVIDER_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIProviderRequestMetadata extends AIProviderMetadata {
  readonly providerId: AIProviderId
  readonly model: string
  readonly temperature?: number
  readonly maxOutputTokens?: number
  readonly timeoutMs?: number
  readonly responseFormat?: AIProviderResponseFormat
}

export interface AIProviderUsage {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
}

export interface AIProviderResponseMetadata extends AIProviderMetadata {
  readonly requestId: AIProviderRequestId
  readonly providerId: AIProviderId
  readonly model: string
  readonly latencyMs?: number
}

export interface AIProviderRequest {
  readonly protocolVersion: typeof AI_PROVIDER_PROTOCOL_VERSION
  readonly id: AIProviderRequestId
  readonly prompt: AIPrompt
  readonly metadata: AIProviderRequestMetadata
}

export interface AIProviderResponse {
  readonly protocolVersion: typeof AI_PROVIDER_PROTOCOL_VERSION
  readonly id: AIProviderResponseId
  readonly content: string
  readonly usage: AIProviderUsage
  readonly finishReason: AIProviderFinishReason
  readonly metadata: AIProviderResponseMetadata
}

export interface AIProviderCapabilities {
  readonly supportsStreaming: boolean
  readonly supportsVision: boolean
  readonly supportsTools: boolean
  readonly supportsJson: boolean
  readonly maxContextWindow: number
  readonly supportedModels: readonly string[]
}

export const AI_PROVIDER_ERROR_CODES = [
  'INVALID_PROVIDER',
  'INVALID_REQUEST_ID',
  'INVALID_REQUEST',
  'INVALID_PROMPT',
  'INVALID_REQUEST_METADATA',
  'INVALID_RESPONSE_ID',
  'INVALID_RESPONSE',
  'INVALID_RESPONSE_METADATA',
  'PROVIDER_UNAVAILABLE',
  'AUTHENTICATION_FAILED',
  'RATE_LIMITED',
  'PROVIDER_TIMEOUT',
  'UNKNOWN_PROVIDER_ERROR',
] as const

export type AIProviderErrorCode = (typeof AI_PROVIDER_ERROR_CODES)[number]

export interface AIProviderFailure {
  readonly kind: 'failure'
  readonly code: AIProviderErrorCode
  readonly retryable: boolean
  readonly safeMessage: string
  readonly details?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIProviderRequestSuccess {
  readonly kind: 'success'
  readonly request: AIProviderRequest
}

export interface AIProviderResponseSuccess {
  readonly kind: 'success'
  readonly response: AIProviderResponse
}

export interface AIProviderExecutionSuccess {
  readonly kind: 'success'
  readonly response: AIProviderResponse
}

export interface AIProviderResolutionSuccess {
  readonly kind: 'success'
  readonly provider: AIProvider
}

export type AIProviderRequestResult = AIProviderRequestSuccess | AIProviderFailure
export type AIProviderResponseResult = AIProviderResponseSuccess | AIProviderFailure
export type AIProviderExecutionResult = AIProviderExecutionSuccess | AIProviderFailure
export type AIProviderResolutionResult = AIProviderResolutionSuccess | AIProviderFailure

export interface AIProvider {
  readonly providerId: AIProviderId
  executePrompt(request: AIProviderRequest): Promise<AIProviderExecutionResult>
  getCapabilities(): AIProviderCapabilities
  isAvailable(): Promise<boolean>
}

export interface AIProviderAdapter {
  readonly providerId: AIProviderId
  executePrompt(request: AIProviderRequest): Promise<AIProviderExecutionResult>
  getCapabilities(): AIProviderCapabilities
  isAvailable(): Promise<boolean>
}

export interface CreateAIProviderRequestInput {
  readonly id: string
  readonly prompt: AIPrompt
  readonly metadata: Omit<
    AIProviderRequestMetadata,
    'protocolVersion' | 'deterministic' | 'failClosed'
  > & {
    readonly protocolVersion?: typeof AI_PROVIDER_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}

export interface CreateAIProviderResponseInput {
  readonly id: string
  readonly content: string
  readonly usage: AIProviderUsage
  readonly finishReason: AIProviderFinishReason
  readonly metadata: Omit<
    AIProviderResponseMetadata,
    'protocolVersion' | 'deterministic' | 'failClosed'
  > & {
    readonly protocolVersion?: typeof AI_PROVIDER_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}
