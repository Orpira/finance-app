import type {
  InsightRuleDescriptor,
  InsightRuleProtocolVersion,
} from '../types/insightRule'
import type {
  KnowledgeCollectionId,
  KnowledgeCollectionVersions,
  ValidatedKnowledgeCollection,
} from '../types/knowledgeLayer'
import type {
  SealedSnapshotId,
  SnapshotKey,
} from '../types/financialSnapshot'
import type { RuntimeAdapterSuccess } from './adapterInterfaces'

export interface KnowledgeIntegrationRequest {
  readonly integrationId: string
  readonly executionId: string
  readonly protocolVersion?: InsightRuleProtocolVersion
  readonly knowledgeCollection: ValidatedKnowledgeCollection
  readonly rules: readonly InsightRuleDescriptor[]
}

export type KnowledgeIntegrationFailureCode =
  | 'KNOWLEDGE_INTEGRATION_INVALID_REQUEST'
  | 'KNOWLEDGE_INTEGRATION_INVALID_COLLECTION'
  | 'KNOWLEDGE_INTEGRATION_PROTOCOL_INCOMPATIBLE'
  | 'KNOWLEDGE_INTEGRATION_VERSION_INCOMPATIBLE'
  | 'KNOWLEDGE_INTEGRATION_MISSING_DEPENDENCY'
  | 'KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE'
  | 'KNOWLEDGE_INTEGRATION_INCONSISTENT_RESPONSE'
  | 'KNOWLEDGE_INTEGRATION_TRACEABILITY_INCONSISTENT'

export interface KnowledgeRuntimeTraceability {
  readonly integrationId: string
  readonly knowledgeCollection: {
    readonly knowledgeCollectionId: KnowledgeCollectionId
    readonly sourceSnapshotId: SealedSnapshotId
    readonly sourceSnapshotKey: SnapshotKey
    readonly sourceSnapshotRevision: number
    readonly versions: KnowledgeCollectionVersions
    readonly factCount: number
  }
  readonly runtime: {
    readonly executionId: string
    readonly protocolVersion: InsightRuleProtocolVersion
    readonly rulesCount: number
  }
  readonly relation: {
    readonly requestExecutionIdMatches: true
    readonly requestProtocolMatches: true
    readonly requestKnowledgeCollectionMatches: true
    readonly adapterKnowledgeCollectionMatches: true
    readonly runtimeExecutionIdMatches: true
  }
}

export interface KnowledgeIntegrationSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly integrationId: string
  readonly traceability: KnowledgeRuntimeTraceability
  readonly adapterResult: RuntimeAdapterSuccess
}

export interface KnowledgeIntegrationFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly integrationId: string | null
  readonly code: KnowledgeIntegrationFailureCode
  readonly message: string
  readonly causeCode?: string
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}

export type KnowledgeIntegrationResult =
  | KnowledgeIntegrationSuccess
  | KnowledgeIntegrationFailure
