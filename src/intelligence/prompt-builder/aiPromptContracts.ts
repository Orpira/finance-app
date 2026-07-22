export const AI_PROMPT_PROTOCOL_VERSION = 1 as const

export type AIPromptId = string & {
  readonly __brand: 'AIPromptId'
}

export type AIPromptSegmentId = string & {
  readonly __brand: 'AIPromptSegmentId'
}

export const AI_PROMPT_ROLES = [
  'SYSTEM',
  'USER',
  'ASSISTANT',
  'CONTEXT',
  'CONSTRAINT',
] as const

export type AIPromptRole = (typeof AI_PROMPT_ROLES)[number]

export const AI_PROMPT_PRIORITIES = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
] as const

export type AIPromptPriority = (typeof AI_PROMPT_PRIORITIES)[number]

export type AIPromptJsonPrimitive = string | number | boolean | null

export interface AIPromptJsonObject {
  readonly [key: string]: AIPromptJsonValue
}

export type AIPromptJsonValue =
  | AIPromptJsonPrimitive
  | AIPromptJsonObject
  | readonly AIPromptJsonValue[]

export interface AIPromptMetadata {
  readonly protocolVersion: typeof AI_PROMPT_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIPromptJsonValue>>
}

export interface AIPromptSegment {
  readonly id: AIPromptSegmentId
  readonly role: AIPromptRole
  readonly content: string
  readonly priority: AIPromptPriority
  readonly metadata: AIPromptMetadata
}

export interface AIPrompt {
  readonly protocolVersion: typeof AI_PROMPT_PROTOCOL_VERSION
  readonly promptId: AIPromptId
  readonly segments: readonly AIPromptSegment[]
  readonly metadata: AIPromptMetadata
}

export interface AIPromptValidationError {
  readonly code: AIPromptValidationErrorCode
  readonly safeMessage: string
}

export const AI_PROMPT_VALIDATION_ERROR_CODES = [
  'INVALID_PROMPT',
  'INVALID_PROMPT_ID',
  'INVALID_PROMPT_METADATA',
  'INVALID_PROMPT_SEGMENTS',
  'INVALID_SEGMENT',
  'INVALID_SEGMENT_ID',
  'INVALID_SEGMENT_ROLE',
  'INVALID_SEGMENT_CONTENT',
  'INVALID_SEGMENT_PRIORITY',
  'INVALID_SEGMENT_METADATA',
  'DUPLICATE_SEGMENT_ID',
  'INVALID_SEGMENT_ORDER',
] as const

export type AIPromptValidationErrorCode =
  (typeof AI_PROMPT_VALIDATION_ERROR_CODES)[number]

export interface AIPromptFailure {
  readonly kind: 'failure'
  readonly code: AIPromptValidationErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIPromptSuccess {
  readonly kind: 'success'
  readonly prompt: AIPrompt
}

export type AIPromptResult = AIPromptSuccess | AIPromptFailure

export interface AIPromptSegmentFailure {
  readonly kind: 'failure'
  readonly code: AIPromptValidationErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIPromptSegmentSuccess {
  readonly kind: 'success'
  readonly segment: AIPromptSegment
}

export type AIPromptSegmentResult = AIPromptSegmentSuccess | AIPromptSegmentFailure

export interface CreateAIPromptSegmentInput {
  readonly id: string
  readonly role: AIPromptRole
  readonly content: string
  readonly priority: AIPromptPriority
  readonly metadata: Omit<AIPromptMetadata, 'protocolVersion' | 'deterministic' | 'failClosed'> & {
    readonly protocolVersion?: typeof AI_PROMPT_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}

export interface CreateAIPromptInput {
  readonly promptId: string
  readonly segments: readonly AIPromptSegment[]
  readonly metadata: Omit<AIPromptMetadata, 'protocolVersion' | 'deterministic' | 'failClosed'> & {
    readonly protocolVersion?: typeof AI_PROMPT_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}
