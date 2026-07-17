import type {
  KnowledgeFactCategory,
  KnowledgeFactType,
  SealedKnowledgeSnapshot,
} from '../../types/knowledgeLayer'

export type KnowledgePromotionAssessmentStatus = 'eligible' | 'ineligible'

export type KnowledgePromotionCheckCode =
  | 'snapshot.status_sealed'
  | 'snapshot.identity_valid'
  | 'snapshot.id_valid'
  | 'snapshot.key_valid'
  | 'snapshot.revision_valid'
  | 'snapshot.supersedes_consistent'
  | 'fingerprint.present'
  | 'fingerprint.algorithm_supported'
  | 'fingerprint.encoding_supported'
  | 'fingerprint.domain_supported'
  | 'fingerprint.version_supported'
  | 'canonicalization.version_supported'
  | 'knowledge.version_supported'
  | 'builder.version_supported'
  | 'rules.version_supported'
  | 'projection.version_supported'
  | 'canonical_document.present'
  | 'facts.present'
  | 'facts.count_consistent'
  | 'facts.ids_unique'
  | 'facts.types_allowed'
  | 'facts.categories_consistent'
  | 'relationships.valid'
  | 'evidence.valid'
  | 'metadata.present'
  | 'source_snapshot.id_present'
  | 'source_snapshot.key_present'
  | 'source_snapshot.revision_valid'
  | 'source_snapshot.fingerprint_present'
  | 'snapshot.state_consistent'
  | 'contract.serializable'
  | 'values.allowed'

export interface KnowledgePromotionCheck {
  readonly code: KnowledgePromotionCheckCode
  readonly passed: boolean
}

export interface KnowledgePromotionWarning {
  readonly code:
    | 'policy.external_context_not_evaluated'
    | 'policy.fingerprint_not_recomputed'
}

export interface KnowledgePromotionFailure {
  readonly code: KnowledgePromotionCheckCode
}

export interface KnowledgePromotionAssessment {
  readonly status: KnowledgePromotionAssessmentStatus
  readonly eligible: boolean
  readonly checks: readonly KnowledgePromotionCheck[]
  readonly failedChecks: readonly KnowledgePromotionFailure[]
  readonly warnings: readonly KnowledgePromotionWarning[]
}

export type KnowledgePromotionPolicyErrorCode =
  | 'KNOWLEDGE_PROMOTION_INVALID_CONTRACT'
  | 'KNOWLEDGE_PROMOTION_INVALID_VALUE'
  | 'KNOWLEDGE_PROMOTION_UNSUPPORTED_VERSION'

export class KnowledgePromotionPolicyError extends Error {
  readonly code: KnowledgePromotionPolicyErrorCode

  constructor(code: KnowledgePromotionPolicyErrorCode) {
    super(code)
    this.name = 'KnowledgePromotionPolicyError'
    this.code = code
  }
}

const KNOWLEDGE_VERSION = 'knowledge/1.0.0'
const BUILDER_VERSION = 'knowledge-builder/1.0.0'
const RULES_VERSION = 'knowledge-rules/1.0.0'
const PROJECTION_VERSION = 'knowledge-projection/1.0.0'
const CANONICALIZATION_VERSION = 'knowledge-c14n/1.0.0'
const FINGERPRINT_VERSION = 'knowledge-fingerprint/1.0.0'
const FINGERPRINT_DOMAIN = 'private-balance:knowledge:fingerprint:v1:'
const FINGERPRINT_ALGORITHM = 'SHA-256'
const FINGERPRINT_ENCODING = 'hex-lower'
const KNOWLEDGE_SNAPSHOT_ID_PATTERN =
  /^knowledge-snapshot:knowledge-fingerprint\/1\.0\.0:[0-9a-f]{64}$/
const KNOWLEDGE_SNAPSHOT_KEY_PREFIX = 'knowledge-snapshot-key:v1:'

const FACT_TYPE_CATEGORY: Record<KnowledgeFactType, KnowledgeFactCategory> = {
  'income.present': 'income',
  'income.absent': 'income',
  'income.increased': 'income',
  'income.decreased': 'income',
  'expense.present': 'expense',
  'expense.absent': 'expense',
  'expense.increased': 'expense',
  'expense.decreased': 'expense',
  'adjustment.present': 'adjustment',
  'adjustment.absent': 'adjustment',
  'balance.positive': 'balance',
  'balance.negative': 'balance',
  'balance.neutral': 'balance',
  'cashflow.positive': 'cashflow',
  'cashflow.negative': 'cashflow',
  'cashflow.neutral': 'cashflow',
  'period.empty': 'period',
  'period.non_empty': 'period',
  'season.started': 'season',
  'season.completed': 'season',
  'saving.high': 'saving',
  'saving.low': 'saving',
  'recurring.expense.detected': 'recurrence',
  'income.volatile': 'volatility',
  'expense.volatile': 'volatility',
  'cashflow.stable': 'cashflow',
  'cashflow.unstable': 'cashflow',
}

const RELATIONSHIP_TYPES = new Set([
  'derived-from',
  'supports',
  'correlates-with',
])

const EVIDENCE_TYPES = new Set([
  'applied-rule-id',
  'record-id',
  'context-kind',
  'coverage-code',
  'warning-code',
  'source-path',
])

function fail(code: KnowledgePromotionPolicyErrorCode): never {
  throw new KnowledgePromotionPolicyError(code)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function nonEmptyString(value: unknown): value is string {
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
  if (!isPlainObject(first) || !isPlainObject(second)) return false
  const firstKeys = Object.keys(first).sort()
  const secondKeys = Object.keys(second).sort()
  return firstKeys.length === secondKeys.length &&
    firstKeys.every((key, index) =>
      key === secondKeys[index] && structuralEqual(first[key], second[key]),
    )
}

function containsInvalidValue(
  value: unknown,
  ancestors: ReadonlySet<object>,
): boolean {
  if (value === null) return true
  if (value === undefined) return true
  if (typeof value === 'number') return !Number.isFinite(value)
  if (typeof value === 'string' || typeof value === 'boolean') return false
  if (
    typeof value === 'bigint' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    return true
  }
  if (typeof value !== 'object' || value instanceof Date || ancestors.has(value)) {
    return true
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  if (Array.isArray(value)) {
    return value.some((item) => containsInvalidValue(item, nextAncestors))
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return true
  }

  return Object.values(value).some((item) => containsInvalidValue(item, nextAncestors))
}

function isSerializable(value: unknown): boolean {
  try {
    JSON.stringify(value)
    return true
  } catch {
    return false
  }
}

function factIds(snapshot: Record<string, unknown>): readonly string[] {
  const facts = Array.isArray(snapshot.facts) ? snapshot.facts : []
  return facts
    .map((fact) => (isPlainObject(fact) ? fact.factId : undefined))
    .filter(nonEmptyString)
}

function canonicalPayload(snapshot: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!isPlainObject(snapshot.canonicalDocument)) return undefined
  return isPlainObject(snapshot.canonicalDocument.payload)
    ? snapshot.canonicalDocument.payload
    : undefined
}

function hasValidFingerprint(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.fingerprint) &&
    typeof snapshot.fingerprint.value === 'string' &&
    /^[0-9a-f]{64}$/.test(snapshot.fingerprint.value)
}

function identityValid(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.identity) &&
    snapshot.identity.knowledgeSnapshotId === snapshot.knowledgeSnapshotId &&
    snapshot.identity.knowledgeSnapshotKey === snapshot.knowledgeSnapshotKey
}

function revisionValid(snapshot: Record<string, unknown>): boolean {
  return safeInteger(snapshot.revision, 1) && nonEmptyString(snapshot.revisionReasonCode)
}

function supersedesConsistent(snapshot: Record<string, unknown>): boolean {
  if (!safeInteger(snapshot.revision, 1)) return false
  if (snapshot.revision === 1) {
    return snapshot.supersedesKnowledgeSnapshotId === undefined
  }
  return nonEmptyString(snapshot.supersedesKnowledgeSnapshotId) &&
    snapshot.supersedesKnowledgeSnapshotId !== snapshot.knowledgeSnapshotId
}

function metadataPresent(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.metadata) &&
    snapshot.metadata.knowledgeVersion === KNOWLEDGE_VERSION &&
    snapshot.metadata.builderVersion === BUILDER_VERSION &&
    snapshot.metadata.rulesVersion === RULES_VERSION &&
    snapshot.metadata.projectionVersion === PROJECTION_VERSION
}

function validRelationships(snapshot: Record<string, unknown>): boolean {
  if (!Array.isArray(snapshot.relationships)) return false
  const ids = new Set(factIds(snapshot))
  return snapshot.relationships.every((relationship) =>
    isPlainObject(relationship) &&
    nonEmptyString(relationship.sourceFactId) &&
    nonEmptyString(relationship.targetFactId) &&
    RELATIONSHIP_TYPES.has(String(relationship.relationshipType)) &&
    ids.has(relationship.sourceFactId) &&
    ids.has(relationship.targetFactId),
  )
}

function validFactEvidence(fact: Record<string, unknown>): boolean {
  if (!isPlainObject(fact.evidence)) return false
  const evidence = fact.evidence
  return nonEmptyString(evidence.sourceSnapshotId) &&
    nonEmptyString(evidence.sourceSnapshotKey) &&
    safeInteger(evidence.sourceSnapshotRevision, 1) &&
    nonEmptyString(evidence.sourceFingerprintValue) &&
    Array.isArray(evidence.sourceAppliedRuleIds) && evidence.sourceAppliedRuleIds.every(nonEmptyString) &&
    Array.isArray(evidence.sourceRecordIds) && evidence.sourceRecordIds.every((value) =>
      (typeof value === 'string' && value.length > 0) ||
      (typeof value === 'number' && Number.isFinite(value)),
    ) &&
    Array.isArray(evidence.sourceContextKinds) && evidence.sourceContextKinds.every(nonEmptyString) &&
    Array.isArray(evidence.coverageCodes) && evidence.coverageCodes.every(nonEmptyString) &&
    Array.isArray(evidence.warningCodes) && evidence.warningCodes.every(nonEmptyString) &&
    Array.isArray(evidence.sourcePaths) && evidence.sourcePaths.every(nonEmptyString)
}

function validEvidenceReferences(snapshot: Record<string, unknown>): boolean {
  if (!Array.isArray(snapshot.evidenceReferences)) return false
  const ids = new Set(factIds(snapshot))
  return snapshot.evidenceReferences.every((reference) =>
    isPlainObject(reference) &&
    nonEmptyString(reference.factId) &&
    ids.has(reference.factId) &&
    nonEmptyString(reference.sourceSnapshotId) &&
    nonEmptyString(reference.sourceSnapshotKey) &&
    safeInteger(reference.sourceSnapshotRevision, 1) &&
    nonEmptyString(reference.sourceFingerprintValue) &&
    EVIDENCE_TYPES.has(String(reference.evidenceType)) &&
    ((typeof reference.evidenceValue === 'string' && reference.evidenceValue.length > 0) ||
      (typeof reference.evidenceValue === 'number' && Number.isFinite(reference.evidenceValue))),
  )
}

function evidenceValid(snapshot: Record<string, unknown>): boolean {
  return Array.isArray(snapshot.facts) &&
    snapshot.facts.every((fact) => isPlainObject(fact) && validFactEvidence(fact)) &&
    validEvidenceReferences(snapshot)
}

function factsPresent(snapshot: Record<string, unknown>): boolean {
  return Array.isArray(snapshot.facts) && snapshot.facts.length > 0
}

function factsCountConsistent(snapshot: Record<string, unknown>): boolean {
  const payload = canonicalPayload(snapshot)
  return Array.isArray(snapshot.facts) &&
    isPlainObject(payload) &&
    Array.isArray(payload.facts) &&
    safeInteger(snapshot.revision, 1) &&
    safeInteger(payload.factCount, 0) &&
    snapshot.facts.length === payload.factCount &&
    payload.facts.length === payload.factCount
}

function factIdsUnique(snapshot: Record<string, unknown>): boolean {
  if (!Array.isArray(snapshot.facts)) return false
  const ids = factIds(snapshot)
  return ids.length === snapshot.facts.length && ids.length === new Set(ids).size
}

function factTypesAllowed(snapshot: Record<string, unknown>): boolean {
  return Array.isArray(snapshot.facts) && snapshot.facts.every((fact) =>
    isPlainObject(fact) && typeof fact.factType === 'string' && fact.factType in FACT_TYPE_CATEGORY,
  )
}

function factCategoriesConsistent(snapshot: Record<string, unknown>): boolean {
  return Array.isArray(snapshot.facts) && snapshot.facts.every((fact) =>
    isPlainObject(fact) &&
    typeof fact.factType === 'string' &&
    fact.factType in FACT_TYPE_CATEGORY &&
    fact.category === FACT_TYPE_CATEGORY[fact.factType as KnowledgeFactType],
  )
}

function sourceSnapshotIdPresent(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.sourceSnapshotReferences) &&
    nonEmptyString(snapshot.sourceSnapshotReferences.snapshotId)
}

function sourceSnapshotKeyPresent(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.sourceSnapshotReferences) &&
    nonEmptyString(snapshot.sourceSnapshotReferences.snapshotKey)
}

function sourceSnapshotRevisionValid(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.sourceSnapshotReferences) &&
    safeInteger(snapshot.sourceSnapshotReferences.snapshotRevision, 1)
}

function sourceFingerprintPresent(snapshot: Record<string, unknown>): boolean {
  return isPlainObject(snapshot.sourceSnapshotReferences) &&
    nonEmptyString(snapshot.sourceSnapshotReferences.sourceFingerprintValue)
}

function stateConsistent(snapshot: Record<string, unknown>): boolean {
  const payload = canonicalPayload(snapshot)
  if (!isPlainObject(payload) || !isPlainObject(payload.metadata)) return false
  const identity = isPlainObject(snapshot.identity) ? snapshot.identity : undefined
  const canonicalDocument = isPlainObject(snapshot.canonicalDocument)
    ? snapshot.canonicalDocument
    : undefined
  const fingerprint = isPlainObject(snapshot.fingerprint)
    ? snapshot.fingerprint
    : undefined

  return snapshot.knowledgeSnapshotId === identity?.knowledgeSnapshotId &&
    snapshot.knowledgeSnapshotKey === identity?.knowledgeSnapshotKey &&
    snapshot.knowledgeVersion === payload.metadata.knowledgeVersion &&
    snapshot.knowledgeBuilderVersion === payload.metadata.builderVersion &&
    snapshot.knowledgeRulesVersion === payload.metadata.rulesVersion &&
    snapshot.knowledgeProjectionVersion === payload.metadata.projectionVersion &&
    snapshot.knowledgeCanonicalizationVersion === canonicalDocument?.canonicalizationVersion &&
    snapshot.knowledgeCanonicalizationVersion === fingerprint?.canonicalizationVersion &&
    structuralEqual(snapshot.metadata, payload.metadata) &&
    structuralEqual(snapshot.sourceSnapshotReferences, payload.sourceSnapshotReferences) &&
    structuralEqual(snapshot.facts, payload.facts) &&
    structuralEqual(snapshot.relationships, payload.relationships) &&
    structuralEqual(snapshot.evidenceReferences, payload.evidenceReferences)
}

function buildChecks(snapshot: Record<string, unknown>): readonly KnowledgePromotionCheck[] {
  const fingerprint = isPlainObject(snapshot.fingerprint)
    ? snapshot.fingerprint
    : undefined
  const canonicalDocument = isPlainObject(snapshot.canonicalDocument)
    ? snapshot.canonicalDocument
    : undefined

  return [
    { code: 'snapshot.status_sealed', passed: snapshot.status === 'sealed' },
    { code: 'snapshot.identity_valid', passed: identityValid(snapshot) },
    {
      code: 'snapshot.id_valid',
      passed: typeof snapshot.knowledgeSnapshotId === 'string' &&
        KNOWLEDGE_SNAPSHOT_ID_PATTERN.test(snapshot.knowledgeSnapshotId) &&
        snapshot.knowledgeSnapshotId ===
          `knowledge-snapshot:${fingerprint?.fingerprintVersion}:${fingerprint?.value}`,
    },
    {
      code: 'snapshot.key_valid',
      passed: typeof snapshot.knowledgeSnapshotKey === 'string' &&
        snapshot.knowledgeSnapshotKey.startsWith(KNOWLEDGE_SNAPSHOT_KEY_PREFIX),
    },
    { code: 'snapshot.revision_valid', passed: revisionValid(snapshot) },
    { code: 'snapshot.supersedes_consistent', passed: supersedesConsistent(snapshot) },
    { code: 'fingerprint.present', passed: hasValidFingerprint(snapshot) },
    {
      code: 'fingerprint.algorithm_supported',
      passed: fingerprint?.algorithm === FINGERPRINT_ALGORITHM,
    },
    {
      code: 'fingerprint.encoding_supported',
      passed: fingerprint?.encoding === FINGERPRINT_ENCODING,
    },
    {
      code: 'fingerprint.domain_supported',
      passed: fingerprint?.domain === FINGERPRINT_DOMAIN,
    },
    {
      code: 'fingerprint.version_supported',
      passed: fingerprint?.fingerprintVersion === FINGERPRINT_VERSION,
    },
    {
      code: 'canonicalization.version_supported',
      passed: snapshot.knowledgeCanonicalizationVersion === CANONICALIZATION_VERSION &&
        canonicalDocument?.canonicalizationVersion === CANONICALIZATION_VERSION &&
        fingerprint?.canonicalizationVersion === CANONICALIZATION_VERSION,
    },
    {
      code: 'knowledge.version_supported',
      passed: snapshot.knowledgeVersion === KNOWLEDGE_VERSION,
    },
    {
      code: 'builder.version_supported',
      passed: snapshot.knowledgeBuilderVersion === BUILDER_VERSION,
    },
    {
      code: 'rules.version_supported',
      passed: snapshot.knowledgeRulesVersion === RULES_VERSION,
    },
    {
      code: 'projection.version_supported',
      passed: snapshot.knowledgeProjectionVersion === PROJECTION_VERSION,
    },
    {
      code: 'canonical_document.present',
      passed: isPlainObject(snapshot.canonicalDocument) && isPlainObject(canonicalPayload(snapshot)),
    },
    { code: 'facts.present', passed: factsPresent(snapshot) },
    { code: 'facts.count_consistent', passed: factsCountConsistent(snapshot) },
    { code: 'facts.ids_unique', passed: factIdsUnique(snapshot) },
    { code: 'facts.types_allowed', passed: factTypesAllowed(snapshot) },
    { code: 'facts.categories_consistent', passed: factCategoriesConsistent(snapshot) },
    { code: 'relationships.valid', passed: validRelationships(snapshot) },
    { code: 'evidence.valid', passed: evidenceValid(snapshot) },
    { code: 'metadata.present', passed: metadataPresent(snapshot) },
    { code: 'source_snapshot.id_present', passed: sourceSnapshotIdPresent(snapshot) },
    { code: 'source_snapshot.key_present', passed: sourceSnapshotKeyPresent(snapshot) },
    { code: 'source_snapshot.revision_valid', passed: sourceSnapshotRevisionValid(snapshot) },
    { code: 'source_snapshot.fingerprint_present', passed: sourceFingerprintPresent(snapshot) },
    { code: 'snapshot.state_consistent', passed: stateConsistent(snapshot) },
    { code: 'contract.serializable', passed: isSerializable(snapshot) },
    { code: 'values.allowed', passed: !containsInvalidValue(snapshot, new Set()) },
  ]
}

function warnings(): readonly KnowledgePromotionWarning[] {
  return [
    { code: 'policy.external_context_not_evaluated' },
    { code: 'policy.fingerprint_not_recomputed' },
  ]
}

export function assessKnowledgeSnapshotPromotion(
  snapshot: SealedKnowledgeSnapshot,
): KnowledgePromotionAssessment {
  if (!isPlainObject(snapshot)) {
    fail('KNOWLEDGE_PROMOTION_INVALID_CONTRACT')
  }
  if (Array.isArray(snapshot)) {
    fail('KNOWLEDGE_PROMOTION_INVALID_VALUE')
  }

  const checks = buildChecks(snapshot)
  const failedChecks = checks
    .filter((check) => !check.passed)
    .map((check) => ({ code: check.code }))

  return {
    status: failedChecks.length === 0 ? 'eligible' : 'ineligible',
    eligible: failedChecks.length === 0,
    checks,
    failedChecks,
    warnings: warnings(),
  }
}