import type { SealedFinancialSnapshot } from '../../types/financialSnapshot'
import {
  SUPPORTED_CANONICALIZATION_VERSION,
  SUPPORTED_SNAPSHOT_VERSION,
} from './snapshotCandidateValidator'
import {
  SNAPSHOT_FINGERPRINT_ALGORITHM,
  SNAPSHOT_FINGERPRINT_DOMAIN,
  SNAPSHOT_FINGERPRINT_ENCODING,
  SNAPSHOT_FINGERPRINT_VERSION,
} from './snapshotFingerprint'

export type SnapshotPromotionCheckCode =
  | 'fingerprint.present'
  | 'fingerprint.structure_valid'
  | 'fingerprint.version_supported'
  | 'fingerprint.algorithm_supported'
  | 'canonicalization.version_supported'
  | 'snapshot.version_supported'
  | 'engine.version_supported'
  | 'ruleset.present_and_consistent'
  | 'snapshot.status_sealed'
  | 'snapshot.identity_consistent'
  | 'snapshot.key_present'
  | 'revision.valid'
  | 'revision.supersedes_consistent'
  | 'scope.valid'
  | 'metadata.valid'
  | 'evidence.sufficient'
  | 'evidence.counts_consistent'
  | 'applied_rules.present'
  | 'applied_rules.known'
  | 'applied_rules.order_consistent'
  | 'canonical_document.present'
  | 'snapshot.cross_fields_consistent'
  | 'structure.valid'
  | 'values.allowed'

export interface SnapshotPromotionCheck {
  readonly code: SnapshotPromotionCheckCode
  readonly passed: boolean
}

export interface SnapshotPromotionAssessment {
  readonly eligible: boolean
  readonly checks: readonly SnapshotPromotionCheck[]
  readonly failedChecks: readonly SnapshotPromotionCheck[]
  readonly warnings: readonly string[]
}

const SUPPORTED_ENGINE_VERSION = '1.0.0-phase-1a-minimal'
const UTC_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/
const SUPPORTED_SCOPE_KINDS = new Set([
  'daily',
  'weekly',
  'monthly',
  'season',
  'year',
  'custom',
])
const KNOWN_RULES = new Set([
  'balance.report.current',
  'currency.stored_income_value',
  'currency.stored_expense_value',
  'income.adjustment_classification',
  'usage_mode.record_resolution',
  'duration.effective_financial',
])
const EVIDENCE_KINDS = new Set([
  'income',
  'income-adjustment',
  'expense',
  'expense-adjustment',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function safeInteger(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function structuralEqual(first: unknown, second: unknown): boolean {
  if (Object.is(first, second)) return true
  if (Array.isArray(first) || Array.isArray(second)) {
    return Array.isArray(first) &&
      Array.isArray(second) &&
      first.length === second.length &&
      first.every((value, index) => structuralEqual(value, second[index]))
  }
  if (!isRecord(first) || !isRecord(second)) return false
  const firstKeys = Object.keys(first).sort()
  const secondKeys = Object.keys(second).sort()
  return firstKeys.length === secondKeys.length &&
    firstKeys.every((key, index) =>
      key === secondKeys[index] && structuralEqual(first[key], second[key]),
    )
}

function containsForbiddenValue(
  value: unknown,
  ancestors: ReadonlySet<object>,
): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'number') return !Number.isFinite(value)
  if (typeof value === 'string' || typeof value === 'boolean') return false
  if (typeof value !== 'object' || value instanceof Date || ancestors.has(value)) {
    return true
  }
  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenValue(item, nextAncestors))
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) return true
  return Object.values(value).some((item) =>
    containsForbiddenValue(item, nextAncestors),
  )
}

function fingerprintPresent(snapshot: Record<string, unknown>): boolean {
  return isRecord(snapshot.fingerprint) && nonEmpty(snapshot.fingerprint.value)
}

function fingerprintStructureValid(snapshot: Record<string, unknown>): boolean {
  const fingerprint = snapshot.fingerprint
  return isRecord(fingerprint) &&
    typeof fingerprint.value === 'string' &&
    /^[0-9a-f]{64}$/.test(fingerprint.value) &&
    nonEmpty(fingerprint.fingerprintVersion) &&
    nonEmpty(fingerprint.canonicalizationVersion) &&
    fingerprint.encoding === SNAPSHOT_FINGERPRINT_ENCODING &&
    fingerprint.domain === SNAPSHOT_FINGERPRINT_DOMAIN
}

function canonicalDocument(snapshot: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(snapshot.canonicalDocument) ? snapshot.canonicalDocument : undefined
}

function canonicalPayload(snapshot: Record<string, unknown>): Record<string, unknown> | undefined {
  const document = canonicalDocument(snapshot)
  return document !== undefined && isRecord(document.payload)
    ? document.payload
    : undefined
}

function validScope(value: unknown): boolean {
  if (!isRecord(value)) return false
  const filtersValid = isRecord(value.filters) && !containsForbiddenValue(value.filters, new Set())
  const professionalSeason = value.kind !== 'season' ||
    (value.usageMode === 'professional' && safeInteger(value.earningPeriodId, 1))
  const basicPeriod = value.usageMode !== 'basic' || value.earningPeriodId === undefined
  return typeof value.kind === 'string' && SUPPORTED_SCOPE_KINDS.has(value.kind) &&
    typeof value.periodStart === 'string' && CIVIL_DATE.test(value.periodStart) &&
    typeof value.periodEndExclusive === 'string' && CIVIL_DATE.test(value.periodEndExclusive) &&
    value.periodStart < value.periodEndExclusive &&
    value.periodBoundary === '[start,end)' &&
    typeof value.asOf === 'string' && UTC_INSTANT.test(value.asOf) &&
    nonEmpty(value.timezone) &&
    (value.usageMode === 'basic' || value.usageMode === 'professional') &&
    nonEmpty(value.currency) && filtersValid && professionalSeason && basicPeriod
}

function validMetadata(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.generatedAt === 'string' && UTC_INSTANT.test(value.generatedAt) &&
    nonEmpty(value.generationReasonCode) &&
    value.provenance === 'local' &&
    Array.isArray(value.qualityCodes) && value.qualityCodes.every(nonEmpty) &&
    Array.isArray(value.warningCodes) && value.warningCodes.every(nonEmpty) &&
    Array.isArray(value.limitationCodes) && value.limitationCodes.every(nonEmpty)
}

function evidenceSufficient(value: unknown): boolean {
  if (!isRecord(value) || value.strategy !== 'embedded-v1' ||
    !Array.isArray(value.records) || !Array.isArray(value.context)) return false
  return value.records.every((record) =>
    isRecord(record) &&
    typeof record.kind === 'string' && EVIDENCE_KINDS.has(record.kind) &&
    typeof record.logicalDate === 'string' && CIVIL_DATE.test(record.logicalDate) &&
    (record.identityKind === 'persisted-id' || record.identityKind === 'legacy-material') &&
    (record.identityKind !== 'persisted-id' ||
      (record.sourceId !== undefined && String(record.sourceId).trim().length > 0)) &&
    (record.disposition === 'included' ||
      (record.disposition === 'excluded' && nonEmpty(record.exclusionCode))) &&
    isRecord(record.fields) && Object.keys(record.fields).length > 0,
  )
}

function evidenceCountsConsistent(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.records)) return false
  const included = value.records.filter(
    (record) => isRecord(record) && record.disposition === 'included',
  ).length
  const excluded = value.records.length - included
  return safeInteger(value.candidateRecordCount) &&
    safeInteger(value.includedRecordCount) &&
    safeInteger(value.excludedRecordCount) &&
    value.candidateRecordCount === value.records.length &&
    value.includedRecordCount === included &&
    value.excludedRecordCount === excluded
}

function rulesPresent(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function rulesKnown(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(
    (rule) => isRecord(rule) && typeof rule.ruleId === 'string' && KNOWN_RULES.has(rule.ruleId),
  )
}

function rulesOrderConsistent(
  value: unknown,
  engineVersion: unknown,
  rulesetVersion: unknown,
): boolean {
  if (!Array.isArray(value) || value.length === 0) return false
  const ids = new Set<string>()
  return value.every((rule, index) => {
    if (!isRecord(rule) || !nonEmpty(rule.ruleId) || ids.has(rule.ruleId)) return false
    ids.add(rule.ruleId)
    return rule.order === index &&
      rule.engineVersion === engineVersion &&
      rule.rulesetVersion === rulesetVersion &&
      nonEmpty(rule.explanationCode) &&
      Array.isArray(rule.affectedFields) &&
      Array.isArray(rule.limitationCodes) &&
      Array.isArray(rule.warningCodes)
  })
}

function crossFieldsConsistent(snapshot: Record<string, unknown>): boolean {
  const document = canonicalDocument(snapshot)
  const payload = canonicalPayload(snapshot)
  const fingerprint = snapshot.fingerprint
  if (document === undefined || payload === undefined || !isRecord(fingerprint)) return false
  return snapshot.snapshotVersion === payload.snapshotVersion &&
    snapshot.canonicalizationVersion === document.canonicalizationVersion &&
    snapshot.canonicalizationVersion === fingerprint.canonicalizationVersion &&
    snapshot.engineVersion === payload.engineVersion &&
    snapshot.rulesetVersion === payload.rulesetVersion &&
    structuralEqual(snapshot.scope, payload.scope) &&
    structuralEqual(snapshot.evidence, payload.evidence) &&
    structuralEqual(snapshot.appliedRules, payload.appliedRules) &&
    structuralEqual(snapshot.metadata, payload.metadata)
}

function collectWarnings(snapshot: Record<string, unknown>): readonly string[] {
  const warnings = new Set<string>([
    'policy.fingerprint_not_recomputed',
    'policy.repository_context_not_evaluated',
  ])
  const add = (values: unknown) => {
    if (Array.isArray(values)) values.filter(nonEmpty).forEach((value) => warnings.add(value))
  }
  if (isRecord(snapshot.metadata)) add(snapshot.metadata.warningCodes)
  if (isRecord(snapshot.evidence)) add(snapshot.evidence.warningCodes)
  if (Array.isArray(snapshot.appliedRules)) {
    snapshot.appliedRules.forEach((rule) => isRecord(rule) && add(rule.warningCodes))
  }
  return [...warnings].sort()
}

/** Pure eligibility assessment. It never promotes, persists or repairs snapshots. */
export function assessSnapshotPromotion(
  snapshot: SealedFinancialSnapshot<unknown>,
): SnapshotPromotionAssessment {
  if (!isRecord(snapshot)) {
    throw new TypeError('SNAPSHOT_PROMOTION_INVALID_CONTRACT')
  }
  const payload = canonicalPayload(snapshot)
  const fingerprint = isRecord(snapshot.fingerprint) ? snapshot.fingerprint : undefined
  const identity = isRecord(snapshot.identity) ? snapshot.identity : undefined
  const revision = isRecord(snapshot.revision) ? snapshot.revision : undefined
  const rules = snapshot.appliedRules
  const checks: SnapshotPromotionCheck[] = [
    { code: 'fingerprint.present', passed: fingerprintPresent(snapshot) },
    { code: 'fingerprint.structure_valid', passed: fingerprintStructureValid(snapshot) },
    { code: 'fingerprint.version_supported', passed: fingerprint?.fingerprintVersion === SNAPSHOT_FINGERPRINT_VERSION },
    { code: 'fingerprint.algorithm_supported', passed: fingerprint?.algorithm === SNAPSHOT_FINGERPRINT_ALGORITHM },
    { code: 'canonicalization.version_supported', passed: snapshot.canonicalizationVersion === SUPPORTED_CANONICALIZATION_VERSION && canonicalDocument(snapshot)?.canonicalizationVersion === SUPPORTED_CANONICALIZATION_VERSION },
    { code: 'snapshot.version_supported', passed: snapshot.snapshotVersion === SUPPORTED_SNAPSHOT_VERSION && payload?.snapshotVersion === SUPPORTED_SNAPSHOT_VERSION },
    { code: 'engine.version_supported', passed: snapshot.engineVersion === SUPPORTED_ENGINE_VERSION && payload?.engineVersion === SUPPORTED_ENGINE_VERSION },
    { code: 'ruleset.present_and_consistent', passed: nonEmpty(snapshot.rulesetVersion) && snapshot.rulesetVersion === `engine-bundled/${snapshot.engineVersion}` && payload?.rulesetVersion === snapshot.rulesetVersion },
    { code: 'snapshot.status_sealed', passed: snapshot.status === 'sealed' },
    { code: 'snapshot.identity_consistent', passed: nonEmpty(identity?.snapshotId) && isRecord(fingerprint) && identity.snapshotId === `financial-snapshot:${fingerprint.fingerprintVersion}:${fingerprint.value}` },
    { code: 'snapshot.key_present', passed: nonEmpty(identity?.snapshotKey) },
    { code: 'revision.valid', passed: safeInteger(revision?.revision, 1) && nonEmpty(revision?.reasonCode) },
    { code: 'revision.supersedes_consistent', passed: safeInteger(revision?.revision, 1) && (revision.revision === 1 ? revision.supersedesSnapshotId === undefined : nonEmpty(revision.supersedesSnapshotId)) },
    { code: 'scope.valid', passed: validScope(snapshot.scope) },
    { code: 'metadata.valid', passed: validMetadata(snapshot.metadata) && isRecord(snapshot.scope) && isRecord(snapshot.metadata) && typeof snapshot.scope.asOf === 'string' && typeof snapshot.metadata.generatedAt === 'string' && snapshot.scope.asOf <= snapshot.metadata.generatedAt },
    { code: 'evidence.sufficient', passed: evidenceSufficient(snapshot.evidence) },
    { code: 'evidence.counts_consistent', passed: evidenceCountsConsistent(snapshot.evidence) },
    { code: 'applied_rules.present', passed: rulesPresent(rules) },
    { code: 'applied_rules.known', passed: rulesKnown(rules) },
    { code: 'applied_rules.order_consistent', passed: rulesOrderConsistent(rules, snapshot.engineVersion, snapshot.rulesetVersion) },
    { code: 'canonical_document.present', passed: canonicalDocument(snapshot) !== undefined && payload !== undefined },
    { code: 'snapshot.cross_fields_consistent', passed: crossFieldsConsistent(snapshot) },
    { code: 'structure.valid', passed: isRecord(identity) && isRecord(revision) && isRecord(snapshot.fingerprint) && isRecord(snapshot.canonicalDocument) && isRecord(snapshot.scope) && isRecord(snapshot.metadata) && isRecord(snapshot.evidence) && Array.isArray(rules) },
    { code: 'values.allowed', passed: !containsForbiddenValue(snapshot, new Set()) },
  ]
  const failedChecks = checks.filter((check) => !check.passed)
  return {
    eligible: failedChecks.length === 0,
    checks,
    failedChecks,
    warnings: collectWarnings(snapshot),
  }
}
