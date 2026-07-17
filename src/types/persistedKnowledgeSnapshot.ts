import type {
  KnowledgeBuilderVersion,
  KnowledgeCanonicalizationVersion,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
  SealedKnowledgeSnapshot,
} from './knowledgeLayer'
import type { SealedSnapshotId, SnapshotKey, UtcInstant } from './financialSnapshot'

export const KNOWLEDGE_SNAPSHOT_LOCAL_SCHEMA_VERSION = 1 as const

export interface PersistedKnowledgeSnapshot {
  readonly knowledgeSnapshotId: KnowledgeSnapshotId
  readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
  readonly revision: number
  readonly status: SealedKnowledgeSnapshot['status']
  readonly canonicalDocument: SealedKnowledgeSnapshot['canonicalDocument']
  readonly fingerprint: SealedKnowledgeSnapshot['fingerprint']
  readonly sealedAt: UtcInstant
  readonly supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId
  readonly persistedAt: UtcInstant
  readonly localSchemaVersion: typeof KNOWLEDGE_SNAPSHOT_LOCAL_SCHEMA_VERSION
  readonly knowledgeVersion: KnowledgeVersion
  readonly builderVersion: KnowledgeBuilderVersion
  readonly rulesVersion: KnowledgeRulesVersion
  readonly projectionVersion: KnowledgeProjectionVersion
  readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
  readonly sourceSnapshotId: SealedSnapshotId
  readonly sourceSnapshotKey: SnapshotKey
  readonly fingerprintValue: string
}
