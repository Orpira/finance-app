import type {
  CanonicalSnapshotDocument,
  CanonicalizationVersion,
  EngineVersion,
  RulesetVersion,
  SealedFinancialSnapshotStatus,
  SealedSnapshotId,
  SnapshotFingerprint,
  SnapshotKey,
  SnapshotNormativeCode,
  SnapshotScopeKind,
  SnapshotVersion,
  UtcInstant,
} from './financialSnapshot'

export const FINANCIAL_SNAPSHOT_LOCAL_SCHEMA_VERSION = 1 as const

export interface PersistedFinancialSnapshot<TEngineResult = unknown> {
  readonly snapshotId: SealedSnapshotId
  readonly snapshotKey: SnapshotKey
  readonly revision: number
  readonly revisionReasonCode: SnapshotNormativeCode
  readonly status: Extract<SealedFinancialSnapshotStatus, 'persisted'>
  readonly canonicalDocument: CanonicalSnapshotDocument<TEngineResult>
  readonly fingerprint: SnapshotFingerprint
  readonly sealedAt: UtcInstant
  readonly supersedesSnapshotId?: SealedSnapshotId
  readonly persistedAt: UtcInstant
  readonly localSchemaVersion: typeof FINANCIAL_SNAPSHOT_LOCAL_SCHEMA_VERSION
  readonly snapshotVersion: SnapshotVersion
  readonly canonicalizationVersion: CanonicalizationVersion
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly scopeKind: SnapshotScopeKind
  readonly scopePeriodStart: string
  readonly fingerprintValue: string
}
