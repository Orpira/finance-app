import type {
  SnapshotJsonObject,
  SnapshotJsonValue,
} from '../../types/financialSnapshot'
import type {
  AIAuthorizedRequestEnvelope,
  AIDataCategory,
  AIDataClassification,
  AIProcessingMode,
} from './aiFoundationContracts'

export const AI_CONTEXT_DESCRIPTOR_TYPES = [
  'InsightSummaryReference',
  'InsightReadModelReference',
  'SnapshotReference',
  'KnowledgeReference',
  'MetadataReference',
  'UserTextReference',
  'DiagnosticReference',
] as const

export type AIContextDescriptorType = (typeof AI_CONTEXT_DESCRIPTOR_TYPES)[number]

export interface AIBaseContextSourceDescriptor {
  readonly descriptorType: AIContextDescriptorType
  readonly referenceId: string
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly selector: string
  readonly metadata?: SnapshotJsonObject
}

export interface InsightSummaryReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'InsightSummaryReference'
  readonly category: 'INSIGHT_SUMMARY'
}

export interface InsightReadModelReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'InsightReadModelReference'
  readonly category: 'INSIGHT_READ_MODEL'
}

export interface SnapshotReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'SnapshotReference'
  readonly category: 'FINANCIAL_SNAPSHOT'
}

export interface KnowledgeReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'KnowledgeReference'
  readonly category: 'KNOWLEDGE_COLLECTION'
}

export interface MetadataReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'MetadataReference'
  readonly category: 'APP_METADATA'
}

export interface UserTextReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'UserTextReference'
  readonly category: 'USER_PROVIDED_TEXT'
}

export interface DiagnosticReference extends AIBaseContextSourceDescriptor {
  readonly descriptorType: 'DiagnosticReference'
  readonly category: 'DIAGNOSTIC_METADATA'
}

export type AIContextSourceDescriptor =
  | InsightSummaryReference
  | InsightReadModelReference
  | SnapshotReference
  | KnowledgeReference
  | MetadataReference
  | UserTextReference
  | DiagnosticReference

export const AI_CONTEXT_REDACTION_STRATEGIES = [
  'MASK',
  'REMOVE',
  'HASH_REFERENCE',
  'KEEP',
] as const

export type AIContextRedactionStrategy = (typeof AI_CONTEXT_REDACTION_STRATEGIES)[number]

export type ContextResolutionFailureCode =
  | 'REFERENCE_NOT_FOUND'
  | 'SOURCE_UNAVAILABLE'
  | 'UNAUTHORIZED_FRAGMENT'
  | 'INVALID_FRAGMENT'

export interface ResolvedContextFragment {
  readonly referenceId: string
  readonly descriptorType: AIContextDescriptorType
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly payload: SnapshotJsonObject
}

export interface ContextResolutionSuccess {
  readonly ok: true
  readonly status: 'resolved'
  readonly descriptor: AIContextSourceDescriptor
  readonly fragment: ResolvedContextFragment
}

export interface ContextResolutionFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly descriptor: AIContextSourceDescriptor
  readonly code: ContextResolutionFailureCode
  readonly message: string
  readonly details?: Readonly<Record<string, SnapshotJsonValue | null>>
}

export type ContextResolutionResult =
  | ContextResolutionSuccess
  | ContextResolutionFailure

export interface ContextSourceResolverPort {
  resolve(
    descriptor: AIContextSourceDescriptor,
  ): ContextResolutionResult
}

export interface AIContextBuildRequest {
  readonly envelope: AIAuthorizedRequestEnvelope
  readonly sourceDescriptors: readonly AIContextSourceDescriptor[]
}

export interface AIContextFragment {
  readonly referenceId: string
  readonly descriptorType: AIContextDescriptorType
  readonly category: AIDataCategory
  readonly classification: AIDataClassification
  readonly data: SnapshotJsonObject
}

export interface AIAppliedRedaction {
  readonly referenceId: string
  readonly path: string
  readonly strategy: AIContextRedactionStrategy
  readonly reasonCode: string
}

export interface AIAppliedMinimization {
  readonly referenceId: string
  readonly path: string
  readonly reasonCode: string
}

export interface AIContextTraceability {
  readonly traceId: string | null
  readonly relationId: string | null
  readonly requestId: string | null
  readonly policyVersion: string | null
  readonly protocolVersion: number | null
  readonly purpose: string | null
  readonly processingMode: AIProcessingMode | null
  readonly authorizedCategories: readonly AIDataCategory[]
  readonly resolvedReferencesCount: number
  readonly decision: 'built' | 'rejected'
  readonly failureCode?: AIContextBuilderFailureCode
  readonly relation: {
    readonly requestToEnvelope:
      | 'matched'
      | 'missing'
      | 'mismatch'
    readonly envelopeToDescriptors:
      | 'matched'
      | 'missing'
      | 'mismatch'
  }
}

export interface AIContextPackage {
  readonly requestId: string
  readonly purpose: AIAuthorizedRequestEnvelope['purpose']
  readonly processingMode: AIAuthorizedRequestEnvelope['processingMode']
  readonly policyVersion: string
  readonly protocolVersion: number
  readonly orderedContextFragments: readonly AIContextFragment[]
  readonly appliedRedactions: readonly AIAppliedRedaction[]
  readonly appliedMinimization: readonly AIAppliedMinimization[]
  readonly traceability: AIContextTraceability
}

export const AI_CONTEXT_BUILDER_FAILURE_CODES = [
  'INVALID_REQUEST',
  'INVALID_ENVELOPE',
  'MISSING_RESOLVER',
  'UNKNOWN_REFERENCE',
  'PARTIAL_RESOLUTION',
  'RESOLUTION_FAILED',
  'INVALID_FRAGMENT',
  'CLASSIFICATION_EXCEEDED',
  'ENVELOPE_VIOLATION',
  'REDACTION_CONFLICT',
  'INCONSISTENT_CONTEXT_RESULT',
] as const

export type AIContextBuilderFailureCode =
  (typeof AI_CONTEXT_BUILDER_FAILURE_CODES)[number]

export interface AIContextBuildSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly contextPackage: AIContextPackage
  readonly traceability: AIContextTraceability
}

export interface AIContextBuildFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly code: AIContextBuilderFailureCode
  readonly message: string
  readonly traceability: AIContextTraceability
  readonly details?: Readonly<Record<string, SnapshotJsonValue | null>>
}

export type AIContextBuildResult =
  | AIContextBuildSuccess
  | AIContextBuildFailure
