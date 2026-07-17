import type {
  CanonicalKnowledgeDocument,
  KnowledgeFingerprint,
  KnowledgeSealErrorCode,
  KnowledgeSealingInput,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
  SealedKnowledgeSnapshot,
} from '../../types/knowledgeLayer'
import {
  KNOWLEDGE_FINGERPRINT_ALGORITHM,
  KNOWLEDGE_FINGERPRINT_DOMAIN,
  KNOWLEDGE_FINGERPRINT_ENCODING,
  KNOWLEDGE_FINGERPRINT_VERSION,
  fingerprintCanonicalKnowledgeDocument,
} from './knowledgeFingerprint'

const UTC_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const FORBIDDEN_KEYS = new Set<string>([
  'persistedAt',
  'syncState',
  'repository',
  'remoteId',
  'databaseId',
  'insight',
  'insightEngine',
  'llm',
  'ai',
  'notes',
  'note',
  'freeText',
  'email',
  'phone',
  'whatsappNumber',
])

export class KnowledgeSealError extends Error {
  readonly code: KnowledgeSealErrorCode

  constructor(code: KnowledgeSealErrorCode) {
    super(code)
    this.name = 'KnowledgeSealError'
    this.code = code
  }
}

function fail(code: KnowledgeSealErrorCode): never {
  throw new KnowledgeSealError(code)
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }

  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    output[key] = deepClone(child)
  }
  return output as T
}

function assertSafeStructure(value: unknown): void {
  const activeStack = new Set<object>()
  const seen = new WeakSet<object>()

  const walk = (current: unknown): void => {
    if (current === null || current === undefined) {
      fail('KNOWLEDGE_SEAL_INVALID_VALUE')
    }

    const currentType = typeof current
    if (
      currentType === 'bigint' ||
      currentType === 'function' ||
      currentType === 'symbol'
    ) {
      fail('KNOWLEDGE_SEAL_INVALID_VALUE')
    }

    if (currentType === 'number' && !Number.isFinite(current)) {
      fail('KNOWLEDGE_SEAL_INVALID_VALUE')
    }

    if (currentType !== 'object') {
      return
    }

    if (current instanceof Date) {
      fail('KNOWLEDGE_SEAL_INVALID_VALUE')
    }

    const objectCurrent = current as Record<string, unknown>
    if (activeStack.has(objectCurrent)) {
      fail('KNOWLEDGE_SEAL_INVALID_VALUE')
    }

    const proto = Object.getPrototypeOf(objectCurrent)
    if (!Array.isArray(objectCurrent) && proto !== Object.prototype && proto !== null) {
      fail('KNOWLEDGE_SEAL_INVALID_VALUE')
    }

    if (seen.has(objectCurrent)) {
      return
    }

    seen.add(objectCurrent)
    activeStack.add(objectCurrent)

    if (Array.isArray(objectCurrent)) {
      for (const item of objectCurrent) {
        walk(item)
      }
      activeStack.delete(objectCurrent)
      return
    }

    const entries = Object.entries(objectCurrent)
    for (const [key, child] of entries) {
      if (FORBIDDEN_KEYS.has(key)) {
        fail('KNOWLEDGE_SEAL_INVALID_VALUE')
      }
      walk(child)
    }

    activeStack.delete(objectCurrent)
  }

  walk(value)
}

function assertCanonicalDocument(document: CanonicalKnowledgeDocument): void {
  if (typeof document.canonicalizationVersion !== 'string') {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }

  if (typeof document.payload !== 'object' || document.payload === null) {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }

  if (!Array.isArray(document.payload.facts)) {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }

  if (!Array.isArray(document.payload.relationships)) {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }

  if (!Array.isArray(document.payload.evidenceReferences)) {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }

  if (typeof document.payload.identity.knowledgeCollectionId !== 'string') {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }

  if (typeof document.payload.metadata.knowledgeVersion !== 'string') {
    fail('KNOWLEDGE_SEAL_INVALID_DOCUMENT')
  }
}

function assertFingerprintShape(fingerprint: KnowledgeFingerprint): void {
  if (!/^[0-9a-f]{64}$/.test(fingerprint.value)) {
    fail('KNOWLEDGE_SEAL_INVALID_FINGERPRINT')
  }

  if (
    fingerprint.algorithm !== KNOWLEDGE_FINGERPRINT_ALGORITHM ||
    fingerprint.encoding !== KNOWLEDGE_FINGERPRINT_ENCODING ||
    fingerprint.domain !== KNOWLEDGE_FINGERPRINT_DOMAIN ||
    fingerprint.fingerprintVersion !== KNOWLEDGE_FINGERPRINT_VERSION
  ) {
    fail('KNOWLEDGE_SEAL_INVALID_FINGERPRINT')
  }
}

function fingerprintMatches(
  expected: KnowledgeFingerprint,
  actual: KnowledgeFingerprint,
): boolean {
  return (
    expected.algorithm === actual.algorithm &&
    expected.encoding === actual.encoding &&
    expected.domain === actual.domain &&
    expected.fingerprintVersion === actual.fingerprintVersion &&
    expected.canonicalizationVersion === actual.canonicalizationVersion &&
    expected.value === actual.value
  )
}

function normalizeScopeSignature(document: CanonicalKnowledgeDocument): readonly string[] {
  const scopes = document.payload.facts.map((fact) => {
    const scope = fact.scope
    return JSON.stringify({
      kind: scope.kind,
      periodStart: scope.periodStart,
      periodEndExclusive: scope.periodEndExclusive,
      periodBoundary: scope.periodBoundary,
      timezone: scope.timezone,
      usageMode: scope.usageMode,
      currency: scope.currency,
      ...(scope.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: scope.earningPeriodId }),
    })
  })

  return [...new Set(scopes)].sort(compareStrings)
}

function normalizeFactCatalog(document: CanonicalKnowledgeDocument): readonly string[] {
  return [...new Set(document.payload.facts.map((fact) => fact.factType))].sort(compareStrings)
}

export function deriveKnowledgeSnapshotKey(
  document: CanonicalKnowledgeDocument,
): KnowledgeSnapshotKey {
  assertCanonicalDocument(document)

  const payload = document.payload
  const keyMaterial = {
    sourceSnapshotId: payload.sourceSnapshotReferences.snapshotId,
    sourceSnapshotKey: payload.sourceSnapshotReferences.snapshotKey,
    knowledgeVersion: payload.metadata.knowledgeVersion,
    builderVersion: payload.metadata.builderVersion,
    rulesVersion: payload.metadata.rulesVersion,
    projectionVersion: payload.metadata.projectionVersion,
    canonicalizationVersion: document.canonicalizationVersion,
    scopeSignature: normalizeScopeSignature(document),
    factCatalog: normalizeFactCatalog(document),
  }

  const serialized = JSON.stringify(keyMaterial)
  if (serialized.length === 0) {
    fail('KNOWLEDGE_SEAL_INVALID_KEY')
  }

  return (`knowledge-snapshot-key:v1:${encodeURIComponent(serialized)}`) as KnowledgeSnapshotKey
}

function assertRevisionRules(input: KnowledgeSealingInput): void {
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    fail('KNOWLEDGE_SEAL_INVALID_REVISION')
  }

  if (input.revision === 1 && input.supersedesKnowledgeSnapshotId !== undefined) {
    fail('KNOWLEDGE_SEAL_INVALID_SUPERSEDES')
  }

  if (
    input.revision > 1 &&
    (input.supersedesKnowledgeSnapshotId === undefined ||
      input.supersedesKnowledgeSnapshotId.trim().length === 0)
  ) {
    fail('KNOWLEDGE_SEAL_INVALID_SUPERSEDES')
  }
}

function assertSealedAt(value: string): void {
  if (value.trim().length === 0 || !UTC_INSTANT_PATTERN.test(value)) {
    fail('KNOWLEDGE_SEAL_INVALID_TIME')
  }
}

function assertSnapshotKey(
  expected: KnowledgeSnapshotKey,
  provided: KnowledgeSnapshotKey,
): void {
  if (provided.trim().length === 0 || provided !== expected) {
    fail('KNOWLEDGE_SEAL_INVALID_KEY')
  }
}

export async function sealCanonicalKnowledgeDocument(
  input: KnowledgeSealingInput,
): Promise<SealedKnowledgeSnapshot> {
  assertSafeStructure(input)
  assertCanonicalDocument(input.canonicalDocument)
  assertFingerprintShape(input.fingerprint)
  assertRevisionRules(input)
  assertSealedAt(input.sealedAt)

  if (
    input.fingerprint.canonicalizationVersion !==
    input.canonicalDocument.canonicalizationVersion
  ) {
    fail('KNOWLEDGE_SEAL_INCOMPATIBLE_VERSION')
  }

  const expectedSnapshotKey = deriveKnowledgeSnapshotKey(input.canonicalDocument)
  assertSnapshotKey(expectedSnapshotKey, input.knowledgeSnapshotKey)

  const expectedFingerprint = await fingerprintCanonicalKnowledgeDocument(
    input.canonicalDocument,
  )
  if (!fingerprintMatches(input.fingerprint, expectedFingerprint)) {
    fail('KNOWLEDGE_SEAL_FINGERPRINT_MISMATCH')
  }

  const knowledgeSnapshotId = (
    `knowledge-snapshot:${input.fingerprint.fingerprintVersion}:${input.fingerprint.value}`
  ) as KnowledgeSnapshotId

  if (
    input.supersedesKnowledgeSnapshotId !== undefined &&
    input.supersedesKnowledgeSnapshotId === knowledgeSnapshotId
  ) {
    fail('KNOWLEDGE_SEAL_INVALID_SUPERSEDES')
  }

  const canonicalDocument = deepClone(input.canonicalDocument)
  const fingerprint = deepClone(input.fingerprint)

  return {
    identity: {
      knowledgeSnapshotId,
      knowledgeSnapshotKey: input.knowledgeSnapshotKey,
    },
    knowledgeSnapshotId,
    knowledgeSnapshotKey: input.knowledgeSnapshotKey,
    revision: input.revision,
    revisionReasonCode: input.revisionReasonCode,
    status: 'sealed',
    canonicalDocument,
    fingerprint,
    sealedAt: input.sealedAt,
    ...(input.supersedesKnowledgeSnapshotId === undefined
      ? {}
      : { supersedesKnowledgeSnapshotId: input.supersedesKnowledgeSnapshotId }),
    knowledgeVersion: canonicalDocument.payload.metadata.knowledgeVersion,
    knowledgeBuilderVersion: canonicalDocument.payload.metadata.builderVersion,
    knowledgeRulesVersion: canonicalDocument.payload.metadata.rulesVersion,
    knowledgeProjectionVersion: canonicalDocument.payload.metadata.projectionVersion,
    knowledgeCanonicalizationVersion: canonicalDocument.canonicalizationVersion,
    sourceSnapshotReferences: deepClone(canonicalDocument.payload.sourceSnapshotReferences),
    facts: deepClone(canonicalDocument.payload.facts),
    relationships: deepClone(canonicalDocument.payload.relationships),
    evidenceReferences: deepClone(canonicalDocument.payload.evidenceReferences),
    metadata: deepClone(canonicalDocument.payload.metadata),
  }
}
