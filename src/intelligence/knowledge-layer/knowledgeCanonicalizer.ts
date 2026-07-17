import type {
  CanonicalKnowledgeDocument,
  CanonicalKnowledgeEvidenceReference,
  CanonicalKnowledgeEvidenceType,
  CanonicalKnowledgeFact,
  CanonicalKnowledgePayload,
  CanonicalKnowledgeRelationship,
  KnowledgeCanonicalizationErrorCode,
  KnowledgeCanonicalizationVersion,
  KnowledgeFact,
  KnowledgeRelationship,
  ValidatedKnowledgeCollection,
} from '../../types/knowledgeLayer'

const KNOWLEDGE_CANONICALIZATION_VERSION_V1 =
  'knowledge-c14n/1.0.0' as KnowledgeCanonicalizationVersion

const SUPPORTED_CANONICALIZATION_VERSIONS = new Set<string>([
  KNOWLEDGE_CANONICALIZATION_VERSION_V1,
])

const FORBIDDEN_KEYS = new Set<string>([
  'fingerprint',
  'sealedAt',
  'repository',
  'persistedAt',
  'persistence',
  'shadowMode',
  'promotionPolicy',
  'insightEngine',
  'llm',
  'ai',
  'engineResult',
  'canonicalDocument',
  'operationalMetadata',
  'note',
  'notes',
  'freeText',
  'freeNote',
  'comment',
  'email',
  'phone',
  'whatsappNumber',
  'ownerJid',
  'pin',
  'token',
  'secret',
  'password',
])

export class KnowledgeCanonicalizationError extends Error {
  readonly code: KnowledgeCanonicalizationErrorCode

  constructor(code: KnowledgeCanonicalizationErrorCode) {
    super(code)
    this.name = 'KnowledgeCanonicalizationError'
    this.code = code
  }
}

function fail(code: KnowledgeCanonicalizationErrorCode): never {
  throw new KnowledgeCanonicalizationError(code)
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function compareStringOrNumber(a: string | number, b: string | number): number {
  const aIsNumber = typeof a === 'number'
  const bIsNumber = typeof b === 'number'

  if (aIsNumber && bIsNumber) {
    if (a < b) return -1
    if (a > b) return 1
    return 0
  }
  if (aIsNumber && !bIsNumber) return -1
  if (!aIsNumber && bIsNumber) return 1

  return compareStrings(a as string, b as string)
}

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_VALUE')
  }
  return Object.is(value, -0) ? 0 : value
}

function canonicalizeValue(
  value: unknown,
  ancestors: ReadonlySet<object>,
): unknown {
  if (value === null || value === undefined || value instanceof Date) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_VALUE')
  }

  if (typeof value === 'number') {
    return normalizeNumber(value)
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return value
  }

  if (
    typeof value === 'bigint' ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_VALUE')
  }

  if (typeof value !== 'object') {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_VALUE')
  }

  if (ancestors.has(value)) {
    fail('KNOWLEDGE_CANONICALIZATION_CYCLIC_VALUE')
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item, nextAncestors))
  }

  if (Object.getPrototypeOf(value) !== Object.prototype) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_VALUE')
  }

  const raw = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  const keys = Object.keys(raw).sort(compareStrings)

  for (const key of keys) {
    if (FORBIDDEN_KEYS.has(key)) {
      fail('KNOWLEDGE_CANONICALIZATION_INVALID_VALUE')
    }
    result[key] = canonicalizeValue(raw[key], nextAncestors)
  }

  return result
}

function canonicalString(value: unknown): string {
  return JSON.stringify(canonicalizeValue(value, new Set()))
}

function sortStrings(values: readonly string[]): readonly string[] {
  return [...values].sort(compareStrings)
}

function sortRelationshipValues(
  relationships: readonly CanonicalKnowledgeRelationship[],
): readonly CanonicalKnowledgeRelationship[] {
  return [...relationships].sort((a, b) => {
    const sourceDiff = compareStrings(a.sourceFactId, b.sourceFactId)
    if (sourceDiff !== 0) return sourceDiff

    const relationDiff = compareStrings(a.relationshipType, b.relationshipType)
    if (relationDiff !== 0) return relationDiff

    return compareStrings(a.targetFactId, b.targetFactId)
  })
}

function normalizeRelationship(
  relationship: KnowledgeRelationship,
): CanonicalKnowledgeRelationship {
  return {
    sourceFactId: relationship.fromFactId,
    relationshipType: relationship.relation,
    targetFactId: relationship.toFactId,
  }
}

function extractOrdinal(factId: string): number {
  const lastSeparator = factId.lastIndexOf(':')
  if (lastSeparator < 0) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_FACT')
  }

  const ordinalText = factId.slice(lastSeparator + 1)
  if (!/^\d+$/.test(ordinalText)) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_FACT')
  }

  const ordinal = Number.parseInt(ordinalText, 10)
  if (!Number.isSafeInteger(ordinal) || ordinal < 0) {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_FACT')
  }

  return ordinal
}

function normalizeEvidenceValue(value: string | number): string | number {
  if (typeof value === 'number') {
    return normalizeNumber(value)
  }
  return value
}

function buildEvidenceReferences(
  fact: CanonicalKnowledgeFact,
): readonly CanonicalKnowledgeEvidenceReference[] {
  const evidence = fact.evidence
  const base = {
    factId: fact.factId,
    sourceSnapshotId: evidence.sourceSnapshotId,
    sourceSnapshotKey: evidence.sourceSnapshotKey,
    sourceSnapshotRevision: normalizeNumber(evidence.sourceSnapshotRevision),
    sourceFingerprintValue: evidence.sourceFingerprintValue,
  }

  const references: CanonicalKnowledgeEvidenceReference[] = []

  const pushReference = (
    evidenceType: CanonicalKnowledgeEvidenceType,
    evidenceValue: string | number,
  ): void => {
    references.push({
      ...base,
      evidenceType,
      evidenceValue: normalizeEvidenceValue(evidenceValue),
    })
  }

  for (const value of sortStrings(evidence.sourceAppliedRuleIds)) {
    pushReference('applied-rule-id', value)
  }
  for (const value of [...evidence.sourceRecordIds].sort(compareStringOrNumber)) {
    pushReference('record-id', value)
  }
  for (const value of sortStrings(evidence.sourceContextKinds)) {
    pushReference('context-kind', value)
  }
  for (const value of sortStrings(evidence.coverageCodes)) {
    pushReference('coverage-code', value)
  }
  for (const value of sortStrings(evidence.warningCodes)) {
    pushReference('warning-code', value)
  }
  for (const value of sortStrings(evidence.sourcePaths)) {
    pushReference('source-path', value)
  }

  return references
}

function sortEvidenceReferences(
  references: readonly CanonicalKnowledgeEvidenceReference[],
): readonly CanonicalKnowledgeEvidenceReference[] {
  return [...references].sort((a, b) => {
    const snapshotIdDiff = compareStrings(a.sourceSnapshotId, b.sourceSnapshotId)
    if (snapshotIdDiff !== 0) return snapshotIdDiff

    const snapshotKeyDiff = compareStrings(a.sourceSnapshotKey, b.sourceSnapshotKey)
    if (snapshotKeyDiff !== 0) return snapshotKeyDiff

    const revisionDiff = a.sourceSnapshotRevision - b.sourceSnapshotRevision
    if (revisionDiff !== 0) return revisionDiff

    const fingerprintDiff = compareStrings(a.sourceFingerprintValue, b.sourceFingerprintValue)
    if (fingerprintDiff !== 0) return fingerprintDiff

    const typeDiff = compareStrings(a.evidenceType, b.evidenceType)
    if (typeDiff !== 0) return typeDiff

    const valueDiff = compareStringOrNumber(a.evidenceValue, b.evidenceValue)
    if (valueDiff !== 0) return valueDiff

    return compareStrings(a.factId, b.factId)
  })
}

function canonicalizeFact(fact: KnowledgeFact): CanonicalKnowledgeFact {
  const relationships = sortRelationshipValues(
    fact.relationships.map((relationship) => normalizeRelationship(relationship)),
  )

  const evidence = {
    sourceSnapshotId: fact.evidence.sourceSnapshotId,
    sourceSnapshotKey: fact.evidence.sourceSnapshotKey,
    sourceSnapshotRevision: normalizeNumber(fact.evidence.sourceSnapshotRevision),
    sourceFingerprintValue: fact.evidence.sourceFingerprintValue,
    sourceAppliedRuleIds: sortStrings(fact.evidence.sourceAppliedRuleIds),
    sourceRecordIds: [...fact.evidence.sourceRecordIds]
      .map((value) => normalizeEvidenceValue(value))
      .sort(compareStringOrNumber),
    sourceContextKinds: sortStrings(fact.evidence.sourceContextKinds),
    coverageCodes: sortStrings(fact.evidence.coverageCodes),
    warningCodes: sortStrings(fact.evidence.warningCodes),
    sourcePaths: sortStrings(fact.evidence.sourcePaths),
  }

  return {
    factId: fact.factId,
    factType: fact.factType,
    category: fact.category,
    severity: fact.severity,
    confidence: fact.confidence,
    source: fact.source,
    status: fact.status,
    ordinal: extractOrdinal(fact.factId),
    scope: {
      ...fact.scope,
      ...(fact.scope.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: normalizeNumber(fact.scope.earningPeriodId) }),
    },
    context: {
      ...fact.context,
      ...(fact.context.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: normalizeNumber(fact.context.earningPeriodId) }),
    },
    origin: {
      ...fact.origin,
      sourceSnapshotRevision: normalizeNumber(fact.origin.sourceSnapshotRevision),
    },
    evidence,
    relationships,
  }
}

function sortFacts(facts: readonly CanonicalKnowledgeFact[]): readonly CanonicalKnowledgeFact[] {
  return [...facts].sort((a, b) => {
    const categoryDiff = compareStrings(a.category, b.category)
    if (categoryDiff !== 0) return categoryDiff

    const factTypeDiff = compareStrings(a.factType, b.factType)
    if (factTypeDiff !== 0) return factTypeDiff

    const ordinalDiff = a.ordinal - b.ordinal
    if (ordinalDiff !== 0) return ordinalDiff

    return compareStrings(a.factId, b.factId)
  })
}

function resolveCanonicalizationVersion(
  collection: ValidatedKnowledgeCollection,
): KnowledgeCanonicalizationVersion {
  const unsafeVersion =
    (collection as unknown as { readonly canonicalizationVersion?: unknown })
      .canonicalizationVersion

  if (unsafeVersion === undefined) {
    return KNOWLEDGE_CANONICALIZATION_VERSION_V1
  }

  if (
    typeof unsafeVersion !== 'string' ||
    !SUPPORTED_CANONICALIZATION_VERSIONS.has(unsafeVersion)
  ) {
    fail('KNOWLEDGE_CANONICALIZATION_UNSUPPORTED_VERSION')
  }

  return unsafeVersion as KnowledgeCanonicalizationVersion
}

function buildCanonicalPayload(
  collection: ValidatedKnowledgeCollection,
): CanonicalKnowledgePayload {
  const facts = sortFacts(collection.facts.map((fact) => canonicalizeFact(fact)))
  const relationships = sortRelationshipValues(
    collection.relationships.map((relationship) => normalizeRelationship(relationship)),
  )

  const evidenceReferences = sortEvidenceReferences(
    facts.flatMap((fact) => buildEvidenceReferences(fact)),
  )

  return {
    identity: {
      ...collection.identity,
      sourceSnapshotRevision: normalizeNumber(collection.identity.sourceSnapshotRevision),
    },
    sourceSnapshotReferences: {
      snapshotId: collection.identity.sourceSnapshotId,
      snapshotKey: collection.identity.sourceSnapshotKey,
      snapshotRevision: normalizeNumber(collection.identity.sourceSnapshotRevision),
      sourceFingerprintValue: collection.identity.sourceFingerprintValue,
    },
    versions: {
      ...collection.versions,
    },
    metadata: {
      knowledgeVersion: collection.versions.knowledgeVersion,
      builderVersion: collection.versions.builderVersion,
      rulesVersion: collection.versions.rulesVersion,
      projectionVersion: collection.versions.projectionVersion,
    },
    projection: {
      projectionVersion: collection.versions.projectionVersion,
      collectionState: 'validated',
    },
    auditTrail: {
      appendOnly: true,
      deterministicIdentity: true,
    },
    factCount: normalizeNumber(collection.factCount),
    facts,
    relationships,
    evidenceReferences,
  }
}

export function canonicalizeValidatedKnowledgeCollection(
  collection: ValidatedKnowledgeCollection,
): CanonicalKnowledgeDocument {
  if ((collection as { readonly state?: unknown }).state !== 'validated') {
    fail('KNOWLEDGE_CANONICALIZATION_INVALID_STATE')
  }

  // Preflight fail-closed over the full input graph before projection.
  void canonicalizeValue(collection, new Set())

  const canonicalizationVersion = resolveCanonicalizationVersion(collection)
  const payload = buildCanonicalPayload(collection)

  return canonicalizeValue(
    {
      canonicalizationVersion,
      payload,
    },
    new Set(),
  ) as CanonicalKnowledgeDocument
}

export function serializeCanonicalKnowledgeDocument(
  document: CanonicalKnowledgeDocument,
): string {
  if (!SUPPORTED_CANONICALIZATION_VERSIONS.has(document.canonicalizationVersion)) {
    fail('KNOWLEDGE_CANONICALIZATION_UNSUPPORTED_VERSION')
  }

  return canonicalString(document)
}

export { KNOWLEDGE_CANONICALIZATION_VERSION_V1 }
