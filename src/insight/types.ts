import type {
  SealedSnapshotId,
  SnapshotKey,
} from '../types/financialSnapshot'
import type {
  InsightRuleCategory,
  InsightRuleConfidencePolicy,
  InsightRuleEvidenceType,
  InsightRuleMessageCode,
  InsightRuleOutputKind,
  InsightRuleProtocolVersion,
  InsightRuleReference,
  InsightRuleSeverity,
  InsightRuleSummaryCode,
  InsightRuleTitleCode,
} from '../types/insightRule'
import type {
  KnowledgeCollectionId,
  KnowledgeFactCategory,
  KnowledgeFactId,
  KnowledgeFactSeverity,
  KnowledgeFactType,
} from '../types/knowledgeLayer'

declare const insightIdBrand: unique symbol

export type InsightId = string & {
  readonly [insightIdBrand]: 'InsightId'
}

export type InsightBuilderAssessmentStatus = 'ok' | 'blocked'

export type InsightBuilderFailureCode =
  | 'INVALID_KNOWLEDGE_COLLECTION'
  | 'RULE_EXECUTION_BLOCKED'

export type InsightRuleExecutionStatus = 'generated' | 'skipped'

export type InsightRuleSkipReasonCode =
  | 'rule-disabled'
  | 'incompatible-input'
  | 'invalid-confidence-policy'
  | 'confidence-not-resolved'

export type InsightRuleCompatibilityCheckCode =
  | 'rule-protocol-compatible'
  | 'rule-metadata-deterministic'
  | 'output-evidence-type-aligned'
  | 'knowledge-version-supported'
  | 'knowledge-version-required'
  | 'minimum-revision-satisfied'
  | 'snapshot-key-compatible'
  | 'facts-match-policy'
  | 'evidence-required-facts-present'
  | 'scope-kind-compatible'
  | 'scope-asof-compatible'
  | 'scope-currency-compatible'
  | 'scope-timezone-compatible'
  | 'output-category-compatible'

export interface InsightRuleCompatibilityCheck {
  readonly code: InsightRuleCompatibilityCheckCode
  readonly passed: boolean
}

export interface InsightEvidenceFactReference {
  readonly factId: KnowledgeFactId
  readonly factType: KnowledgeFactType
  readonly category: KnowledgeFactCategory
  readonly severity: KnowledgeFactSeverity
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly sourceFingerprintValue: string
}

export interface InsightEvidence {
  readonly evidenceType: InsightRuleEvidenceType
  readonly summaryCode: InsightRuleSummaryCode
  readonly source: 'knowledge'
  readonly traceabilityRequired: true
  readonly requiredFacts: readonly KnowledgeFactId[]
  readonly matchedFacts: readonly InsightEvidenceFactReference[]
  readonly missingFacts: readonly KnowledgeFactId[]
}

export interface InsightConfidence {
  readonly mode: InsightRuleConfidencePolicy['mode']
  readonly scoreUnit: 'percent-0-100'
  readonly score: number
}

export interface InsightTraceability {
  readonly knowledgeCollectionId: KnowledgeCollectionId
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly rule: InsightRuleReference
  readonly factIds: readonly KnowledgeFactId[]
}

export interface Insight {
  readonly insightId: InsightId
  readonly rule: InsightRuleReference
  readonly outputKind: InsightRuleOutputKind
  readonly category: InsightRuleCategory
  readonly severity: InsightRuleSeverity
  readonly titleCode: InsightRuleTitleCode
  readonly messageCode: InsightRuleMessageCode
  readonly confidence: InsightConfidence
  readonly evidence: InsightEvidence
  readonly traceability: InsightTraceability
}

export interface InsightRuleExecutionTrace {
  readonly rule: InsightRuleReference
  readonly enabled: boolean
  readonly status: InsightRuleExecutionStatus
  readonly compatibilityChecks: readonly InsightRuleCompatibilityCheck[]
  readonly skipReason?: InsightRuleSkipReasonCode
  readonly generatedInsightId?: InsightId
}

export interface InsightCollection {
  readonly protocolVersion: InsightRuleProtocolVersion
  readonly sourceKnowledgeCollectionId: KnowledgeCollectionId
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly sourceSnapshotRevision: number
  readonly deterministicOutput: true
  readonly failClosed: true
  readonly insights: readonly Insight[]
  readonly executions: readonly InsightRuleExecutionTrace[]
}

export interface InsightBuilderFailure {
  readonly code: InsightBuilderFailureCode
  readonly rule?: InsightRuleReference
  readonly message: string
}

export interface InsightBuildAssessment {
  readonly status: InsightBuilderAssessmentStatus
  readonly failures: readonly InsightBuilderFailure[]
  readonly generatedInsights: number
  readonly skippedRules: number
}

export interface InsightBuildResult {
  readonly collection: InsightCollection
  readonly assessment: InsightBuildAssessment
}
