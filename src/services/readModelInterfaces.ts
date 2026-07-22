import type {
  InsightRuntimeFailureCode,
  InsightRuntimeFailureKind,
  InsightRuntimeResponse,
} from '../insight/runtimeResponse'
import type {
  Insight,
  InsightRuleExecutionStatus,
} from '../insight/types'
import type {
  InsightRuleCategory,
  InsightRuleSeverity,
} from '../types/insightRule'

export type InsightReadModelFailureCode =
  | 'READ_MODEL_INVALID_RUNTIME_RESPONSE'

export type InsightReadModelConfidenceMode = Insight['confidence']['mode']

export interface InsightReadModelSummary {
  readonly runtimeStatus: InsightRuntimeResponse['status']
  readonly totalInsights: number
  readonly totalExecutions: number
  readonly generatedRules: number
  readonly skippedRules: number
  readonly validationIssueCount: number
}

export interface InsightReadModelTraceabilityItem {
  readonly insightId: string
  readonly ruleId: string
  readonly ruleVersion: string
  readonly protocolVersion: number
  readonly knowledgeCollectionId: string
  readonly sourceSnapshotId: string
  readonly sourceSnapshotKey: string
  readonly sourceSnapshotRevision: number
  readonly factIds: readonly string[]
}

export interface InsightReadModelInsight {
  readonly insightId: string
  readonly outputKind: Insight['outputKind']
  readonly category: InsightRuleCategory
  readonly severity: InsightRuleSeverity
  readonly titleCode: string
  readonly messageCode: string
  readonly executionStatus: InsightRuleExecutionStatus
  readonly confidence: {
    readonly mode: InsightReadModelConfidenceMode
    readonly scoreUnit: 'percent-0-100'
    readonly score: number
  }
  readonly evidence: {
    readonly evidenceType: Insight['evidence']['evidenceType']
    readonly summaryCode: string
    readonly requiredFactsCount: number
    readonly matchedFactsCount: number
    readonly missingFactsCount: number
  }
  readonly traceability: InsightReadModelTraceabilityItem
}

export interface InsightReadModelStatistics {
  readonly totalInsights: number
  readonly totalByCategory: Readonly<Record<InsightRuleCategory, number>>
  readonly totalBySeverity: Readonly<Record<InsightRuleSeverity, number>>
  readonly totalByStatus: Readonly<Record<InsightRuleExecutionStatus, number>>
  readonly confidenceAverage: number | null
  readonly confidenceMinimum: number | null
  readonly confidenceMaximum: number | null
  readonly validationIssueCount: number
}

export interface InsightReadModelConfidenceIndicators {
  readonly averageScore: number | null
  readonly minimumScore: number | null
  readonly maximumScore: number | null
  readonly totalScoredInsights: number
  readonly byMode: Readonly<Record<InsightReadModelConfidenceMode, number>>
}

export interface InsightReadModelUpdateMetadata {
  readonly runtimeStatus: InsightRuntimeResponse['status']
  readonly executionId: string | null
  readonly deterministic: true
  readonly failClosed: true
  readonly repositoryUpdated: boolean
  readonly protocolVersion: number | null
  readonly sourceKnowledgeCollectionId: string | null
  readonly sourceSnapshotId: string | null
  readonly sourceSnapshotKey: string | null
  readonly sourceSnapshotRevision: number | null
}

export interface InsightReadModelRuntimeFailure {
  readonly failureKind: InsightRuntimeFailureKind
  readonly code: InsightRuntimeFailureCode
  readonly message: string
  readonly validationIssueCount: number
}

export interface InsightReadModelProjection {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly summary: InsightReadModelSummary
  readonly insights: readonly InsightReadModelInsight[]
  readonly insightsByCategory: Readonly<
    Record<InsightRuleCategory, readonly InsightReadModelInsight[]>
  >
  readonly insightsBySeverity: Readonly<
    Record<InsightRuleSeverity, readonly InsightReadModelInsight[]>
  >
  readonly statistics: InsightReadModelStatistics
  readonly confidenceIndicators: InsightReadModelConfidenceIndicators
  readonly updateMetadata: InsightReadModelUpdateMetadata
  readonly traceability: readonly InsightReadModelTraceabilityItem[]
  readonly runtimeFailure?: InsightReadModelRuntimeFailure
}

export interface InsightReadModelFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly code: InsightReadModelFailureCode
  readonly message: string
}

export type InsightReadModelResult =
  | InsightReadModelProjection
  | InsightReadModelFailure

export interface InsightReadModels {
  project(
    response: InsightRuntimeResponse | null | undefined,
  ): InsightReadModelResult
}
