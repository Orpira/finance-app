import type {
  InsightRuleDescriptor,
  InsightRuleProtocolVersion,
} from '../types/insightRule'
import type {
  KnowledgeCollectionVersions,
} from '../types/knowledgeLayer'
import type {
  SnapshotKnowledgeInputSnapshot,
} from './snapshotKnowledgeIntegrationInterfaces'
import type {
  SnapshotKnowledgeIntegrationFailure,
  SnapshotKnowledgeIntegrationSuccess,
  SnapshotKnowledgeTraceability,
} from './snapshotKnowledgeIntegrationResult'
import type {
  KnowledgeIntegrationFailure,
  KnowledgeIntegrationSuccess,
  KnowledgeRuntimeTraceability,
} from './knowledgeIntegrationResult'

export type InsightExecutionStage =
  | 'request-validation'
  | 'snapshot-integration'
  | 'knowledge-integration'
  | 'pipeline'

export interface InsightExecutionRequest {
  readonly executionId: string
  readonly snapshotIntegrationId: string
  readonly knowledgeIntegrationId: string
  readonly snapshot: SnapshotKnowledgeInputSnapshot
  readonly rules: readonly InsightRuleDescriptor[]
  readonly versions: KnowledgeCollectionVersions
  readonly protocolVersion?: InsightRuleProtocolVersion
}

export type InsightExecutionFailureCode =
  | 'INSIGHT_EXECUTION_INVALID_REQUEST'
  | 'INSIGHT_EXECUTION_MISSING_SNAPSHOT'
  | 'INSIGHT_EXECUTION_MISSING_RULE_CATALOG'
  | 'INSIGHT_EXECUTION_MISSING_DEPENDENCY'
  | 'INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_REJECTED'
  | 'INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED'
  | 'INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_EXCEPTION'
  | 'INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_EXCEPTION'
  | 'INSIGHT_EXECUTION_INCONSISTENT_SNAPSHOT_RESULT'
  | 'INSIGHT_EXECUTION_INCONSISTENT_KNOWLEDGE_RESULT'
  | 'INSIGHT_EXECUTION_TRACEABILITY_MISMATCH'
  | 'INSIGHT_EXECUTION_PIPELINE_FAILURE'

export interface InsightExecutionTraceability {
  readonly executionId: string | null
  readonly snapshotIntegrationId: string | null
  readonly knowledgeIntegrationId: string | null
  readonly snapshot?: {
    readonly snapshotId: string
    readonly snapshotKey: string
    readonly snapshotRevision: number
    readonly snapshotVersion: string
    readonly canonicalizationVersion: string
  }
  readonly completedStages: readonly InsightExecutionStage[]
  readonly snapshotIntegrationTraceability?: SnapshotKnowledgeTraceability
  readonly knowledgeIntegrationTraceability?: KnowledgeRuntimeTraceability
  readonly relation?: {
    readonly snapshotToKnowledgeCollectionMatches: true
    readonly knowledgeCollectionToRuntimeMatches: true
    readonly runtimeExecutionMatchesRequest: true
  }
}

export interface InsightExecutionSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly stage: 'pipeline'
  readonly executionId: string
  readonly completedStages: readonly ['snapshot-integration', 'knowledge-integration']
  readonly traceability: InsightExecutionTraceability
  readonly snapshotIntegration: SnapshotKnowledgeIntegrationSuccess
  readonly knowledgeIntegration: KnowledgeIntegrationSuccess
  readonly runtimeResponse: KnowledgeIntegrationSuccess['adapterResult']['response']
}

export interface InsightExecutionFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly stage: InsightExecutionStage
  readonly executionId: string | null
  readonly code: InsightExecutionFailureCode
  readonly message: string
  readonly causeCode?: string
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
  readonly traceability: InsightExecutionTraceability
  readonly snapshotIntegrationResult?: SnapshotKnowledgeIntegrationSuccess | SnapshotKnowledgeIntegrationFailure
  readonly knowledgeIntegrationResult?: KnowledgeIntegrationSuccess | KnowledgeIntegrationFailure
}

export type InsightExecutionResult =
  | InsightExecutionSuccess
  | InsightExecutionFailure
