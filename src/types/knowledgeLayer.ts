import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedSnapshotId,
  SnapshotKey,
  SnapshotVersion,
  UtcInstant,
} from './financialSnapshot'
import type { CurrencyCode, UsageMode } from './settings'

declare const knowledgeFactIdBrand: unique symbol
declare const knowledgeCollectionIdBrand: unique symbol
declare const knowledgeSnapshotIdBrand: unique symbol
declare const knowledgeVersionBrand: unique symbol
declare const knowledgeBuilderVersionBrand: unique symbol
declare const knowledgeRulesVersionBrand: unique symbol
declare const knowledgeProjectionVersionBrand: unique symbol
declare const knowledgeRevisionBrand: unique symbol
declare const knowledgeCanonicalizationVersionBrand: unique symbol
declare const knowledgeSnapshotKeyBrand: unique symbol
declare const knowledgeRevisionReasonCodeBrand: unique symbol

export type KnowledgeFactId = string & {
  readonly [knowledgeFactIdBrand]: 'KnowledgeFactId'
}

export type KnowledgeSnapshotId = string & {
  readonly [knowledgeSnapshotIdBrand]: 'KnowledgeSnapshotId'
}

export type KnowledgeCollectionId = string & {
  readonly [knowledgeCollectionIdBrand]: 'KnowledgeCollectionId'
}

export type KnowledgeVersion = string & {
  readonly [knowledgeVersionBrand]: 'KnowledgeVersion'
}

export type KnowledgeBuilderVersion = string & {
  readonly [knowledgeBuilderVersionBrand]: 'KnowledgeBuilderVersion'
}

export type KnowledgeRulesVersion = string & {
  readonly [knowledgeRulesVersionBrand]: 'KnowledgeRulesVersion'
}

export type KnowledgeProjectionVersion = string & {
  readonly [knowledgeProjectionVersionBrand]: 'KnowledgeProjectionVersion'
}

export type KnowledgeRevision = number & {
  readonly [knowledgeRevisionBrand]: 'KnowledgeRevision'
}

export type KnowledgeCanonicalizationVersion = string & {
  readonly [knowledgeCanonicalizationVersionBrand]: 'KnowledgeCanonicalizationVersion'
}

export type KnowledgeSnapshotKey = string & {
  readonly [knowledgeSnapshotKeyBrand]: 'KnowledgeSnapshotKey'
}

export type KnowledgeRevisionReasonCode = string & {
  readonly [knowledgeRevisionReasonCodeBrand]: 'KnowledgeRevisionReasonCode'
}

export type KnowledgeFactType =
  | 'income.present'
  | 'income.absent'
  | 'income.increased'
  | 'income.decreased'
  | 'expense.present'
  | 'expense.absent'
  | 'expense.increased'
  | 'expense.decreased'
  | 'adjustment.present'
  | 'adjustment.absent'
  | 'balance.positive'
  | 'balance.negative'
  | 'balance.neutral'
  | 'cashflow.positive'
  | 'cashflow.negative'
  | 'cashflow.neutral'
  | 'period.empty'
  | 'period.non_empty'
  | 'season.started'
  | 'season.completed'
  | 'saving.high'
  | 'saving.low'
  | 'recurring.expense.detected'
  | 'income.volatile'
  | 'expense.volatile'
  | 'cashflow.stable'
  | 'cashflow.unstable'

export type KnowledgeFactSource = 'financial-snapshot'

export type KnowledgeFactCategory =
  | 'income'
  | 'expense'
  | 'adjustment'
  | 'balance'
  | 'period'
  | 'season'
  | 'saving'
  | 'cashflow'
  | 'volatility'
  | 'recurrence'

export type KnowledgeFactSeverity =
  | 'info'
  | 'warning'
  | 'critical'

export type KnowledgeFactConfidence = 'certain'

export type KnowledgeStatus =
  | 'projected'
  | 'superseded'

export type KnowledgeCollectionState =
  | 'draft'
  | 'validated'

export type KnowledgeRelationshipType =
  | 'derived-from'
  | 'supports'
  | 'correlates-with'

export interface KnowledgeScope {
  readonly kind: 'monthly'
  readonly periodStart: CivilDate
  readonly periodEndExclusive: CivilDate
  readonly periodBoundary: '[start,end)'
  readonly timezone: IanaTimeZone
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly earningPeriodId?: number
}

export interface KnowledgeIdentity {
  readonly knowledgeSnapshotId: KnowledgeSnapshotId
  readonly snapshotKey: SnapshotKey
}

export interface KnowledgeOrigin {
  readonly source: KnowledgeFactSource
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly sourceSnapshotVersion: SnapshotVersion
  readonly sourceCanonicalizationVersion: CanonicalizationVersion
  readonly sourceEngineVersion: EngineVersion
  readonly sourceRulesetVersion: RulesetVersion
}

export interface KnowledgeEvidence {
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly sourceFingerprintValue: string
  readonly sourceAppliedRuleIds: readonly string[]
  readonly sourceRecordIds: readonly (string | number)[]
  readonly sourceContextKinds: readonly string[]
  readonly coverageCodes: readonly string[]
  readonly warningCodes: readonly string[]
  readonly sourcePaths: readonly string[]
}

export interface KnowledgeContext {
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly timezone: IanaTimeZone
  readonly periodStart: CivilDate
  readonly periodEndExclusive: CivilDate
  readonly earningPeriodId?: number
}

export interface KnowledgeRelationship {
  readonly relation: KnowledgeRelationshipType
  readonly fromFactId: KnowledgeFactId
  readonly toFactId: KnowledgeFactId
}

export interface KnowledgeCollectionVersions {
  readonly knowledgeVersion: KnowledgeVersion
  readonly builderVersion: KnowledgeBuilderVersion
  readonly rulesVersion: KnowledgeRulesVersion
  readonly projectionVersion: KnowledgeProjectionVersion
}

export interface KnowledgeCollectionIdentity {
  readonly knowledgeCollectionId: KnowledgeCollectionId
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly sourceFingerprintValue: string
}

export type KnowledgeValidationErrorCode =
  | 'KNOWLEDGE_VALIDATION_INVALID_STATE'
  | 'KNOWLEDGE_VALIDATION_UNSUPPORTED_VERSION'
  | 'KNOWLEDGE_VALIDATION_INVALID_IDENTITY'
  | 'KNOWLEDGE_VALIDATION_DUPLICATE_FACT_ID'
  | 'KNOWLEDGE_VALIDATION_UNKNOWN_FACT_TYPE'
  | 'KNOWLEDGE_VALIDATION_INVALID_ORDER'
  | 'KNOWLEDGE_VALIDATION_CONTRADICTORY_FACTS'
  | 'KNOWLEDGE_VALIDATION_INVALID_EVIDENCE'
  | 'KNOWLEDGE_VALIDATION_INVALID_RELATIONSHIP'
  | 'KNOWLEDGE_VALIDATION_INVALID_VALUE'

export interface KnowledgeValidationCheck {
  readonly code: string
  readonly passed: boolean
  readonly errorCode?: KnowledgeValidationErrorCode
}

export interface KnowledgeValidationAssessment {
  readonly status: 'valid' | 'invalid'
  readonly checks: readonly KnowledgeValidationCheck[]
  readonly failedChecks: number
}

export interface KnowledgeValidationError {
  readonly name: 'KnowledgeValidationError'
  readonly message: string
  readonly code: KnowledgeValidationErrorCode
  readonly assessment: KnowledgeValidationAssessment
}

export type KnowledgeCanonicalizationErrorCode =
  | 'KNOWLEDGE_CANONICALIZATION_INVALID_STATE'
  | 'KNOWLEDGE_CANONICALIZATION_UNSUPPORTED_VERSION'
  | 'KNOWLEDGE_CANONICALIZATION_INVALID_VALUE'
  | 'KNOWLEDGE_CANONICALIZATION_INVALID_ORDER'
  | 'KNOWLEDGE_CANONICALIZATION_INVALID_FACT'
  | 'KNOWLEDGE_CANONICALIZATION_INVALID_RELATIONSHIP'
  | 'KNOWLEDGE_CANONICALIZATION_CYCLIC_VALUE'

export type KnowledgeFingerprintErrorCode =
  | 'KNOWLEDGE_FINGERPRINT_UNSUPPORTED_ALGORITHM'
  | 'KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT'
  | 'KNOWLEDGE_FINGERPRINT_CRYPTO_UNAVAILABLE'
  | 'KNOWLEDGE_FINGERPRINT_ENCODING_FAILED'

export interface KnowledgeFingerprint {
  readonly algorithm: 'SHA-256'
  readonly encoding: 'hex-lower'
  readonly domain: 'private-balance:knowledge:fingerprint:v1:'
  readonly fingerprintVersion: 'knowledge-fingerprint/1.0.0'
  readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
  readonly value: string
}

export type KnowledgeSealStatus = 'sealed'

export type KnowledgeSealErrorCode =
  | 'KNOWLEDGE_SEAL_INVALID_DOCUMENT'
  | 'KNOWLEDGE_SEAL_INVALID_FINGERPRINT'
  | 'KNOWLEDGE_SEAL_FINGERPRINT_MISMATCH'
  | 'KNOWLEDGE_SEAL_INVALID_KEY'
  | 'KNOWLEDGE_SEAL_INVALID_REVISION'
  | 'KNOWLEDGE_SEAL_INVALID_TIME'
  | 'KNOWLEDGE_SEAL_INVALID_SUPERSEDES'
  | 'KNOWLEDGE_SEAL_INCOMPATIBLE_VERSION'
  | 'KNOWLEDGE_SEAL_INVALID_VALUE'

export interface KnowledgeSealedIdentity {
  readonly knowledgeSnapshotId: KnowledgeSnapshotId
  readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
}

export interface KnowledgeSealingInput {
  readonly canonicalDocument: CanonicalKnowledgeDocument
  readonly fingerprint: KnowledgeFingerprint
  readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
  readonly revision: number
  readonly revisionReasonCode: KnowledgeRevisionReasonCode
  readonly sealedAt: UtcInstant
  readonly supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId
}

export interface SealedKnowledgeSnapshot {
  readonly identity: KnowledgeSealedIdentity
  readonly knowledgeSnapshotId: KnowledgeSnapshotId
  readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
  readonly revision: number
  readonly revisionReasonCode: KnowledgeRevisionReasonCode
  readonly status: KnowledgeSealStatus
  readonly canonicalDocument: CanonicalKnowledgeDocument
  readonly fingerprint: KnowledgeFingerprint
  readonly sealedAt: UtcInstant
  readonly supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId
  readonly knowledgeVersion: KnowledgeVersion
  readonly knowledgeBuilderVersion: KnowledgeBuilderVersion
  readonly knowledgeRulesVersion: KnowledgeRulesVersion
  readonly knowledgeProjectionVersion: KnowledgeProjectionVersion
  readonly knowledgeCanonicalizationVersion: KnowledgeCanonicalizationVersion
  readonly sourceSnapshotReferences: CanonicalKnowledgePayload['sourceSnapshotReferences']
  readonly facts: readonly CanonicalKnowledgeFact[]
  readonly relationships: readonly CanonicalKnowledgeRelationship[]
  readonly evidenceReferences: readonly CanonicalKnowledgeEvidenceReference[]
  readonly metadata: CanonicalKnowledgePayload['metadata']
}

export interface CanonicalKnowledgeRelationship {
  readonly sourceFactId: KnowledgeFactId
  readonly relationshipType: KnowledgeRelationshipType
  readonly targetFactId: KnowledgeFactId
}

export type CanonicalKnowledgeEvidenceType =
  | 'applied-rule-id'
  | 'record-id'
  | 'context-kind'
  | 'coverage-code'
  | 'warning-code'
  | 'source-path'

export interface CanonicalKnowledgeEvidenceReference {
  readonly factId: KnowledgeFactId
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly sourceFingerprintValue: string
  readonly evidenceType: CanonicalKnowledgeEvidenceType
  readonly evidenceValue: string | number
}

export interface CanonicalKnowledgeFact {
  readonly factId: KnowledgeFactId
  readonly factType: KnowledgeFactType
  readonly category: KnowledgeFactCategory
  readonly severity: KnowledgeFactSeverity
  readonly confidence: KnowledgeFactConfidence
  readonly source: KnowledgeFactSource
  readonly status: KnowledgeStatus
  readonly ordinal: number
  readonly scope: KnowledgeScope
  readonly context: KnowledgeContext
  readonly origin: KnowledgeOrigin
  readonly evidence: KnowledgeEvidence
  readonly relationships: readonly CanonicalKnowledgeRelationship[]
}

export interface CanonicalKnowledgePayload {
  readonly identity: KnowledgeCollectionIdentity
  readonly sourceSnapshotReferences: {
    readonly snapshotId: SealedSnapshotId
    readonly snapshotKey: SnapshotKey
    readonly snapshotRevision: number
    readonly sourceFingerprintValue: string
  }
  readonly versions: KnowledgeCollectionVersions
  readonly metadata: {
    readonly knowledgeVersion: KnowledgeVersion
    readonly builderVersion: KnowledgeBuilderVersion
    readonly rulesVersion: KnowledgeRulesVersion
    readonly projectionVersion: KnowledgeProjectionVersion
  }
  readonly projection: {
    readonly projectionVersion: KnowledgeProjectionVersion
    readonly collectionState: 'validated'
  }
  readonly auditTrail: {
    readonly appendOnly: true
    readonly deterministicIdentity: true
  }
  readonly factCount: number
  readonly facts: readonly CanonicalKnowledgeFact[]
  readonly relationships: readonly CanonicalKnowledgeRelationship[]
  readonly evidenceReferences: readonly CanonicalKnowledgeEvidenceReference[]
}

export interface CanonicalKnowledgeDocument {
  readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
  readonly payload: CanonicalKnowledgePayload
}

export interface KnowledgeFact {
  readonly factId: KnowledgeFactId
  readonly factType: KnowledgeFactType
  readonly category: KnowledgeFactCategory
  readonly severity: KnowledgeFactSeverity
  readonly confidence: KnowledgeFactConfidence
  readonly source: KnowledgeFactSource
  readonly status: KnowledgeStatus
  readonly scope: KnowledgeScope
  readonly context: KnowledgeContext
  readonly origin: KnowledgeOrigin
  readonly evidence: KnowledgeEvidence
  readonly relationships: readonly KnowledgeRelationship[]
}

export interface KnowledgeCollectionBase {
  readonly state: KnowledgeCollectionState
  readonly identity: KnowledgeCollectionIdentity
  readonly versions: KnowledgeCollectionVersions
  readonly facts: readonly KnowledgeFact[]
  readonly relationships: readonly KnowledgeRelationship[]
  readonly factCount: number
  readonly validation?: KnowledgeValidationAssessment
}

export interface DraftKnowledgeCollection extends KnowledgeCollectionBase {
  readonly state: 'draft'
}

export interface ValidatedKnowledgeCollection extends KnowledgeCollectionBase {
  readonly state: 'validated'
  readonly validation: KnowledgeValidationAssessment
}

export type KnowledgeCollection =
  | DraftKnowledgeCollection
  | ValidatedKnowledgeCollection

export interface KnowledgeProjection {
  readonly projectionVersion: KnowledgeProjectionVersion
  readonly collection: DraftKnowledgeCollection | ValidatedKnowledgeCollection
}

export interface KnowledgeMetadata {
  readonly knowledgeVersion: KnowledgeVersion
  readonly knowledgeBuilderVersion: KnowledgeBuilderVersion
  readonly knowledgeRulesVersion: KnowledgeRulesVersion
  readonly knowledgeProjectionVersion: KnowledgeProjectionVersion
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly sourceSnapshotVersion: SnapshotVersion
  readonly sourceCanonicalizationVersion: CanonicalizationVersion
  readonly sourceEngineVersion: EngineVersion
  readonly sourceRulesetVersion: RulesetVersion
}

export interface KnowledgeAuditTrail {
  readonly appendOnly: true
  readonly deterministicIdentity: true
  readonly generatedFromSnapshotId: SealedSnapshotId
  readonly generatedFromSnapshotRevision: number
  readonly generatedFromSnapshotSealedAt: UtcInstant
}

export interface KnowledgeSnapshot {
  readonly identity: KnowledgeIdentity
  readonly revision: KnowledgeRevision
  readonly supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId
  readonly scope: KnowledgeScope
  readonly status: KnowledgeStatus
  readonly metadata: KnowledgeMetadata
  readonly projection: KnowledgeProjection
  readonly auditTrail: KnowledgeAuditTrail
}

export interface KnowledgeBuilderInput<TEngineResult = unknown> {
  readonly snapshot: Readonly<{ readonly status: 'sealed' } & {
    readonly identity: {
      readonly snapshotId: SealedSnapshotId
      readonly snapshotKey: SnapshotKey
    }
    readonly revision: { readonly revision: number }
    readonly fingerprint: { readonly value: string }
    readonly scope: {
      readonly kind: 'monthly'
      readonly periodStart: CivilDate
      readonly periodEndExclusive: CivilDate
      readonly periodBoundary: '[start,end)'
      readonly timezone: IanaTimeZone
      readonly usageMode: UsageMode
      readonly currency: CurrencyCode
      readonly earningPeriodId?: number
    }
    readonly canonicalDocument: { readonly payload: { readonly engineResult: TEngineResult } }
    readonly evidence: {
      readonly records: readonly { readonly sourceId?: string | number }[]
      readonly context: readonly { readonly kind: string }[]
      readonly coverageCodes: readonly string[]
      readonly warningCodes: readonly string[]
    }
    readonly appliedRules: readonly { readonly ruleId: string }[]
    readonly snapshotVersion: SnapshotVersion
    readonly canonicalizationVersion: CanonicalizationVersion
    readonly engineVersion: EngineVersion
    readonly rulesetVersion: RulesetVersion
  }>
  readonly knowledgeVersion: KnowledgeVersion
  readonly builderVersion: KnowledgeBuilderVersion
  readonly rulesVersion: KnowledgeRulesVersion
  readonly projectionVersion: KnowledgeProjectionVersion
}
