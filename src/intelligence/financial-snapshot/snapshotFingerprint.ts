import type {
  CanonicalSnapshotDocument,
  SnapshotFingerprint,
} from '../../types/financialSnapshot'
import {
  serializeCanonicalSnapshotDocument,
  serializeCanonicalSnapshotValue,
} from './snapshotCanonicalizer'
import { fingerprintSpecForCanonicalization } from './snapshotProtocol'

export const SNAPSHOT_FINGERPRINT_ALGORITHM = 'SHA-256' as const
export const SNAPSHOT_FINGERPRINT_ENCODING = 'hex-lower' as const
export const SNAPSHOT_FINGERPRINT_DOMAIN =
  'private-balance:financial-snapshot:fingerprint:v1:' as const
export const SNAPSHOT_FINGERPRINT_VERSION =
  'financial-snapshot-fingerprint/1.0.0' as const

function serializeFingerprintPreimage(
  document: CanonicalSnapshotDocument<unknown>,
): string {
  const spec = fingerprintSpecForCanonicalization(document.canonicalizationVersion)
  return spec.hashedComponent === 'material-payload'
    ? serializeCanonicalSnapshotValue(document.payload)
    : serializeCanonicalSnapshotDocument(document)
}

export type SnapshotFingerprintErrorCode =
  | 'SNAPSHOT_FINGERPRINT_UNSUPPORTED_ALGORITHM'
  | 'SNAPSHOT_FINGERPRINT_CRYPTO_UNAVAILABLE'
  | 'SNAPSHOT_FINGERPRINT_INVALID_DOCUMENT'
  | 'SNAPSHOT_FINGERPRINT_ENCODING_FAILED'

export class SnapshotFingerprintError extends Error {
  readonly code: SnapshotFingerprintErrorCode

  constructor(code: SnapshotFingerprintErrorCode) {
    super(code)
    this.name = 'SnapshotFingerprintError'
    this.code = code
  }
}

function toLowerHex(buffer: ArrayBuffer): string {
  try {
    return Array.from(new Uint8Array(buffer), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  } catch {
    throw new SnapshotFingerprintError('SNAPSHOT_FINGERPRINT_ENCODING_FAILED')
  }
}

/** Computes the V1 integrity fingerprint without sealing or assigning identity. */
export async function fingerprintCanonicalSnapshotDocument(
  document: CanonicalSnapshotDocument<unknown>,
): Promise<SnapshotFingerprint> {
  let serialized: string
  const spec = fingerprintSpecForCanonicalization(document.canonicalizationVersion)
  try {
    serialized = serializeFingerprintPreimage(document)
  } catch {
    throw new SnapshotFingerprintError('SNAPSHOT_FINGERPRINT_INVALID_DOCUMENT')
  }

  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) {
    throw new SnapshotFingerprintError('SNAPSHOT_FINGERPRINT_CRYPTO_UNAVAILABLE')
  }

  let preimage: Uint8Array<ArrayBuffer>
  try {
    preimage = new TextEncoder().encode(spec.domain + serialized)
  } catch {
    throw new SnapshotFingerprintError('SNAPSHOT_FINGERPRINT_ENCODING_FAILED')
  }

  let digest: ArrayBuffer
  try {
    digest = await subtle.digest(SNAPSHOT_FINGERPRINT_ALGORITHM, preimage)
  } catch {
    throw new SnapshotFingerprintError(
      'SNAPSHOT_FINGERPRINT_UNSUPPORTED_ALGORITHM',
    )
  }

  const value = toLowerHex(digest)
  if (!/^[0-9a-f]{64}$/.test(value)) {
    throw new SnapshotFingerprintError('SNAPSHOT_FINGERPRINT_ENCODING_FAILED')
  }

  return {
    algorithm: SNAPSHOT_FINGERPRINT_ALGORITHM,
    encoding: SNAPSHOT_FINGERPRINT_ENCODING,
    domain: spec.domain,
    fingerprintVersion: spec.fingerprintVersion,
    canonicalizationVersion: document.canonicalizationVersion,
    ...(spec.hashedComponent === undefined
      ? {}
      : { hashedComponent: spec.hashedComponent }),
    value,
  }
}
