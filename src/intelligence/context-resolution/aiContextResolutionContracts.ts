import type {
  AIContextJsonValue,
  AIContextMetadata,
  AIContextPriority,
  AIContextSource,
} from '../context-builder'

export const AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION = 1 as const

export type AIResolutionId = string & {
  readonly __brand: 'AIResolutionId'
}

export type AIResolvedSectionId = string & {
  readonly __brand: 'AIResolvedSectionId'
}

export const AI_RESOLUTION_STRATEGIES = [
  'DEFAULT',
  'MINIMAL',
  'CONVERSATION_ONLY',
  'APPLICATION_ONLY',
  'FINANCIAL_ONLY',
] as const

export type AIResolutionStrategy = (typeof AI_RESOLUTION_STRATEGIES)[number]

export interface AIResolutionMetadata {
  readonly protocolVersion: typeof AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION
  readonly createdAt: string
  readonly sourceContextId: string
  readonly source: 'APPLICATION' | 'CONVERSATION' | 'SYSTEM'
  readonly deterministic: true
  readonly failClosed: true
  readonly tags?: readonly string[]
  readonly attributes?: Readonly<Record<string, AIContextJsonValue>>
}

export interface AIResolvedSection {
  readonly id: AIResolvedSectionId
  readonly source: AIContextSource
  readonly priority: AIContextPriority
  readonly content: Readonly<Record<string, AIContextJsonValue>>
  readonly metadata: AIContextMetadata
}

export interface AIResolvedContext {
  readonly id: AIResolutionId
  readonly sections: readonly AIResolvedSection[]
  readonly strategy: AIResolutionStrategy
  readonly metadata: AIResolutionMetadata
}

export const AI_CONTEXT_RESOLUTION_ERROR_CODES = [
  'INVALID_RESOLVED_CONTEXT',
  'INVALID_RESOLUTION_ID',
  'INVALID_RESOLUTION_STRATEGY',
  'INVALID_RESOLUTION_METADATA',
  'INVALID_RESOLVED_SECTIONS',
  'INVALID_RESOLVED_SECTION',
  'INVALID_RESOLVED_SECTION_ID',
  'INVALID_RESOLVED_SECTION_CONTENT',
  'INVALID_RESOLVED_SECTION_METADATA',
  'DUPLICATE_RESOLVED_SECTION_ID',
  'INVALID_RESOLVED_SECTION_ORDER',
  'NO_SECTIONS_RESOLVED',
] as const

export type AIContextResolutionErrorCode =
  (typeof AI_CONTEXT_RESOLUTION_ERROR_CODES)[number]

export interface AIContextResolutionFailure {
  readonly kind: 'failure'
  readonly code: AIContextResolutionErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIContextResolutionSuccess {
  readonly kind: 'success'
  readonly resolvedContext: AIResolvedContext
}

export type AIContextResolutionResult =
  | AIContextResolutionSuccess
  | AIContextResolutionFailure

export interface AIResolvedSectionFailure {
  readonly kind: 'failure'
  readonly code: AIContextResolutionErrorCode
  readonly retryable: false
  readonly safeMessage: string
}

export interface AIResolvedSectionSuccess {
  readonly kind: 'success'
  readonly section: AIResolvedSection
}

export type AIResolvedSectionResult =
  | AIResolvedSectionSuccess
  | AIResolvedSectionFailure

export interface CreateResolvedSectionInput {
  readonly id: string
  readonly source: AIContextSource
  readonly priority: AIContextPriority
  readonly content: Readonly<Record<string, AIContextJsonValue>>
  readonly metadata: AIContextMetadata
}

export interface CreateResolvedContextInput {
  readonly id: string
  readonly sections: readonly AIResolvedSection[]
  readonly strategy: AIResolutionStrategy
  readonly metadata: Omit<
    AIResolutionMetadata,
    'protocolVersion' | 'deterministic' | 'failClosed'
  > & {
    readonly protocolVersion?: typeof AI_CONTEXT_RESOLUTION_PROTOCOL_VERSION
    readonly deterministic?: true
    readonly failClosed?: true
  }
}
