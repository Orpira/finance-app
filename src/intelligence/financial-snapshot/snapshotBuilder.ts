import type { FinancialEngineResult } from '../../services/financialEngineAdapter'
import type {
  AppliedRule,
  CanonicalizationVersion,
  DraftSnapshotCandidate,
  EngineVersion,
  FinancialEvidence,
  RulesetVersion,
  SnapshotCandidateIdentity,
  SnapshotCandidateMetadata,
  SnapshotJsonValue,
  SnapshotScope,
  SnapshotVersion,
} from '../../types/financialSnapshot'

export type SnapshotBuilderErrorCode =
  | 'SNAPSHOT_INVALID_SCOPE'
  | 'SNAPSHOT_NON_FINITE_NUMBER'
  | 'SNAPSHOT_INVALID_RULE_ORDER'
  | 'SNAPSHOT_EVIDENCE_COUNT_MISMATCH'
  | 'SNAPSHOT_MISSING_VERSION'
  | 'SNAPSHOT_INVALID_IDENTITY'
  | 'SNAPSHOT_INVALID_VALUE'
  | 'SNAPSHOT_INVALID_EVIDENCE'

export class SnapshotBuilderError extends Error {
  readonly code: SnapshotBuilderErrorCode

  constructor(code: SnapshotBuilderErrorCode) {
    super(code)
    this.name = 'SnapshotBuilderError'
    this.code = code
  }
}

export interface SnapshotBuilderInput {
  readonly candidateIdentity: SnapshotCandidateIdentity
  readonly scope: SnapshotScope
  readonly financialEngineResult: FinancialEngineResult
  readonly evidence: FinancialEvidence
  readonly appliedRules: readonly AppliedRule[]
  readonly snapshotVersion: SnapshotVersion
  readonly canonicalizationVersion: CanonicalizationVersion
  readonly engineVersion: EngineVersion
  readonly rulesetVersion: RulesetVersion
  readonly metadata: SnapshotCandidateMetadata
}

function fail(code: SnapshotBuilderErrorCode): never {
  throw new SnapshotBuilderError(code)
}

function requireNonEmpty(value: string, code: SnapshotBuilderErrorCode): void {
  if (value.trim().length === 0) {
    fail(code)
  }
}

function cloneSerializable(value: unknown, seen: ReadonlySet<object>): SnapshotJsonValue {
  if (value === null || value === undefined || value instanceof Date) {
    return fail('SNAPSHOT_INVALID_VALUE')
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fail('SNAPSHOT_NON_FINITE_NUMBER')
    }
    return value
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (typeof value !== 'object') {
    return fail('SNAPSHOT_INVALID_VALUE')
  }

  if (seen.has(value)) {
    return fail('SNAPSHOT_INVALID_VALUE')
  }

  const nextSeen = new Set(seen)
  nextSeen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => cloneSerializable(item, nextSeen))
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return fail('SNAPSHOT_INVALID_VALUE')
  }

  const clone: { [key: string]: SnapshotJsonValue } = {}
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneSerializable(item, nextSeen)
  }
  return clone
}

function cloneValue<T>(value: T): T {
  return cloneSerializable(value, new Set()) as T
}

function validateScope(scope: SnapshotScope): void {
  requireNonEmpty(scope.periodStart, 'SNAPSHOT_INVALID_SCOPE')
  requireNonEmpty(scope.periodEndExclusive, 'SNAPSHOT_INVALID_SCOPE')
  requireNonEmpty(scope.timezone, 'SNAPSHOT_INVALID_SCOPE')
  requireNonEmpty(scope.currency, 'SNAPSHOT_INVALID_SCOPE')

  if (scope.periodStart >= scope.periodEndExclusive) {
    fail('SNAPSHOT_INVALID_SCOPE')
  }
}

function validateRules(
  rules: readonly AppliedRule[],
  engineVersion: EngineVersion,
  rulesetVersion: RulesetVersion,
): void {
  rules.forEach((rule, index) => {
    requireNonEmpty(rule.ruleId, 'SNAPSHOT_INVALID_IDENTITY')
    requireNonEmpty(rule.explanationCode, 'SNAPSHOT_INVALID_IDENTITY')
    if (
      rule.order !== index ||
      rule.engineVersion !== engineVersion ||
      rule.rulesetVersion !== rulesetVersion
    ) {
      fail('SNAPSHOT_INVALID_RULE_ORDER')
    }
  })
}

function validateEvidence(evidence: FinancialEvidence): void {
  const included = evidence.records.filter(
    (record) => record.disposition === 'included',
  ).length
  const excluded = evidence.records.length - included

  if (
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
    fail('SNAPSHOT_EVIDENCE_COUNT_MISMATCH')
  }

  const allowedKinds = new Set([
    'income',
    'income-adjustment',
    'expense',
    'expense-adjustment',
  ])
  for (const record of evidence.records) {
    if (!allowedKinds.has(record.kind)) {
      fail('SNAPSHOT_INVALID_EVIDENCE')
    }
    requireNonEmpty(record.logicalDate, 'SNAPSHOT_INVALID_IDENTITY')
    if (
      record.identityKind === 'persisted-id' &&
      (record.sourceId === undefined || String(record.sourceId).trim().length === 0)
    ) {
      fail('SNAPSHOT_INVALID_IDENTITY')
    }
    if (record.disposition === 'excluded') {
      requireNonEmpty(record.exclusionCode, 'SNAPSHOT_INVALID_EVIDENCE')
    }
  }
}

/** Builds a draft candidate without calculating, canonicalizing or sealing it. */
export function buildSnapshotCandidate(
  input: SnapshotBuilderInput,
): DraftSnapshotCandidate<FinancialEngineResult> {
  requireNonEmpty(input.candidateIdentity.candidateId, 'SNAPSHOT_INVALID_IDENTITY')
  requireNonEmpty(input.snapshotVersion, 'SNAPSHOT_MISSING_VERSION')
  requireNonEmpty(input.canonicalizationVersion, 'SNAPSHOT_MISSING_VERSION')
  requireNonEmpty(input.engineVersion, 'SNAPSHOT_MISSING_VERSION')
  requireNonEmpty(input.rulesetVersion, 'SNAPSHOT_MISSING_VERSION')
  requireNonEmpty(input.metadata.generatedAt, 'SNAPSHOT_INVALID_VALUE')

  validateScope(input.scope)
  validateRules(input.appliedRules, input.engineVersion, input.rulesetVersion)
  validateEvidence(input.evidence)
  cloneSerializable(input, new Set())

  return {
    status: 'draft',
    identity: cloneValue(input.candidateIdentity),
    scope: cloneValue(input.scope),
    engineResult: cloneValue(input.financialEngineResult),
    evidence: cloneValue(input.evidence),
    appliedRules: cloneValue(input.appliedRules),
    metadata: cloneValue(input.metadata),
    snapshotVersion: input.snapshotVersion,
    canonicalizationVersion: input.canonicalizationVersion,
    engineVersion: input.engineVersion,
    rulesetVersion: input.rulesetVersion,
  }
}
