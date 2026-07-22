import {
  isSupportedCanonicalizationVersion,
  isSupportedSnapshotVersion,
} from '../intelligence/financial-snapshot/snapshotProtocol'
import {
  KnowledgeBuilderError,
  buildKnowledgeCollectionFromSnapshot,
} from '../intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  KnowledgeValidationError,
  validateKnowledgeCollection,
} from '../intelligence/knowledge-layer/knowledgeCollectionValidator'
import type {
  SnapshotKnowledgeIntegration,
  SnapshotKnowledgeIntegrationDependencies,
  SnapshotKnowledgeLayerEngineResult,
  SnapshotKnowledgeLayerPort,
  SnapshotKnowledgeLayerSnapshot,
} from './snapshotKnowledgeIntegrationInterfaces'
import type {
  SnapshotKnowledgeIntegrationFailure,
  SnapshotKnowledgeIntegrationFailureCode,
  SnapshotKnowledgeIntegrationRequest,
  SnapshotKnowledgeIntegrationResult,
  SnapshotKnowledgeIntegrationSuccess,
  SnapshotKnowledgeTraceability,
} from './snapshotKnowledgeIntegrationResult'
import type {
  KnowledgeCollectionVersions,
  ValidatedKnowledgeCollection,
} from '../types/knowledgeLayer'

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    result[key] = deepClone(item)
  }

  return result as T
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function hasKnowledgeLayerPortShape(value: unknown): value is SnapshotKnowledgeLayerPort {
  return isRecord(value) && typeof value.buildValidatedCollection === 'function'
}

function hasVersionsShape(value: unknown): value is KnowledgeCollectionVersions {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.knowledgeVersion) &&
    isNonEmptyString(value.builderVersion) &&
    isNonEmptyString(value.rulesVersion) &&
    isNonEmptyString(value.projectionVersion)
  )
}

function hasEngineResultShape(value: unknown): value is SnapshotKnowledgeLayerEngineResult {
  if (!isRecord(value)) {
    return false
  }

  if (!isRecord(value.balanceReport)) {
    return false
  }

  return (
    typeof value.balanceReport.hasData === 'boolean' &&
    isFiniteNumber(value.balanceReport.generalBalance) &&
    isFiniteNumber(value.balanceReport.netProfit) &&
    isSafeNonNegativeInteger(value.incomeCount) &&
    isSafeNonNegativeInteger(value.expenseCount) &&
    isSafeNonNegativeInteger(value.adjustmentCount)
  )
}

function hasSnapshotShape(value: unknown): value is SnapshotKnowledgeLayerSnapshot {
  if (!isRecord(value)) {
    return false
  }

  if (value.status !== 'sealed') {
    return false
  }

  if (!isRecord(value.identity)) {
    return false
  }

  if (
    !isNonEmptyString(value.identity.snapshotId) ||
    !isNonEmptyString(value.identity.snapshotKey)
  ) {
    return false
  }

  if (!isRecord(value.revision) || !isSafeNonNegativeInteger(value.revision.revision)) {
    return false
  }

  if (!isRecord(value.fingerprint) || !isNonEmptyString(value.fingerprint.value)) {
    return false
  }

  if (!isNonEmptyString(value.snapshotVersion)) {
    return false
  }

  if (!isSupportedSnapshotVersion(value.snapshotVersion)) {
    return false
  }

  if (!isNonEmptyString(value.canonicalizationVersion)) {
    return false
  }

  if (!isSupportedCanonicalizationVersion(value.canonicalizationVersion)) {
    return false
  }

  if (!isRecord(value.scope)) {
    return false
  }

  if (
    value.scope.kind !== 'monthly' ||
    value.scope.periodBoundary !== '[start,end)' ||
    !isNonEmptyString(value.scope.periodStart) ||
    !isNonEmptyString(value.scope.periodEndExclusive) ||
    !isNonEmptyString(value.scope.timezone) ||
    !isNonEmptyString(value.scope.usageMode) ||
    !isNonEmptyString(value.scope.currency)
  ) {
    return false
  }

  if (!isRecord(value.canonicalDocument) || !isRecord(value.canonicalDocument.payload)) {
    return false
  }

  if (!hasEngineResultShape(value.canonicalDocument.payload.engineResult)) {
    return false
  }

  if (!isRecord(value.evidence)) {
    return false
  }

  if (!Array.isArray(value.evidence.records) || !Array.isArray(value.evidence.context)) {
    return false
  }

  if (!Array.isArray(value.appliedRules)) {
    return false
  }

  return true
}

function hasValidatedCollectionShape(
  collection: unknown,
): collection is ValidatedKnowledgeCollection {
  if (!isRecord(collection)) {
    return false
  }

  if (collection.state !== 'validated') {
    return false
  }

  if (!isRecord(collection.identity)) {
    return false
  }

  if (
    !isNonEmptyString(collection.identity.knowledgeCollectionId) ||
    !isNonEmptyString(collection.identity.sourceSnapshotId) ||
    !isNonEmptyString(collection.identity.sourceSnapshotKey) ||
    !isSafeNonNegativeInteger(collection.identity.sourceSnapshotRevision) ||
    !isNonEmptyString(collection.identity.sourceFingerprintValue)
  ) {
    return false
  }

  if (!hasVersionsShape(collection.versions)) {
    return false
  }

  if (!Array.isArray(collection.facts) || !Array.isArray(collection.relationships)) {
    return false
  }

  if (!isSafeNonNegativeInteger(collection.factCount)) {
    return false
  }

  if (collection.factCount !== collection.facts.length) {
    return false
  }

  if (!isRecord(collection.validation) || collection.validation.status !== 'valid') {
    return false
  }

  return true
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !isNonEmptyString(error.code)) {
    return undefined
  }

  return error.code
}

function buildFailure(input: {
  readonly integrationId: string | null
  readonly code: SnapshotKnowledgeIntegrationFailureCode
  readonly message: string
  readonly causeCode?: string
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}): SnapshotKnowledgeIntegrationFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    integrationId: input.integrationId,
    code: input.code,
    message: input.message,
    ...(input.causeCode === undefined ? {} : { causeCode: input.causeCode }),
    ...(input.details === undefined ? {} : { details: input.details }),
  }
}

function mapSnapshotBoundaryFailure(
  request: SnapshotKnowledgeIntegrationRequest,
): SnapshotKnowledgeIntegrationFailure | null {
  const snapshot = request.snapshot as unknown

  if (!isRecord(snapshot)) {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_INVALID_SNAPSHOT',
      message: 'snapshot must be a non-null object',
    })
  }

  if (snapshot.status !== 'sealed') {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_INVALID_SNAPSHOT',
      message: 'snapshot status must be sealed',
    })
  }

  if (!isNonEmptyString(snapshot.snapshotVersion)) {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_INVALID_SNAPSHOT',
      message: 'snapshotVersion is required',
    })
  }

  if (!isSupportedSnapshotVersion(snapshot.snapshotVersion)) {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_SNAPSHOT_VERSION_INCOMPATIBLE',
      message: 'snapshot version is not supported',
      details: {
        snapshotVersion: snapshot.snapshotVersion,
      },
    })
  }

  if (!isNonEmptyString(snapshot.canonicalizationVersion)) {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_INVALID_SNAPSHOT',
      message: 'snapshot canonicalizationVersion is required',
    })
  }

  if (!isSupportedCanonicalizationVersion(snapshot.canonicalizationVersion)) {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_PROTOCOL_UNSUPPORTED',
      message: 'snapshot protocol is not supported',
      details: {
        canonicalizationVersion: snapshot.canonicalizationVersion,
      },
    })
  }

  if (!isRecord(snapshot.scope) || snapshot.scope.kind !== 'monthly') {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_PROTOCOL_UNSUPPORTED',
      message: 'snapshot scope protocol is not supported',
    })
  }

  if (snapshot.scope.periodBoundary !== '[start,end)') {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_PROTOCOL_UNSUPPORTED',
      message: 'snapshot period boundary protocol is not supported',
    })
  }

  if (!hasSnapshotShape(snapshot)) {
    return buildFailure({
      integrationId: request.integrationId,
      code: 'INTEGRATION_INVALID_SNAPSHOT',
      message: 'snapshot is structurally invalid for knowledge layer boundary',
    })
  }

  return null
}

function buildTraceability(input: {
  readonly integrationId: string
  readonly snapshot: SnapshotKnowledgeLayerSnapshot
  readonly collection: ValidatedKnowledgeCollection
}): SnapshotKnowledgeTraceability {
  return {
    integrationId: input.integrationId,
    snapshot: {
      snapshotId: input.snapshot.identity.snapshotId,
      snapshotKey: input.snapshot.identity.snapshotKey,
      snapshotRevision: input.snapshot.revision.revision,
      snapshotVersion: input.snapshot.snapshotVersion,
      canonicalizationVersion: input.snapshot.canonicalizationVersion,
    },
    knowledgeCollection: {
      knowledgeCollectionId: input.collection.identity.knowledgeCollectionId,
      versions: deepClone(input.collection.versions),
      state: 'validated',
    },
    relation: {
      sourceSnapshotIdMatches: true,
      sourceSnapshotKeyMatches: true,
      sourceSnapshotRevisionMatches: true,
      sourceFingerprintMatches: true,
    },
  }
}

function createDefaultKnowledgeLayerPort(): SnapshotKnowledgeLayerPort {
  return {
    buildValidatedCollection(input) {
      const draft = buildKnowledgeCollectionFromSnapshot({
        snapshot: deepClone(input.snapshot),
        knowledgeVersion: input.versions.knowledgeVersion,
        builderVersion: input.versions.builderVersion,
        rulesVersion: input.versions.rulesVersion,
        projectionVersion: input.versions.projectionVersion,
      })

      return validateKnowledgeCollection(draft)
    },
  }
}

function validateRequest(
  request: SnapshotKnowledgeIntegrationRequest | null | undefined,
):
  | { readonly ok: true; readonly value: SnapshotKnowledgeIntegrationRequest }
  | { readonly ok: false; readonly failure: SnapshotKnowledgeIntegrationFailure } {
  if (!isRecord(request)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: null,
        code: 'INTEGRATION_INVALID_REQUEST',
        message: 'integration request must be a non-null object',
      }),
    }
  }

  if (!isNonEmptyString(request.integrationId)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: null,
        code: 'INTEGRATION_INVALID_REQUEST',
        message: 'integrationId is required',
      }),
    }
  }

  if (!hasVersionsShape(request.versions)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: request.integrationId,
        code: 'INTEGRATION_INVALID_REQUEST',
        message: 'knowledge versions are invalid',
      }),
    }
  }

  return {
    ok: true,
    value: request,
  }
}

function hasTraceabilityConsistency(input: {
  readonly snapshot: SnapshotKnowledgeLayerSnapshot
  readonly collection: ValidatedKnowledgeCollection
  readonly versions: KnowledgeCollectionVersions
}): boolean {
  return (
    input.collection.identity.sourceSnapshotId ===
      input.snapshot.identity.snapshotId &&
    input.collection.identity.sourceSnapshotKey ===
      input.snapshot.identity.snapshotKey &&
    input.collection.identity.sourceSnapshotRevision ===
      input.snapshot.revision.revision &&
    input.collection.identity.sourceFingerprintValue ===
      input.snapshot.fingerprint.value &&
    input.collection.versions.knowledgeVersion ===
      input.versions.knowledgeVersion &&
    input.collection.versions.builderVersion === input.versions.builderVersion &&
    input.collection.versions.rulesVersion === input.versions.rulesVersion &&
    input.collection.versions.projectionVersion ===
      input.versions.projectionVersion
  )
}

export function createSnapshotKnowledgeIntegration(
  dependencies: SnapshotKnowledgeIntegrationDependencies,
): SnapshotKnowledgeIntegration {
  const knowledgeLayer = hasKnowledgeLayerPortShape(dependencies.knowledgeLayer)
    ? dependencies.knowledgeLayer
    : null

  return {
    integrate(
      request: SnapshotKnowledgeIntegrationRequest | null | undefined,
    ): SnapshotKnowledgeIntegrationResult {
      const validatedRequest = validateRequest(request)
      if (!validatedRequest.ok) {
        return validatedRequest.failure
      }

      const boundaryFailure = mapSnapshotBoundaryFailure(validatedRequest.value)
      if (boundaryFailure !== null) {
        return boundaryFailure
      }

      if (knowledgeLayer === null) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'INTEGRATION_MISSING_DEPENDENCY',
          message: 'knowledge layer dependency is required',
        })
      }

      const safeSnapshot = deepClone(
        validatedRequest.value.snapshot,
      ) as SnapshotKnowledgeLayerSnapshot

      let rawCollection: unknown
      try {
        rawCollection = knowledgeLayer.buildValidatedCollection({
          snapshot: safeSnapshot,
          versions: deepClone(validatedRequest.value.versions),
        })
      } catch (error) {
        const causeCode = readErrorCode(error)
        const isControlledError =
          error instanceof KnowledgeBuilderError ||
          error instanceof KnowledgeValidationError ||
          causeCode !== undefined

        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'INTEGRATION_KNOWLEDGE_LAYER_FAILURE',
          message: isControlledError
            ? 'knowledge layer rejected snapshot integration input'
            : 'knowledge layer execution failed during snapshot integration',
          ...(causeCode === undefined ? {} : { causeCode }),
        })
      }

      if (rawCollection === null || rawCollection === undefined) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'INTEGRATION_KNOWLEDGE_LAYER_INVALID_RESPONSE',
          message: 'knowledge layer returned an empty response',
        })
      }

      if (!hasValidatedCollectionShape(rawCollection)) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'INTEGRATION_KNOWLEDGE_COLLECTION_INCONSISTENT',
          message: 'knowledge layer returned an inconsistent collection',
        })
      }

      if (
        !hasTraceabilityConsistency({
          snapshot: safeSnapshot,
          collection: rawCollection,
          versions: validatedRequest.value.versions,
        })
      ) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'INTEGRATION_TRACEABILITY_INCONSISTENT',
          message: 'snapshot and knowledge collection traceability mismatch',
        })
      }

      const success: SnapshotKnowledgeIntegrationSuccess = {
        ok: true,
        status: 'success',
        deterministic: true,
        failClosed: true,
        integrationId: validatedRequest.value.integrationId,
        knowledgeCollection: deepClone(rawCollection),
        traceability: buildTraceability({
          integrationId: validatedRequest.value.integrationId,
          snapshot: safeSnapshot,
          collection: rawCollection,
        }),
      }

      return success
    },
  }
}

export function createSnapshotKnowledgeLayerPort(): SnapshotKnowledgeLayerPort {
  return createDefaultKnowledgeLayerPort()
}
