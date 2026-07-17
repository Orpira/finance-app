import type {
  CanonicalFinancialSnapshotPayloadV1,
  CanonicalSnapshotDocument,
  CanonicalOperationalMetadataV2,
  SealedFinancialSnapshotMetadata,
  SnapshotScope,
} from '../../types/financialSnapshot'

export const SUPPORTED_SNAPSHOT_VERSION = 'financial-snapshot/1.0.0'

export const SNAPSHOT_CANONICALIZATION_VERSION_V1 =
  'financial-snapshot-c14n/1.0.0'
export const SNAPSHOT_CANONICALIZATION_VERSION_V2 =
  'financial-snapshot-c14n/2.0.0'
export const DEFAULT_SNAPSHOT_CANONICALIZATION_VERSION =
  SNAPSHOT_CANONICALIZATION_VERSION_V2

export const SNAPSHOT_FINGERPRINT_DOMAIN_V1 =
  'private-balance:financial-snapshot:fingerprint:v1:'
export const SNAPSHOT_FINGERPRINT_DOMAIN_V2 =
  'private-balance:financial-snapshot:fingerprint:v2:'

export const SNAPSHOT_FINGERPRINT_VERSION_V1 =
  'financial-snapshot-fingerprint/1.0.0'
export const SNAPSHOT_FINGERPRINT_VERSION_V2 =
  'financial-snapshot-fingerprint/2.0.0'

export function isSupportedSnapshotVersion(version: string): boolean {
  return version === SUPPORTED_SNAPSHOT_VERSION
}

export function isCanonicalizationVersionV1(version: string): boolean {
  return version === SNAPSHOT_CANONICALIZATION_VERSION_V1
}

export function isCanonicalizationVersionV2(version: string): boolean {
  return version === SNAPSHOT_CANONICALIZATION_VERSION_V2
}

export function isSupportedCanonicalizationVersion(version: string): boolean {
  return isCanonicalizationVersionV1(version) || isCanonicalizationVersionV2(version)
}

export function fingerprintSpecForCanonicalization(version: string): {
  readonly domain: string
  readonly fingerprintVersion: string
  readonly hashedComponent?: 'material-payload'
} {
  if (isCanonicalizationVersionV1(version)) {
    return {
      domain: SNAPSHOT_FINGERPRINT_DOMAIN_V1,
      fingerprintVersion: SNAPSHOT_FINGERPRINT_VERSION_V1,
    }
  }
  if (isCanonicalizationVersionV2(version)) {
    return {
      domain: SNAPSHOT_FINGERPRINT_DOMAIN_V2,
      fingerprintVersion: SNAPSHOT_FINGERPRINT_VERSION_V2,
      hashedComponent: 'material-payload',
    }
  }
  throw new TypeError('SNAPSHOT_UNSUPPORTED_CANONICALIZATION_VERSION')
}

export function materializeScopeFromCanonicalDocument(
  document: CanonicalSnapshotDocument<unknown>,
): SnapshotScope {
  if (isCanonicalizationVersionV1(document.canonicalizationVersion)) {
    return {
      ...(document.payload as CanonicalFinancialSnapshotPayloadV1<unknown>).scope,
    }
  }

  const operationalMetadata = (document as {
    readonly operationalMetadata: CanonicalOperationalMetadataV2
  }).operationalMetadata
  return {
    ...document.payload.scope,
    asOf: operationalMetadata.sourceScopeAsOf,
  }
}

export function materializeMetadataFromCanonicalDocument(
  document: CanonicalSnapshotDocument<unknown>,
): SealedFinancialSnapshotMetadata {
  if (isCanonicalizationVersionV1(document.canonicalizationVersion)) {
    return {
      ...(document.payload as CanonicalFinancialSnapshotPayloadV1<unknown>).metadata,
    }
  }

  const operationalMetadata = (document as {
    readonly operationalMetadata: CanonicalOperationalMetadataV2
  }).operationalMetadata
  return {
    ...document.payload.metadata,
    generatedAt: operationalMetadata.generatedAt,
  }
}
