import type { IanaTimeZone, UtcInstant } from './financialSnapshot'
import type {
  KnowledgeFactId,
  KnowledgeRevision,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
} from './knowledgeLayer'
import type { CurrencyCode } from './settings'

declare const insightIdBrand: unique symbol
declare const insightCollectionIdBrand: unique symbol
declare const insightRuleIdBrand: unique symbol
declare const insightRuleVersionBrand: unique symbol
declare const insightTitleCodeBrand: unique symbol
declare const insightMessageCodeBrand: unique symbol
declare const insightSummaryCodeBrand: unique symbol
declare const insightValidationCodeBrand: unique symbol
declare const insightBuildDiagnosticCodeBrand: unique symbol
declare const insightConfidenceScoreBrand: unique symbol

export const INSIGHT_PROTOCOL_VERSION = 1 as const

export type InsightProtocolVersion = typeof INSIGHT_PROTOCOL_VERSION

export const INSIGHT_CONFIDENCE_MIN = 0 as const
export const INSIGHT_CONFIDENCE_MAX = 100 as const

export const INSIGHT_CATEGORIES = [
  'cash-flow',
  'spending',
  'income',
  'savings',
  'balance',
  'recurring',
  'anomaly',
  'trend',
  'data-quality',
] as const

export const INSIGHT_SEVERITIES = [
  'info',
  'notice',
  'warning',
  'critical',
] as const

export const INSIGHT_STATUSES = [
  'candidate',
  'validated',
  'rejected',
  'superseded',
] as const

export const INSIGHT_SOURCES = ['knowledge', 'none'] as const

export const INSIGHT_EVIDENCE_TYPES = [
  'knowledge-fact-set',
  'knowledge-fact-link',
  'knowledge-snapshot-derivation',
] as const

export const INSIGHT_TIMEZONE_POLICIES = [
  'snapshot-timezone',
  'fixed-timezone',
] as const

export const INSIGHT_AGGREGATE_SCOPES = [
  'all-accounts',
  'included-accounts',
] as const

export const INSIGHT_IDENTITY_PREIMAGE_FIELDS = [
  'protocolVersion',
  'ruleId',
  'ruleVersion',
  'category',
  'scope',
  'evidence',
  'parameters',
] as const

export const INSIGHT_NON_DETERMINISTIC_FIELDS = [
  'generatedAt',
  'evaluatedAt',
  'sealedAt',
  'persistedAt',
  'arrayPosition',
  'uuid',
  'randomSeed',
] as const

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number]

export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number]

export type InsightStatus = (typeof INSIGHT_STATUSES)[number]

export type InsightSource = (typeof INSIGHT_SOURCES)[number]

export type InsightEvidenceType = (typeof INSIGHT_EVIDENCE_TYPES)[number]

export type InsightTimezonePolicy = (typeof INSIGHT_TIMEZONE_POLICIES)[number]

export type InsightAggregateScopeCode = (typeof INSIGHT_AGGREGATE_SCOPES)[number]

export type InsightIdentityPreimageField =
  (typeof INSIGHT_IDENTITY_PREIMAGE_FIELDS)[number]

export type InsightId = string & {
  readonly [insightIdBrand]: 'InsightId'
}

export type InsightCollectionId = string & {
  readonly [insightCollectionIdBrand]: 'InsightCollectionId'
}

export type InsightRuleId = string & {
  readonly [insightRuleIdBrand]: 'InsightRuleId'
}

export type InsightRuleVersion = string & {
  readonly [insightRuleVersionBrand]: 'InsightRuleVersion'
}

export type InsightTitleCode = string & {
  readonly [insightTitleCodeBrand]: 'InsightTitleCode'
}

export type InsightMessageCode = string & {
  readonly [insightMessageCodeBrand]: 'InsightMessageCode'
}

export type InsightSummaryCode = string & {
  readonly [insightSummaryCodeBrand]: 'InsightSummaryCode'
}

export type InsightValidationCheckCode = string & {
  readonly [insightValidationCodeBrand]: 'InsightValidationCheckCode'
}

export type InsightBuildDiagnosticCode = string & {
  readonly [insightBuildDiagnosticCodeBrand]: 'InsightBuildDiagnosticCode'
}

export type InsightConfidenceScore = number & {
  readonly [insightConfidenceScoreBrand]: 'InsightConfidenceScore'
}

export type InsightJsonPrimitive = string | number | boolean | null

export type InsightJsonValue =
  | InsightJsonPrimitive
  | InsightJsonObject
  | readonly InsightJsonValue[]

export interface InsightJsonObject {
  readonly [key: string]: InsightJsonValue
}

export interface InsightRuleReference {
  readonly ruleId: InsightRuleId
  readonly ruleVersion: InsightRuleVersion
}

export interface InsightTraceabilityMetadata {
  readonly deterministicIdentity: true
  readonly appendOnly: true
  readonly canonicalizationRequired: true
  readonly identityPreimageFields: readonly InsightIdentityPreimageField[]
}

export interface InsightEvidence {
  readonly source: Extract<InsightSource, 'knowledge'>
  readonly knowledgeSnapshotId: KnowledgeSnapshotId
  readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
  readonly knowledgeRevision: KnowledgeRevision
  readonly factIds: readonly [KnowledgeFactId, ...KnowledgeFactId[]]
  readonly evidenceType: InsightEvidenceType
  readonly summaryCode: InsightSummaryCode
}

export interface InsightScopeBase {
  readonly asOf: UtcInstant
  readonly currency: CurrencyCode
  readonly timezone: IanaTimeZone
  readonly timezonePolicy: InsightTimezonePolicy
}

export interface InsightAggregateScope extends InsightScopeBase {
  readonly scopeKind: 'aggregate'
  readonly aggregateScope: InsightAggregateScopeCode
}

export interface InsightAccountScope extends InsightScopeBase {
  readonly scopeKind: 'account'
  readonly accountScope: readonly [string, ...string[]]
}

export type InsightScope =
  | InsightAggregateScope
  | InsightAccountScope

export interface Insight {
  readonly insightId: InsightId
  readonly protocolVersion: InsightProtocolVersion
  readonly category: InsightCategory
  readonly severity: InsightSeverity
  readonly confidence: InsightConfidenceScore
  readonly status: InsightStatus
  readonly titleCode: InsightTitleCode
  readonly messageCode: InsightMessageCode
  readonly rule: InsightRuleReference
  readonly source: InsightSource
  readonly scope: InsightScope
  readonly evidence: readonly [InsightEvidence, ...InsightEvidence[]]
  readonly parameters: InsightJsonObject
  readonly supersedesInsightIds: readonly InsightId[]
  readonly traceability: InsightTraceabilityMetadata
}

export interface InsightKnowledgeCompatibility {
  readonly sourceLayer: 'knowledge-layer'
  readonly acceptedSources: readonly InsightSource[]
  readonly requiresKnowledgeEvidence: true
}

export interface InsightCollection {
  readonly collectionId: InsightCollectionId
  readonly protocolVersion: InsightProtocolVersion
  readonly source: InsightSource
  readonly sourceKnowledgeSnapshotId: KnowledgeSnapshotId | null
  readonly sourceKnowledgeSnapshotKey: KnowledgeSnapshotKey | null
  readonly sourceKnowledgeRevision: KnowledgeRevision | null
  readonly scope: InsightScope
  readonly collectionRevision: number
  readonly insights: readonly Insight[]
  readonly supersedesCollectionId: InsightCollectionId | null
  readonly traceability: InsightTraceabilityMetadata
  readonly compatibility: InsightKnowledgeCompatibility
}

export type InsightValidationErrorCode =
  | 'INSIGHT_VALIDATION_UNSUPPORTED_PROTOCOL'
  | 'INSIGHT_VALIDATION_UNKNOWN_CATEGORY'
  | 'INSIGHT_VALIDATION_UNKNOWN_SEVERITY'
  | 'INSIGHT_VALIDATION_UNKNOWN_STATUS'
  | 'INSIGHT_VALIDATION_UNKNOWN_SOURCE'
  | 'INSIGHT_VALIDATION_CONFIDENCE_OUT_OF_RANGE'
  | 'INSIGHT_VALIDATION_INVALID_EVIDENCE'
  | 'INSIGHT_VALIDATION_DUPLICATE_FACT_ID'
  | 'INSIGHT_VALIDATION_SCOPE_INCONSISTENT'
  | 'INSIGHT_VALIDATION_INVALID_SUPERSEDES'
  | 'INSIGHT_VALIDATION_NON_SERIALIZABLE_PARAMETERS'

export interface InsightValidationCheck {
  readonly code: InsightValidationCheckCode
  readonly passed: boolean
  readonly errorCode: InsightValidationErrorCode | null
}

export interface InsightValidationFailure {
  readonly code: InsightValidationCheckCode
  readonly errorCode: InsightValidationErrorCode
}

export interface InsightValidationResult {
  readonly status: 'valid' | 'invalid'
  readonly checks: readonly InsightValidationCheck[]
  readonly failedChecks: number
  readonly failures: readonly InsightValidationFailure[]
}

export interface InsightBuildDiagnostic {
  readonly code: InsightBuildDiagnosticCode
  readonly messageCode: InsightMessageCode
}

export type InsightBuildResult =
  | {
      readonly status: 'built'
      readonly protocolVersion: InsightProtocolVersion
      readonly collection: InsightCollection
      readonly diagnostics: readonly InsightBuildDiagnostic[]
    }
  | {
      readonly status: 'skipped' | 'failed'
      readonly protocolVersion: InsightProtocolVersion
      readonly collection: null
      readonly diagnostics: readonly [InsightBuildDiagnostic, ...InsightBuildDiagnostic[]]
    }