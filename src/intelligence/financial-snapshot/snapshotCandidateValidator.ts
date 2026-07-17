import type {
  DraftSnapshotCandidate,
  FinancialEvidence,
  FinancialEvidenceRecord,
  SnapshotJsonValue,
  ValidatedSnapshotCandidate,
} from '../../types/financialSnapshot'
import {
  isSupportedCanonicalizationVersion,
  isSupportedSnapshotVersion,
} from './snapshotProtocol'

export { SUPPORTED_SNAPSHOT_VERSION } from './snapshotProtocol'

export type SnapshotCandidateValidationErrorCode =
  | 'SNAPSHOT_VALIDATION_INVALID_STATE'
  | 'SNAPSHOT_VALIDATION_INVALID_SCOPE'
  | 'SNAPSHOT_VALIDATION_INVALID_IDENTITY'
  | 'SNAPSHOT_VALIDATION_INVALID_VERSION'
  | 'SNAPSHOT_VALIDATION_INCOMPATIBLE_VERSION'
  | 'SNAPSHOT_VALIDATION_INVALID_RULES'
  | 'SNAPSHOT_VALIDATION_INVALID_EVIDENCE'
  | 'SNAPSHOT_VALIDATION_INVALID_METADATA'
  | 'SNAPSHOT_VALIDATION_INVALID_VALUE'
  | 'SNAPSHOT_VALIDATION_NON_FINITE_NUMBER'

export class SnapshotCandidateValidationError extends Error {
  readonly code: SnapshotCandidateValidationErrorCode

  constructor(code: SnapshotCandidateValidationErrorCode) {
    super(code)
    this.name = 'SnapshotCandidateValidationError'
    this.code = code
  }
}

function fail(code: SnapshotCandidateValidationErrorCode): never {
  throw new SnapshotCandidateValidationError(code)
}

function requireNonEmpty(
  value: string,
  code: SnapshotCandidateValidationErrorCode,
): void {
  if (value.trim().length === 0) {
    fail(code)
  }
}

function cloneSerializable(value: unknown, ancestors: ReadonlySet<object>): SnapshotJsonValue {
  if (value === null || value === undefined || value instanceof Date) {
    return fail('SNAPSHOT_VALIDATION_INVALID_VALUE')
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fail('SNAPSHOT_VALIDATION_NON_FINITE_NUMBER')
    }
    return value
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value !== 'object' || ancestors.has(value)) {
    return fail('SNAPSHOT_VALIDATION_INVALID_VALUE')
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => cloneSerializable(item, nextAncestors))
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return fail('SNAPSHOT_VALIDATION_INVALID_VALUE')
  }

  const clone: { [key: string]: SnapshotJsonValue } = {}
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneSerializable(item, nextAncestors)
  }
  return clone
}

function validateVersions(candidate: DraftSnapshotCandidate<unknown>): void {
  requireNonEmpty(candidate.snapshotVersion, 'SNAPSHOT_VALIDATION_INVALID_VERSION')
  requireNonEmpty(
    candidate.canonicalizationVersion,
    'SNAPSHOT_VALIDATION_INVALID_VERSION',
  )
  requireNonEmpty(candidate.engineVersion, 'SNAPSHOT_VALIDATION_INVALID_VERSION')
  requireNonEmpty(candidate.rulesetVersion, 'SNAPSHOT_VALIDATION_INVALID_VERSION')

  if (
    !isSupportedSnapshotVersion(candidate.snapshotVersion) ||
    !isSupportedCanonicalizationVersion(candidate.canonicalizationVersion)
  ) {
    fail('SNAPSHOT_VALIDATION_INCOMPATIBLE_VERSION')
  }
  if (candidate.rulesetVersion !== `engine-bundled/${candidate.engineVersion}`) {
    fail('SNAPSHOT_VALIDATION_INCOMPATIBLE_VERSION')
  }
}

function validateScope(candidate: DraftSnapshotCandidate<unknown>): void {
  const { scope } = candidate
  requireNonEmpty(scope.periodStart, 'SNAPSHOT_VALIDATION_INVALID_SCOPE')
  requireNonEmpty(scope.periodEndExclusive, 'SNAPSHOT_VALIDATION_INVALID_SCOPE')
  requireNonEmpty(scope.asOf, 'SNAPSHOT_VALIDATION_INVALID_SCOPE')
  requireNonEmpty(scope.timezone, 'SNAPSHOT_VALIDATION_INVALID_SCOPE')
  requireNonEmpty(scope.currency, 'SNAPSHOT_VALIDATION_INVALID_SCOPE')

  if (
    scope.periodBoundary !== '[start,end)' ||
    scope.periodStart >= scope.periodEndExclusive ||
    (scope.kind === 'season' &&
      (scope.usageMode !== 'professional' || scope.earningPeriodId === undefined))
  ) {
    fail('SNAPSHOT_VALIDATION_INVALID_SCOPE')
  }
}

function validateRecord(record: FinancialEvidenceRecord): void {
  const allowedKinds = new Set([
    'income',
    'income-adjustment',
    'expense',
    'expense-adjustment',
  ])
  if (!allowedKinds.has(record.kind)) {
    fail('SNAPSHOT_VALIDATION_INVALID_EVIDENCE')
  }
  requireNonEmpty(record.logicalDate, 'SNAPSHOT_VALIDATION_INVALID_EVIDENCE')
  if (
    record.identityKind === 'persisted-id' &&
    (record.sourceId === undefined || String(record.sourceId).trim().length === 0)
  ) {
    fail('SNAPSHOT_VALIDATION_INVALID_EVIDENCE')
  }
  if (record.disposition === 'excluded') {
    requireNonEmpty(
      record.exclusionCode,
      'SNAPSHOT_VALIDATION_INVALID_EVIDENCE',
    )
  }
}

function validateEvidence(evidence: FinancialEvidence): void {
  const included = evidence.records.filter(
    (record) => record.disposition === 'included',
  ).length
  const excluded = evidence.records.length - included
  if (
    evidence.strategy !== 'embedded-v1' ||
    !Number.isSafeInteger(evidence.candidateRecordCount) ||
    !Number.isSafeInteger(evidence.includedRecordCount) ||
    !Number.isSafeInteger(evidence.excludedRecordCount) ||
    evidence.candidateRecordCount < 0 ||
    evidence.includedRecordCount < 0 ||
    evidence.excludedRecordCount < 0 ||
    evidence.candidateRecordCount !== evidence.records.length ||
    evidence.includedRecordCount !== included ||
    evidence.excludedRecordCount !== excluded
  ) {
    fail('SNAPSHOT_VALIDATION_INVALID_EVIDENCE')
  }
  evidence.records.forEach(validateRecord)
}

function validateRules(candidate: DraftSnapshotCandidate<unknown>): void {
  const ids = new Set<string>()
  candidate.appliedRules.forEach((rule, index) => {
    requireNonEmpty(rule.ruleId, 'SNAPSHOT_VALIDATION_INVALID_RULES')
    requireNonEmpty(rule.explanationCode, 'SNAPSHOT_VALIDATION_INVALID_RULES')
    if (
      rule.order !== index ||
      ids.has(rule.ruleId) ||
      rule.engineVersion !== candidate.engineVersion ||
      rule.rulesetVersion !== candidate.rulesetVersion
    ) {
      fail('SNAPSHOT_VALIDATION_INVALID_RULES')
    }
    ids.add(rule.ruleId)
  })
}

function validateMetadata(candidate: DraftSnapshotCandidate<unknown>): void {
  requireNonEmpty(
    candidate.metadata.generatedAt,
    'SNAPSHOT_VALIDATION_INVALID_METADATA',
  )
  requireNonEmpty(
    candidate.metadata.generationReasonCode,
    'SNAPSHOT_VALIDATION_INVALID_METADATA',
  )
  if (candidate.metadata.provenance !== 'local') {
    fail('SNAPSHOT_VALIDATION_INVALID_METADATA')
  }
}

/** Validates a draft candidate and returns an independent validated copy. */
export function validateSnapshotCandidate<TEngineResult>(
  candidate: DraftSnapshotCandidate<TEngineResult>,
): ValidatedSnapshotCandidate<TEngineResult> {
  if ((candidate as { readonly status?: unknown }).status !== 'draft') {
    fail('SNAPSHOT_VALIDATION_INVALID_STATE')
  }
  requireNonEmpty(
    candidate.identity.candidateId,
    'SNAPSHOT_VALIDATION_INVALID_IDENTITY',
  )
  validateVersions(candidate)
  validateScope(candidate)
  validateEvidence(candidate.evidence)
  validateRules(candidate)
  validateMetadata(candidate)

  const clone = cloneSerializable(candidate, new Set()) as unknown as Omit<
    ValidatedSnapshotCandidate<TEngineResult>,
    'status'
  >
  return { ...clone, status: 'validated' }
}
