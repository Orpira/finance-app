import type {
  CanonicalizationVersion,
  SealedSnapshotId,
  SnapshotKey,
  SnapshotVersion,
} from '../types/financialSnapshot'
import type {
  KnowledgeCollectionId,
  KnowledgeCollectionVersions,
  ValidatedKnowledgeCollection,
} from '../types/knowledgeLayer'
import type { SnapshotKnowledgeInputSnapshot } from './snapshotKnowledgeIntegrationInterfaces'

export interface SnapshotKnowledgeIntegrationRequest {
  readonly integrationId: string
  readonly snapshot: SnapshotKnowledgeInputSnapshot
  readonly versions: KnowledgeCollectionVersions
}

export type SnapshotKnowledgeIntegrationFailureCode =
  | 'INTEGRATION_INVALID_REQUEST'
  | 'INTEGRATION_INVALID_SNAPSHOT'
  | 'INTEGRATION_SNAPSHOT_VERSION_INCOMPATIBLE'
  | 'INTEGRATION_PROTOCOL_UNSUPPORTED'
  | 'INTEGRATION_MISSING_DEPENDENCY'
  | 'INTEGRATION_KNOWLEDGE_LAYER_FAILURE'
  | 'INTEGRATION_KNOWLEDGE_LAYER_INVALID_RESPONSE'
  | 'INTEGRATION_KNOWLEDGE_COLLECTION_INCONSISTENT'
  | 'INTEGRATION_TRACEABILITY_INCONSISTENT'

export interface SnapshotKnowledgeTraceability {
  readonly integrationId: string
  readonly snapshot: {
    readonly snapshotId: SealedSnapshotId
    readonly snapshotKey: SnapshotKey
    readonly snapshotRevision: number
    readonly snapshotVersion: SnapshotVersion
    readonly canonicalizationVersion: CanonicalizationVersion
  }
  readonly knowledgeCollection: {
    readonly knowledgeCollectionId: KnowledgeCollectionId
    readonly versions: KnowledgeCollectionVersions
    readonly state: 'validated'
  }
  readonly relation: {
    readonly sourceSnapshotIdMatches: true
    readonly sourceSnapshotKeyMatches: true
    readonly sourceSnapshotRevisionMatches: true
    readonly sourceFingerprintMatches: true
  }
}

export interface SnapshotKnowledgeIntegrationSuccess {
  readonly ok: true
  readonly status: 'success'
  readonly deterministic: true
  readonly failClosed: true
  readonly integrationId: string
  readonly knowledgeCollection: ValidatedKnowledgeCollection
  readonly traceability: SnapshotKnowledgeTraceability
}

export interface SnapshotKnowledgeIntegrationFailure {
  readonly ok: false
  readonly status: 'failure'
  readonly deterministic: true
  readonly failClosed: true
  readonly integrationId: string | null
  readonly code: SnapshotKnowledgeIntegrationFailureCode
  readonly message: string
  readonly causeCode?: string
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}

export type SnapshotKnowledgeIntegrationResult =
  | SnapshotKnowledgeIntegrationSuccess
  | SnapshotKnowledgeIntegrationFailure
