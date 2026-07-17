import { fingerprintCanonicalKnowledgeDocument } from '../intelligence/knowledge-layer/knowledgeFingerprint'
import {
  assessKnowledgeSnapshotPromotion,
  type KnowledgePromotionAssessment,
} from '../intelligence/knowledge-layer/knowledgePromotionPolicy'
import { KnowledgeSnapshotRepository } from '../intelligence/knowledge-layer/knowledgeSnapshotRepository'
import { deriveKnowledgeSnapshotKey } from '../intelligence/knowledge-layer/knowledgeSealer'
import type { PersistedKnowledgeSnapshot } from '../types/persistedKnowledgeSnapshot'
import type {
  KnowledgeCanonicalizationVersion,
  KnowledgeCollectionVersions,
  KnowledgeScope,
  KnowledgeRevisionReasonCode,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
  SealedKnowledgeSnapshot,
} from '../types/knowledgeLayer'
import type { SealedSnapshotId } from '../types/financialSnapshot'

export interface KnowledgePromotionSupportedVersions extends KnowledgeCollectionVersions {
  readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
}

export type KnowledgePromotionFallbackReason =
  | 'feature_disabled'
  | 'not_found'
  | 'repository_error'
  | 'not_latest'
  | 'revision_conflict'
  | 'invalid_chain'
  | 'fingerprint_mismatch'
  | 'identity_mismatch'
  | 'key_mismatch'
  | 'source_mismatch'
  | 'incompatible_version'
  | 'policy_rejected'
  | 'invalid_contract'
  | 'internal_error'

export interface KnowledgePromotionExecutionResult {
  readonly source: 'none' | 'knowledge'
  readonly snapshot?: SealedKnowledgeSnapshot
  readonly assessment?: KnowledgePromotionAssessment
  readonly fallbackReason?: KnowledgePromotionFallbackReason
  readonly revision?: number
}

export interface KnowledgePromotionRepositoryPort {
  getLatestByKnowledgeSnapshotKey(
    knowledgeSnapshotKey: KnowledgeSnapshotKey,
  ): Promise<PersistedKnowledgeSnapshot>
  listByKnowledgeSnapshotKey(
    knowledgeSnapshotKey: KnowledgeSnapshotKey,
  ): Promise<PersistedKnowledgeSnapshot[]>
}

export interface KnowledgePromotionExecutionInput {
  readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
  readonly expectedScope: KnowledgeScope
  readonly supportedVersions: KnowledgePromotionSupportedVersions
  readonly featureEnabled: boolean
  readonly repository?: KnowledgePromotionRepositoryPort
  readonly sourceSnapshotId?: SealedSnapshotId
  readonly consumer: string
  readonly diagnosticScope: string
  readonly dev?: boolean
  readonly logger?: (message: string, details: Record<string, unknown>) => void
}

export function isKnowledgePromotionEnabled(): boolean {
  return import.meta.env.VITE_KNOWLEDGE_PROMOTION_ENABLED === 'true'
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function truncate(value: string): string {
  if (value.length <= 24) return value
  return `${value.slice(0, 12)}...${value.slice(-8)}`
}

function shouldLog(input: KnowledgePromotionExecutionInput): boolean {
  return input.dev ?? import.meta.env.DEV
}

function logDecision(
  input: KnowledgePromotionExecutionInput,
  result: KnowledgePromotionExecutionResult,
): void {
  if (!shouldLog(input)) return

  const logger = input.logger ?? console.info
  logger('[knowledge-promotion] Promotion decision', {
    consumer: input.consumer,
    diagnosticScope: input.diagnosticScope,
    source: result.source,
    knowledgeSnapshotKey: truncate(input.knowledgeSnapshotKey),
    revision: result.revision,
    fallbackReason: result.fallbackReason,
    failedChecks: result.assessment?.failedChecks.map((check) => check.code),
    versions: input.supportedVersions,
    sourceSnapshotId:
      result.snapshot === undefined
        ? input.sourceSnapshotId === undefined
          ? undefined
          : truncate(input.sourceSnapshotId)
        : truncate(result.snapshot.sourceSnapshotReferences.snapshotId),
  })
}

function none(fallbackReason: KnowledgePromotionFallbackReason): KnowledgePromotionExecutionResult {
  return { source: 'none', fallbackReason }
}

function knowledge(
  snapshot: SealedKnowledgeSnapshot,
  assessment: KnowledgePromotionAssessment,
): KnowledgePromotionExecutionResult {
  return {
    source: 'knowledge',
    snapshot,
    assessment,
    revision: snapshot.revision,
  }
}

function safeInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function fallbackFromError(error: unknown): KnowledgePromotionFallbackReason {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { readonly code?: unknown }).code)
    if (code === 'KNOWLEDGE_PERSISTENCE_NOT_FOUND') return 'not_found'
    if (code.startsWith('KNOWLEDGE_PERSISTENCE_')) return 'repository_error'
  }
  if (error instanceof Error) {
    if (error.message === 'KNOWLEDGE_PERSISTENCE_NOT_FOUND') return 'not_found'
    if (error.message.startsWith('KNOWLEDGE_PERSISTENCE_')) return 'repository_error'
  }
  return 'internal_error'
}

function readSourceSnapshotReferences(record: PersistedKnowledgeSnapshot): {
  readonly snapshotId: SealedSnapshotId
  readonly snapshotKey: string
  readonly snapshotRevision: number
  readonly sourceFingerprintValue: string
} {
  const source = record.canonicalDocument.payload.sourceSnapshotReferences
  return {
    snapshotId: source.snapshotId,
    snapshotKey: source.snapshotKey,
    snapshotRevision: source.snapshotRevision,
    sourceFingerprintValue: source.sourceFingerprintValue,
  }
}

function validateChain(
  records: readonly PersistedKnowledgeSnapshot[],
  latest: PersistedKnowledgeSnapshot,
  expectedKey: KnowledgeSnapshotKey,
):
  | { readonly ok: true; readonly ordered: readonly PersistedKnowledgeSnapshot[] }
  | { readonly ok: false; readonly fallbackReason: KnowledgePromotionFallbackReason } {
  if (records.length === 0) {
    return { ok: false, fallbackReason: 'not_found' }
  }

  const ordered = [...records].sort((left, right) => left.revision - right.revision)
  const seenRevisions = new Set<number>()

  for (let index = 0; index < ordered.length; index += 1) {
    const record = ordered[index]
    if (record.knowledgeSnapshotKey !== expectedKey) {
      return { ok: false, fallbackReason: 'invalid_chain' }
    }
    if (!safeInteger(record.revision, 1)) {
      return { ok: false, fallbackReason: 'invalid_contract' }
    }
    if (seenRevisions.has(record.revision)) {
      return { ok: false, fallbackReason: 'revision_conflict' }
    }
    seenRevisions.add(record.revision)

    if (record.revision !== index + 1) {
      return { ok: false, fallbackReason: 'invalid_chain' }
    }

    if (record.status !== 'sealed') {
      return { ok: false, fallbackReason: 'invalid_contract' }
    }

    if (index === 0) {
      if (record.supersedesKnowledgeSnapshotId !== undefined) {
        return { ok: false, fallbackReason: 'invalid_chain' }
      }
      continue
    }

    if (record.supersedesKnowledgeSnapshotId !== ordered[index - 1].knowledgeSnapshotId) {
      return { ok: false, fallbackReason: 'invalid_chain' }
    }
  }

  if (ordered.at(-1)?.knowledgeSnapshotId !== latest.knowledgeSnapshotId) {
    return { ok: false, fallbackReason: 'not_latest' }
  }

  return { ok: true, ordered }
}

function validateScope(
  record: PersistedKnowledgeSnapshot,
  expectedScope: KnowledgeScope,
): boolean {
  const facts = record.canonicalDocument.payload.facts
  if (!Array.isArray(facts) || facts.length === 0) return false

  return facts.every((fact) =>
    fact.scope.kind === expectedScope.kind &&
    fact.scope.periodStart === expectedScope.periodStart &&
    fact.scope.periodEndExclusive === expectedScope.periodEndExclusive &&
    fact.scope.periodBoundary === expectedScope.periodBoundary &&
    fact.scope.timezone === expectedScope.timezone &&
    fact.scope.usageMode === expectedScope.usageMode &&
    fact.scope.currency === expectedScope.currency &&
    fact.scope.earningPeriodId === expectedScope.earningPeriodId,
  )
}

function versionsMatch(
  record: PersistedKnowledgeSnapshot,
  supportedVersions: KnowledgePromotionSupportedVersions,
): boolean {
  return record.knowledgeVersion === supportedVersions.knowledgeVersion &&
    record.builderVersion === supportedVersions.builderVersion &&
    record.rulesVersion === supportedVersions.rulesVersion &&
    record.projectionVersion === supportedVersions.projectionVersion &&
    record.canonicalizationVersion === supportedVersions.canonicalizationVersion
}

function toSealedSnapshot(
  record: PersistedKnowledgeSnapshot,
): SealedKnowledgeSnapshot {
  const canonicalDocument = clone(record.canonicalDocument)
  const fingerprint = clone(record.fingerprint)

  return {
    identity: {
      knowledgeSnapshotId: record.knowledgeSnapshotId,
      knowledgeSnapshotKey: record.knowledgeSnapshotKey,
    },
    knowledgeSnapshotId: record.knowledgeSnapshotId,
    knowledgeSnapshotKey: record.knowledgeSnapshotKey,
    revision: record.revision,
    revisionReasonCode: 'revision.source_changed' as KnowledgeRevisionReasonCode,
    status: record.status,
    canonicalDocument,
    fingerprint,
    sealedAt: record.sealedAt,
    ...(record.supersedesKnowledgeSnapshotId === undefined
      ? {}
      : { supersedesKnowledgeSnapshotId: record.supersedesKnowledgeSnapshotId }),
    knowledgeVersion: record.knowledgeVersion,
    knowledgeBuilderVersion: record.builderVersion,
    knowledgeRulesVersion: record.rulesVersion,
    knowledgeProjectionVersion: record.projectionVersion,
    knowledgeCanonicalizationVersion: record.canonicalizationVersion,
    sourceSnapshotReferences: clone(canonicalDocument.payload.sourceSnapshotReferences),
    facts: clone(canonicalDocument.payload.facts),
    relationships: clone(canonicalDocument.payload.relationships),
    evidenceReferences: clone(canonicalDocument.payload.evidenceReferences),
    metadata: clone(canonicalDocument.payload.metadata),
  }
}

function sameFingerprint(
  expected: Awaited<ReturnType<typeof fingerprintCanonicalKnowledgeDocument>>,
  actual: PersistedKnowledgeSnapshot['fingerprint'],
): boolean {
  return expected.algorithm === actual.algorithm &&
    expected.encoding === actual.encoding &&
    expected.domain === actual.domain &&
    expected.fingerprintVersion === actual.fingerprintVersion &&
    expected.canonicalizationVersion === actual.canonicalizationVersion &&
    expected.value === actual.value
}

function serializeSnapshot(value: SealedKnowledgeSnapshot): boolean {
  try {
    JSON.stringify(value)
    return true
  } catch {
    return false
  }
}

/** Read-only, fail-closed promotion executor for sealed Knowledge snapshots. */
export async function executeKnowledgePromotion(
  input: KnowledgePromotionExecutionInput,
): Promise<KnowledgePromotionExecutionResult> {
  if (!input.featureEnabled) {
    const result = none('feature_disabled')
    logDecision(input, result)
    return result
  }

  const repository = input.repository ?? new KnowledgeSnapshotRepository()

  let latest: PersistedKnowledgeSnapshot
  let records: PersistedKnowledgeSnapshot[]
  try {
    ;[latest, records] = await Promise.all([
      repository.getLatestByKnowledgeSnapshotKey(input.knowledgeSnapshotKey),
      repository.listByKnowledgeSnapshotKey(input.knowledgeSnapshotKey),
    ])
  } catch (error) {
    const result = none(fallbackFromError(error))
    logDecision(input, result)
    return result
  }

  try {
    const chain = validateChain(records, latest, input.knowledgeSnapshotKey)
    if (!chain.ok) {
      const result = none(chain.fallbackReason)
      logDecision(input, result)
      return result
    }

    const ordered = chain.ordered
    const highest = ordered.at(-1)
    if (highest === undefined || highest.knowledgeSnapshotId !== latest.knowledgeSnapshotId) {
      const result = none('not_latest')
      logDecision(input, result)
      return result
    }

    if (!validateScope(latest, input.expectedScope)) {
      const result = none('invalid_contract')
      logDecision(input, result)
      return result
    }

    if (!versionsMatch(latest, input.supportedVersions)) {
      const result = none('incompatible_version')
      logDecision(input, result)
      return result
    }

    const sourceReferences = readSourceSnapshotReferences(latest)
    if (!safeInteger(sourceReferences.snapshotRevision, 1)) {
      const result = none('invalid_contract')
      logDecision(input, result)
      return result
    }

    if (sourceReferences.snapshotKey !== latest.sourceSnapshotKey) {
      const result = none('source_mismatch')
      logDecision(input, result)
      return result
    }

    if (sourceReferences.snapshotId !== latest.sourceSnapshotId) {
      const result = none('source_mismatch')
      logDecision(input, result)
      return result
    }

    if (input.sourceSnapshotId !== undefined && input.sourceSnapshotId !== latest.sourceSnapshotId) {
      const result = none('source_mismatch')
      logDecision(input, result)
      return result
    }

    const recomputedKey = deriveKnowledgeSnapshotKey(latest.canonicalDocument)
    if (recomputedKey !== input.knowledgeSnapshotKey || latest.knowledgeSnapshotKey !== input.knowledgeSnapshotKey) {
      const result = none('key_mismatch')
      logDecision(input, result)
      return result
    }

    const recomputedFingerprint = await fingerprintCanonicalKnowledgeDocument(latest.canonicalDocument)
    if (!sameFingerprint(recomputedFingerprint, latest.fingerprint) || latest.fingerprintValue !== latest.fingerprint.value) {
      const result = none('fingerprint_mismatch')
      logDecision(input, result)
      return result
    }

    const expectedSnapshotId = (
      `knowledge-snapshot:${recomputedFingerprint.fingerprintVersion}:${recomputedFingerprint.value}`
    ) as KnowledgeSnapshotId
    if (expectedSnapshotId !== latest.knowledgeSnapshotId) {
      const result = none('identity_mismatch')
      logDecision(input, result)
      return result
    }

    const sealedSnapshot = toSealedSnapshot(latest)
    if (!serializeSnapshot(sealedSnapshot)) {
      const result = none('invalid_contract')
      logDecision(input, result)
      return result
    }

    const assessment = assessKnowledgeSnapshotPromotion(sealedSnapshot)
    if (!assessment.eligible) {
      const result = { ...none('policy_rejected'), assessment }
      logDecision(input, result)
      return result
    }

    const result = knowledge(clone(sealedSnapshot), assessment)
    logDecision(input, result)
    return result
  } catch (error) {
    const result = none(error instanceof Error && error.message === 'KNOWLEDGE_PROMOTION_INVALID_CONTRACT'
      ? 'invalid_contract'
      : 'internal_error')
    logDecision(input, result)
    return result
  }
}