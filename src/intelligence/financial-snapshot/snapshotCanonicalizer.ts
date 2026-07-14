import type {
  AppliedRule,
  CanonicalFinancialSnapshotPayload,
  CanonicalSnapshotDocument,
  FinancialContextEvidence,
  FinancialEvidence,
  FinancialEvidenceRecord,
  SnapshotCandidateMetadata,
  SnapshotJsonValue,
  ValidatedSnapshotCandidate,
} from '../../types/financialSnapshot'
import { SUPPORTED_CANONICALIZATION_VERSION } from './snapshotCandidateValidator'

export type SnapshotCanonicalizationErrorCode =
  | 'SNAPSHOT_UNSUPPORTED_CANONICALIZATION_VERSION'
  | 'SNAPSHOT_CANONICALIZATION_INVALID_STATE'
  | 'SNAPSHOT_CANONICALIZATION_INVALID_VALUE'
  | 'SNAPSHOT_CANONICALIZATION_INVALID_RULE_ORDER'
  | 'SNAPSHOT_CANONICALIZATION_INVALID_EVIDENCE'
  | 'SNAPSHOT_CANONICALIZATION_CYCLIC_VALUE'

export class SnapshotCanonicalizationError extends Error {
  readonly code: SnapshotCanonicalizationErrorCode

  constructor(code: SnapshotCanonicalizationErrorCode) {
    super(code)
    this.name = 'SnapshotCanonicalizationError'
    this.code = code
  }
}

function fail(code: SnapshotCanonicalizationErrorCode): never {
  throw new SnapshotCanonicalizationError(code)
}

function compareStrings(first: string, second: string): number {
  if (first < second) return -1
  if (first > second) return 1
  return 0
}

function canonicalizeValue(
  value: unknown,
  ancestors: ReadonlySet<object>,
): SnapshotJsonValue {
  if (value === null || value === undefined || value instanceof Date) {
    return fail('SNAPSHOT_CANONICALIZATION_INVALID_VALUE')
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fail('SNAPSHOT_CANONICALIZATION_INVALID_VALUE')
    }
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value !== 'object') {
    return fail('SNAPSHOT_CANONICALIZATION_INVALID_VALUE')
  }
  if (ancestors.has(value)) {
    return fail('SNAPSHOT_CANONICALIZATION_CYCLIC_VALUE')
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item, nextAncestors))
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return fail('SNAPSHOT_CANONICALIZATION_INVALID_VALUE')
  }

  const result: { [key: string]: SnapshotJsonValue } = {}
  for (const key of Object.keys(value).sort(compareStrings)) {
    result[key] = canonicalizeValue(
      (value as { readonly [key: string]: unknown })[key],
      nextAncestors,
    )
  }
  return result
}

function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value, new Set()))
}

function sortStrings<T extends string>(values: readonly T[]): readonly T[] {
  return [...values].sort(compareStrings)
}

function canonicalizeRules(rules: readonly AppliedRule[]): readonly AppliedRule[] {
  return rules.map((rule, index) => {
    if (rule.order !== index) {
      fail('SNAPSHOT_CANONICALIZATION_INVALID_RULE_ORDER')
    }
    return canonicalizeValue({
      ...rule,
      affectedFields: sortStrings(rule.affectedFields),
      limitationCodes: sortStrings(rule.limitationCodes),
      warningCodes: sortStrings(rule.warningCodes),
    }, new Set()) as unknown as AppliedRule
  })
}

function canonicalizeEvidence(evidence: FinancialEvidence): FinancialEvidence {
  const included = evidence.records.filter(
    (record) => record.disposition === 'included',
  ).length
  const excluded = evidence.records.length - included
  if (
    evidence.strategy !== 'embedded-v1' ||
    evidence.candidateRecordCount !== evidence.records.length ||
    evidence.includedRecordCount !== included ||
    evidence.excludedRecordCount !== excluded
  ) {
    return fail('SNAPSHOT_CANONICALIZATION_INVALID_EVIDENCE')
  }

  const records = evidence.records
    .map((record) => canonicalizeValue(record, new Set()) as unknown as FinancialEvidenceRecord)
    .sort((first, second) => {
      const kindOrder = compareStrings(first.kind, second.kind)
      if (kindOrder !== 0) return kindOrder
      const identityOrder = compareStrings(first.identityKind, second.identityKind)
      if (identityOrder !== 0) return identityOrder
      const dateOrder = compareStrings(first.logicalDate, second.logicalDate)
      if (dateOrder !== 0) return dateOrder
      return compareStrings(canonicalString(first), canonicalString(second))
    })

  const context = evidence.context
    .map((item) => canonicalizeValue(item, new Set()) as unknown as FinancialContextEvidence)
    .sort((first, second) =>
      compareStrings(canonicalString(first), canonicalString(second)),
    )

  return canonicalizeValue({
    ...evidence,
    records,
    context,
    coverageCodes: sortStrings(evidence.coverageCodes),
    warningCodes: sortStrings(evidence.warningCodes),
  }, new Set()) as unknown as FinancialEvidence
}

function canonicalizeMetadata(
  metadata: SnapshotCandidateMetadata,
): SnapshotCandidateMetadata {
  return canonicalizeValue({
    ...metadata,
    qualityCodes: sortStrings(metadata.qualityCodes),
    warningCodes: sortStrings(metadata.warningCodes),
    limitationCodes: sortStrings(metadata.limitationCodes),
  }, new Set()) as unknown as SnapshotCandidateMetadata
}

/** Produces the V1 canonical document without fingerprinting or sealing. */
export function canonicalizeValidatedSnapshotCandidate<TEngineResult>(
  candidate: ValidatedSnapshotCandidate<TEngineResult>,
): CanonicalSnapshotDocument<TEngineResult> {
  if ((candidate as { readonly status?: unknown }).status !== 'validated') {
    fail('SNAPSHOT_CANONICALIZATION_INVALID_STATE')
  }
  if (candidate.canonicalizationVersion !== SUPPORTED_CANONICALIZATION_VERSION) {
    fail('SNAPSHOT_UNSUPPORTED_CANONICALIZATION_VERSION')
  }

  const payload = canonicalizeValue({
    snapshotVersion: candidate.snapshotVersion,
    engineVersion: candidate.engineVersion,
    rulesetVersion: candidate.rulesetVersion,
    scope: candidate.scope,
    engineResult: candidate.engineResult,
    evidence: canonicalizeEvidence(candidate.evidence),
    appliedRules: canonicalizeRules(candidate.appliedRules),
    metadata: canonicalizeMetadata(candidate.metadata),
  }, new Set()) as unknown as CanonicalFinancialSnapshotPayload<TEngineResult>

  return canonicalizeValue({
    canonicalizationVersion: candidate.canonicalizationVersion,
    payload,
  }, new Set()) as unknown as CanonicalSnapshotDocument<TEngineResult>
}

/** Serializes an already canonical document for deterministic test vectors. */
export function serializeCanonicalSnapshotDocument(
  document: CanonicalSnapshotDocument<unknown>,
): string {
  return JSON.stringify(canonicalizeValue(document, new Set()))
}
