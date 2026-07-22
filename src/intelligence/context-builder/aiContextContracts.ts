export const AI_CONTEXT_PROTOCOL_VERSION = 1 as const

export type AIContextId = string & {
  readonly __brand: 'AIContextId'
}

export type AIContextSectionId = string & {
  readonly __brand: 'AIContextSectionId'
}

export const AI_CONTEXT_SOURCES = [
  'CONVERSATION',
  'SESSION',
  'USER_PROFILE',
  'APPLICATION',
  'FINANCIAL_DATA',
  'CONFIGURATION',
] as const

export type AIContextSource = (typeof AI_CONTEXT_SOURCES)[number]

export const AI_CONTEXT_PRIORITIES = [
  'CRITICAL',
  'HIGH',
  'NORMAL',
  'LOW',
] as const

export type AIContextPriority = (typeof AI_CONTEXT_PRIORITIES)[number]

export type AIContextJsonPrimitive = string | number | boolean | null

export interface AIContextJsonObject {
  readonly [key: string]: AIContextJsonValue
}

export type AIContextJsonValue =
  | AIContextJsonPrimitive
  | AIContextJsonObject
  | readonly AIContextJsonValue[]

export interface AIContextMetadata {
  readonly protocolVersion: typeof AI_CONTEXT_PROTOCOL_VERSION
  readonly createdAt: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIContextJsonValue>>
}

export interface AIContextSection {
  readonly id: AIContextSectionId
  readonly source: AIContextSource
  readonly priority: AIContextPriority
  readonly content: Readonly<Record<string, AIContextJsonValue>>
  readonly metadata: AIContextMetadata
}

export interface AIContext {
  readonly protocolVersion: typeof AI_CONTEXT_PROTOCOL_VERSION
  readonly id: AIContextId
  readonly sections: readonly AIContextSection[]
  readonly metadata: AIContextMetadata
}

export const AI_CONTEXT_VALIDATION_ERROR_CODES = [
  'INVALID_CONTEXT',
  'INVALID_CONTEXT_ID',
  'INVALID_CONTEXT_METADATA',
  'INVALID_CONTEXT_SECTIONS',
  'INVALID_SECTION',
  'INVALID_SECTION_ID',
  'INVALID_SECTION_SOURCE',
  'INVALID_SECTION_PRIORITY',
  'INVALID_SECTION_CONTENT',
  'INVALID_SECTION_METADATA',
  'DUPLICATE_SECTION_ID',
  'INVALID_SECTION_ORDER',
] as const

export type AIContextValidationErrorCode =
  (typeof AI_CONTEXT_VALIDATION_ERROR_CODES)[number]

export interface AIContextValidationError {
  readonly code: AIContextValidationErrorCode
  readonly safeMessage: string
}

export interface AIContextFailure {
  readonly kind: 'failure'
  readonly code: AIContextValidationErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIContextSuccess {
  readonly kind: 'success'
  readonly context: AIContext
}

export type AIContextResult = AIContextSuccess | AIContextFailure

export interface AIContextSectionFailure {
  readonly kind: 'failure'
  readonly code: AIContextValidationErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIContextSectionSuccess {
  readonly kind: 'success'
  readonly section: AIContextSection
}

export type AIContextSectionResult = AIContextSectionSuccess | AIContextSectionFailure

export interface CreateAIContextSectionInput {
  readonly id: string
  readonly source: AIContextSource
  readonly priority: AIContextPriority
  readonly content: Readonly<Record<string, AIContextJsonValue>>
  readonly metadata: Omit<AIContextMetadata, 'protocolVersion' | 'deterministic' | 'failClosed'> & {
    readonly protocolVersion?: typeof AI_CONTEXT_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}

export interface CreateAIContextInput {
  readonly id: string
  readonly sections: readonly AIContextSection[]
  readonly metadata: Omit<AIContextMetadata, 'protocolVersion' | 'deterministic' | 'failClosed'> & {
    readonly protocolVersion?: typeof AI_CONTEXT_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}
