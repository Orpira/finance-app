import type {
  CanonicalSnapshotDocument,
  SealedFinancialSnapshot,
  SealedSnapshotId,
  SnapshotFingerprint,
  SnapshotKey,
  SnapshotNormativeCode,
  UtcInstant,
} from '../../types/financialSnapshot'
import { serializeCanonicalSnapshotDocument } from './snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from './snapshotFingerprint'

export type SnapshotSealErrorCode =
  | 'SNAPSHOT_SEAL_INVALID_FINGERPRINT'
  | 'SNAPSHOT_SEAL_FINGERPRINT_MISMATCH'
  | 'SNAPSHOT_SEAL_INVALID_KEY'
  | 'SNAPSHOT_SEAL_INVALID_REVISION'
  | 'SNAPSHOT_SEAL_INVALID_TIME'
  | 'SNAPSHOT_SEAL_INVALID_SUPERSEDES'
  | 'SNAPSHOT_SEAL_INCOMPATIBLE_VERSION'
  | 'SNAPSHOT_SEAL_INVALID_DOCUMENT'

export class SnapshotSealError extends Error {
  readonly code: SnapshotSealErrorCode

  constructor(code: SnapshotSealErrorCode) {
    super(code)
    this.name = 'SnapshotSealError'
    this.code = code
  }
}

export interface SnapshotSealingInput<TEngineResult = unknown> {
  readonly canonicalDocument: CanonicalSnapshotDocument<TEngineResult>
  readonly fingerprint: SnapshotFingerprint
  readonly snapshotKey: SnapshotKey
  readonly revision: number
  readonly revisionReasonCode: SnapshotNormativeCode
  readonly sealedAt: UtcInstant
  readonly supersedesSnapshotId?: SealedSnapshotId
}

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

function fail(code: SnapshotSealErrorCode): never {
  throw new SnapshotSealError(code)
}

function cloneCanonicalDocument<TEngineResult>(
  document: CanonicalSnapshotDocument<TEngineResult>,
): CanonicalSnapshotDocument<TEngineResult> {
  try {
    return JSON.parse(
      serializeCanonicalSnapshotDocument(document),
    ) as CanonicalSnapshotDocument<TEngineResult>
  } catch {
    return fail('SNAPSHOT_SEAL_INVALID_DOCUMENT')
  }
}

export function deriveSnapshotKey(
  document: CanonicalSnapshotDocument<unknown>,
): SnapshotKey {
  let canonicalScope: string
  try {
    const scope = document.payload.scope
    canonicalScope = JSON.stringify({
      currency: scope.currency,
      ...(scope.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: scope.earningPeriodId }),
      filters: scope.filters,
      kind: scope.kind,
      periodBoundary: scope.periodBoundary,
      periodEndExclusive: scope.periodEndExclusive,
      periodStart: scope.periodStart,
      timezone: scope.timezone,
      usageMode: scope.usageMode,
    })
  } catch {
    return fail('SNAPSHOT_SEAL_INVALID_DOCUMENT')
  }
  if (canonicalScope.length === 0) {
    return fail('SNAPSHOT_SEAL_INVALID_KEY')
  }
  return `pbsk:v1:${document.payload.scope.kind}:${encodeURIComponent(canonicalScope)}` as SnapshotKey
}

function fingerprintsMatch(
  received: SnapshotFingerprint,
  expected: SnapshotFingerprint,
): boolean {
  return (
    received.algorithm === expected.algorithm &&
    received.encoding === expected.encoding &&
    received.domain === expected.domain &&
    received.fingerprintVersion === expected.fingerprintVersion &&
    received.canonicalizationVersion === expected.canonicalizationVersion &&
    received.value === expected.value
  )
}

/** Verifies and seals a canonical document without persistence. */
export async function sealCanonicalSnapshot<TEngineResult>(
  input: SnapshotSealingInput<TEngineResult>,
): Promise<SealedFinancialSnapshot<TEngineResult>> {
  const { canonicalDocument, fingerprint } = input
  if (
    fingerprint.value.trim().length === 0 ||
    fingerprint.fingerprintVersion.trim().length === 0 ||
    !/^[0-9a-f]{64}$/.test(fingerprint.value)
  ) {
    fail('SNAPSHOT_SEAL_INVALID_FINGERPRINT')
  }

  let expectedFingerprint: SnapshotFingerprint
  try {
    expectedFingerprint = await fingerprintCanonicalSnapshotDocument(
      canonicalDocument,
    )
  } catch {
    return fail('SNAPSHOT_SEAL_INVALID_DOCUMENT')
  }
  if (!fingerprintsMatch(fingerprint, expectedFingerprint)) {
    fail('SNAPSHOT_SEAL_FINGERPRINT_MISMATCH')
  }

  const expectedKey = deriveSnapshotKey(canonicalDocument)
  if (input.snapshotKey.trim().length === 0 || input.snapshotKey !== expectedKey) {
    fail('SNAPSHOT_SEAL_INVALID_KEY')
  }
  if (
    !Number.isSafeInteger(input.revision) ||
    input.revision < 1 ||
    input.revisionReasonCode.trim().length === 0
  ) {
    fail('SNAPSHOT_SEAL_INVALID_REVISION')
  }
  if (
    !UTC_INSTANT_PATTERN.test(input.sealedAt) ||
    input.sealedAt < canonicalDocument.payload.metadata.generatedAt
  ) {
    fail('SNAPSHOT_SEAL_INVALID_TIME')
  }
  if (
    (input.revision === 1 && input.supersedesSnapshotId !== undefined) ||
    (input.revision > 1 &&
      (input.supersedesSnapshotId === undefined ||
        input.supersedesSnapshotId.trim().length === 0))
  ) {
    fail('SNAPSHOT_SEAL_INVALID_SUPERSEDES')
  }

  const document = cloneCanonicalDocument(canonicalDocument)
  const snapshotId =
    `financial-snapshot:${fingerprint.fingerprintVersion}:${fingerprint.value}` as SealedSnapshotId

  return {
    identity: { snapshotId, snapshotKey: input.snapshotKey },
    revision: {
      revision: input.revision,
      reasonCode: input.revisionReasonCode,
      ...(input.supersedesSnapshotId === undefined
        ? {}
        : { supersedesSnapshotId: input.supersedesSnapshotId }),
    },
    status: 'sealed',
    canonicalDocument: document,
    fingerprint: { ...fingerprint },
    sealedAt: input.sealedAt,
    snapshotVersion: document.payload.snapshotVersion,
    canonicalizationVersion: document.canonicalizationVersion,
    engineVersion: document.payload.engineVersion,
    rulesetVersion: document.payload.rulesetVersion,
    scope: document.payload.scope,
    evidence: document.payload.evidence,
    appliedRules: document.payload.appliedRules,
    metadata: { ...document.payload.metadata },
  }
}
