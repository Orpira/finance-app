import type {
  CanonicalKnowledgeDocument,
  KnowledgeFingerprint,
  KnowledgeFingerprintErrorCode,
} from '../../types/knowledgeLayer'
import { serializeCanonicalKnowledgeDocument } from './knowledgeCanonicalizer'

export const KNOWLEDGE_FINGERPRINT_ALGORITHM = 'SHA-256' as const
export const KNOWLEDGE_FINGERPRINT_ENCODING = 'hex-lower' as const
export const KNOWLEDGE_FINGERPRINT_DOMAIN =
  'private-balance:knowledge:fingerprint:v1:' as const
export const KNOWLEDGE_FINGERPRINT_VERSION =
  'knowledge-fingerprint/1.0.0' as const

export class KnowledgeFingerprintError extends Error {
  readonly code: KnowledgeFingerprintErrorCode

  constructor(code: KnowledgeFingerprintErrorCode) {
    super(code)
    this.name = 'KnowledgeFingerprintError'
    this.code = code
  }
}

function fail(code: KnowledgeFingerprintErrorCode): never {
  throw new KnowledgeFingerprintError(code)
}

function toLowerHex(buffer: ArrayBuffer): string {
  try {
    return Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    return fail('KNOWLEDGE_FINGERPRINT_ENCODING_FAILED')
  }
}

function assertValidCanonicalDocument(
  document: CanonicalKnowledgeDocument,
): void {
  const payload = document.payload
  if (typeof document.canonicalizationVersion !== 'string') {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (typeof payload !== 'object' || payload === null) {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (typeof payload.metadata.knowledgeVersion !== 'string') {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (typeof payload.metadata.builderVersion !== 'string') {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (typeof payload.metadata.rulesVersion !== 'string') {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (typeof payload.metadata.projectionVersion !== 'string') {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (typeof payload.identity.knowledgeCollectionId !== 'string') {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (!Array.isArray(payload.facts)) {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (!Array.isArray(payload.relationships)) {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
  if (!Array.isArray(payload.evidenceReferences)) {
    fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
}

export function serializeKnowledgeFingerprintPreimage(
  document: CanonicalKnowledgeDocument,
): string {
  assertValidCanonicalDocument(document)

  // Ensure the incoming document is structurally canonicalized first.
  void serializeCanonicalKnowledgeDocument(document)

  const payload = document.payload
  const preimage = {
    canonicalizationVersion: document.canonicalizationVersion,
    knowledgeVersion: payload.metadata.knowledgeVersion,
    knowledgeBuilderVersion: payload.metadata.builderVersion,
    knowledgeRulesVersion: payload.metadata.rulesVersion,
    knowledgeProjectionVersion: payload.metadata.projectionVersion,
    knowledgeIdentity: payload.identity,
    knowledgeFacts: payload.facts,
    knowledgeRelationships: payload.relationships,
    knowledgeEvidence: payload.evidenceReferences,
    knowledgeScope: payload.facts.map((fact) => fact.scope),
    knowledgeMetadataMaterial: payload.metadata,
    canonicalKnowledgeDocument: document,
  }

  try {
    return JSON.stringify(preimage)
  } catch {
    return fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }
}

export async function fingerprintCanonicalKnowledgeDocument(
  document: CanonicalKnowledgeDocument,
): Promise<KnowledgeFingerprint> {
  let serializedPreimage: string
  try {
    serializedPreimage = serializeKnowledgeFingerprintPreimage(document)
  } catch {
    return fail('KNOWLEDGE_FINGERPRINT_INVALID_DOCUMENT')
  }

  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) {
    return fail('KNOWLEDGE_FINGERPRINT_CRYPTO_UNAVAILABLE')
  }

  let encoded: Uint8Array<ArrayBuffer>
  try {
    encoded = new TextEncoder().encode(
      KNOWLEDGE_FINGERPRINT_DOMAIN + serializedPreimage,
    )
  } catch {
    return fail('KNOWLEDGE_FINGERPRINT_ENCODING_FAILED')
  }

  let digest: ArrayBuffer
  try {
    digest = await subtle.digest(KNOWLEDGE_FINGERPRINT_ALGORITHM, encoded)
  } catch {
    return fail('KNOWLEDGE_FINGERPRINT_UNSUPPORTED_ALGORITHM')
  }

  const value = toLowerHex(digest)
  if (!/^[0-9a-f]{64}$/.test(value)) {
    return fail('KNOWLEDGE_FINGERPRINT_ENCODING_FAILED')
  }

  return {
    algorithm: KNOWLEDGE_FINGERPRINT_ALGORITHM,
    encoding: KNOWLEDGE_FINGERPRINT_ENCODING,
    domain: KNOWLEDGE_FINGERPRINT_DOMAIN,
    fingerprintVersion: KNOWLEDGE_FINGERPRINT_VERSION,
    canonicalizationVersion: document.canonicalizationVersion,
    value,
  }
}
