import type {
  InsightExecutionDependencies,
  InsightExecutionKnowledgeIntegrationPort,
  InsightExecutionService,
  InsightExecutionSnapshotIntegrationPort,
} from './insightExecutionInterfaces'
import type {
  InsightExecutionFailure,
  InsightExecutionFailureCode,
  InsightExecutionRequest,
  InsightExecutionResult,
  InsightExecutionStage,
  InsightExecutionSuccess,
  InsightExecutionTraceability,
} from './insightExecutionResult'
import type {
  KnowledgeIntegrationRequest,
  KnowledgeIntegrationResult,
  KnowledgeIntegrationSuccess,
} from './knowledgeIntegrationResult'
import type {
  SnapshotKnowledgeIntegrationRequest,
  SnapshotKnowledgeIntegrationResult,
  SnapshotKnowledgeIntegrationSuccess,
  SnapshotKnowledgeTraceability,
} from './snapshotKnowledgeIntegrationResult'

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

interface SnapshotMetadataSource {
  readonly identity: {
    readonly snapshotId: string
    readonly snapshotKey: string
  }
  readonly revision: {
    readonly revision: number
  }
  readonly snapshotVersion: string
  readonly canonicalizationVersion: string
}

function hasVersionsShape(value: unknown): boolean {
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

function hasSnapshotMetadataShape(value: unknown): value is SnapshotMetadataSource {
  if (!isRecord(value)) {
    return false
  }

  if (!isRecord(value.identity)) {
    return false
  }

  if (!isRecord(value.revision)) {
    return false
  }

  return (
    isNonEmptyString(value.identity.snapshotId) &&
    isNonEmptyString(value.identity.snapshotKey) &&
    isSafeNonNegativeInteger(value.revision.revision) &&
    isNonEmptyString(value.snapshotVersion) &&
    isNonEmptyString(value.canonicalizationVersion)
  )
}

function hasSnapshotIntegrationPortShape(
  value: unknown,
): value is InsightExecutionSnapshotIntegrationPort {
  return isRecord(value) && typeof value.integrate === 'function'
}

function hasKnowledgeIntegrationPortShape(
  value: unknown,
): value is InsightExecutionKnowledgeIntegrationPort {
  return isRecord(value) && typeof value.integrate === 'function'
}

function hasSnapshotIntegrationSuccessShape(
  value: unknown,
): value is SnapshotKnowledgeIntegrationSuccess {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === true &&
    value.status === 'success' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isNonEmptyString(value.integrationId) &&
    isRecord(value.knowledgeCollection) &&
    isRecord(value.traceability)
  )
}

function hasSnapshotIntegrationFailureShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === false &&
    value.status === 'failure' &&
    value.deterministic === true &&
    value.failClosed === true &&
    (value.integrationId === null || isNonEmptyString(value.integrationId)) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message)
  )
}

function hasSnapshotIntegrationResultShape(
  value: unknown,
): value is SnapshotKnowledgeIntegrationResult {
  return (
    hasSnapshotIntegrationSuccessShape(value) ||
    hasSnapshotIntegrationFailureShape(value)
  )
}

function hasKnowledgeIntegrationSuccessShape(
  value: unknown,
): value is KnowledgeIntegrationSuccess {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === true &&
    value.status === 'success' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isNonEmptyString(value.integrationId) &&
    isRecord(value.traceability) &&
    isRecord(value.adapterResult) &&
    isRecord(value.adapterResult.request) &&
    isRecord(value.adapterResult.response)
  )
}

function hasKnowledgeIntegrationFailureShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === false &&
    value.status === 'failure' &&
    value.deterministic === true &&
    value.failClosed === true &&
    (value.integrationId === null || isNonEmptyString(value.integrationId)) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message)
  )
}

function hasKnowledgeIntegrationResultShape(
  value: unknown,
): value is KnowledgeIntegrationResult {
  return (
    hasKnowledgeIntegrationSuccessShape(value) ||
    hasKnowledgeIntegrationFailureShape(value)
  )
}

function readRequestIds(request: unknown): {
  readonly executionId: string | null
  readonly snapshotIntegrationId: string | null
  readonly knowledgeIntegrationId: string | null
} {
  if (!isRecord(request)) {
    return {
      executionId: null,
      snapshotIntegrationId: null,
      knowledgeIntegrationId: null,
    }
  }

  return {
    executionId: isNonEmptyString(request.executionId) ? request.executionId : null,
    snapshotIntegrationId: isNonEmptyString(request.snapshotIntegrationId)
      ? request.snapshotIntegrationId
      : null,
    knowledgeIntegrationId: isNonEmptyString(request.knowledgeIntegrationId)
      ? request.knowledgeIntegrationId
      : null,
  }
}

function readSnapshotMetadata(
  snapshot: unknown,
): InsightExecutionTraceability['snapshot'] | undefined {
  if (!hasSnapshotMetadataShape(snapshot)) {
    return undefined
  }

  return {
    snapshotId: snapshot.identity.snapshotId,
    snapshotKey: snapshot.identity.snapshotKey,
    snapshotRevision: snapshot.revision.revision,
    snapshotVersion: snapshot.snapshotVersion,
    canonicalizationVersion: snapshot.canonicalizationVersion,
  }
}

function buildTraceability(input: {
  readonly request: InsightExecutionRequest | null | undefined
  readonly completedStages: readonly InsightExecutionStage[]
  readonly snapshotIntegrationTraceability?: SnapshotKnowledgeTraceability
  readonly knowledgeIntegrationTraceability?: KnowledgeIntegrationSuccess['traceability']
  readonly includeRelation?: boolean
}): InsightExecutionTraceability {
  const ids = readRequestIds(input.request)
  const requestSnapshot = isRecord(input.request)
    ? readSnapshotMetadata(input.request.snapshot)
    : undefined

  return {
    executionId: ids.executionId,
    snapshotIntegrationId: ids.snapshotIntegrationId,
    knowledgeIntegrationId: ids.knowledgeIntegrationId,
    ...(requestSnapshot === undefined ? {} : { snapshot: requestSnapshot }),
    completedStages: [...input.completedStages],
    ...(input.snapshotIntegrationTraceability === undefined
      ? {}
      : {
          snapshotIntegrationTraceability: deepClone(
            input.snapshotIntegrationTraceability,
          ),
        }),
    ...(input.knowledgeIntegrationTraceability === undefined
      ? {}
      : {
          knowledgeIntegrationTraceability: deepClone(
            input.knowledgeIntegrationTraceability,
          ),
        }),
    ...(input.includeRelation === true
      ? {
          relation: {
            snapshotToKnowledgeCollectionMatches: true,
            knowledgeCollectionToRuntimeMatches: true,
            runtimeExecutionMatchesRequest: true,
          },
        }
      : {}),
  }
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !isNonEmptyString(error.code)) {
    return undefined
  }

  return error.code
}

function readErrorName(error: unknown): string | undefined {
  if (!isRecord(error) || !isNonEmptyString(error.name)) {
    return undefined
  }

  return error.name
}

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error && isNonEmptyString(error.message)) {
    return error.message
  }

  if (!isRecord(error) || !isNonEmptyString(error.message)) {
    return undefined
  }

  return error.message
}

function buildExceptionDetails(
  error: unknown,
): Readonly<Record<string, string | number | boolean | null>> | undefined {
  const errorName = readErrorName(error)
  const errorMessage = readErrorMessage(error)

  if (errorName === undefined && errorMessage === undefined) {
    return undefined
  }

  return {
    errorName: errorName ?? null,
    errorMessage: errorMessage ?? null,
  }
}

function buildFailure(input: {
  readonly request: InsightExecutionRequest | null | undefined
  readonly executionId: string | null
  readonly stage: InsightExecutionStage
  readonly code: InsightExecutionFailureCode
  readonly message: string
  readonly traceability: InsightExecutionTraceability
  readonly causeCode?: string
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
  readonly snapshotIntegrationResult?: InsightExecutionFailure['snapshotIntegrationResult']
  readonly knowledgeIntegrationResult?: InsightExecutionFailure['knowledgeIntegrationResult']
}): InsightExecutionFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    stage: input.stage,
    executionId: input.executionId,
    code: input.code,
    message: input.message,
    traceability: deepClone(input.traceability),
    ...(input.causeCode === undefined ? {} : { causeCode: input.causeCode }),
    ...(input.details === undefined ? {} : { details: input.details }),
    ...(input.snapshotIntegrationResult === undefined
      ? {}
      : {
          snapshotIntegrationResult: deepClone(input.snapshotIntegrationResult),
        }),
    ...(input.knowledgeIntegrationResult === undefined
      ? {}
      : {
          knowledgeIntegrationResult: deepClone(input.knowledgeIntegrationResult),
        }),
  }
}

type RequestValidationResult =
  | { readonly ok: true; readonly value: InsightExecutionRequest }
  | { readonly ok: false; readonly failure: InsightExecutionFailure }

function validateRequest(
  request: InsightExecutionRequest | null | undefined,
): RequestValidationResult {
  const ids = readRequestIds(request)

  if (!isRecord(request)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: null,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'execution request must be a non-null object',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (!isNonEmptyString(request.executionId)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: null,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'executionId is required',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (!isNonEmptyString(request.snapshotIntegrationId)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: request.executionId,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'snapshotIntegrationId is required',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (!isNonEmptyString(request.knowledgeIntegrationId)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: request.executionId,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'knowledgeIntegrationId is required',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (!hasSnapshotMetadataShape(request.snapshot)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: request.executionId,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_MISSING_SNAPSHOT',
        message: 'snapshot is required with canonical metadata',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (!Array.isArray(request.rules)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: request.executionId,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_MISSING_RULE_CATALOG',
        message: 'rules catalog must be provided as an array',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (!hasVersionsShape(request.versions)) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: request.executionId,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'knowledge versions metadata is required',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (
    request.protocolVersion !== undefined &&
    !isSafeNonNegativeInteger(request.protocolVersion)
  ) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: request.executionId,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'protocolVersion must be a non-negative integer when provided',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  if (ids.executionId === null) {
    return {
      ok: false,
      failure: buildFailure({
        request,
        executionId: null,
        stage: 'request-validation',
        code: 'INSIGHT_EXECUTION_INVALID_REQUEST',
        message: 'execution metadata is inconsistent',
        traceability: buildTraceability({
          request,
          completedStages: [],
        }),
      }),
    }
  }

  return {
    ok: true,
    value: request,
  }
}

function areVersionsEqual(
  left: InsightExecutionRequest['versions'],
  right: SnapshotKnowledgeIntegrationSuccess['knowledgeCollection']['versions'],
): boolean {
  return (
    left.knowledgeVersion === right.knowledgeVersion &&
    left.builderVersion === right.builderVersion &&
    left.rulesVersion === right.rulesVersion &&
    left.projectionVersion === right.projectionVersion
  )
}

function hasSnapshotStageConsistency(
  request: InsightExecutionRequest,
  snapshotResult: SnapshotKnowledgeIntegrationSuccess,
): boolean {
  const snapshotMetadata = readSnapshotMetadata(request.snapshot)
  if (snapshotMetadata === undefined) {
    return false
  }

  return (
    snapshotResult.integrationId === request.snapshotIntegrationId &&
    snapshotResult.traceability.integrationId === request.snapshotIntegrationId &&
    snapshotResult.knowledgeCollection.identity.sourceSnapshotId ===
      snapshotMetadata.snapshotId &&
    snapshotResult.knowledgeCollection.identity.sourceSnapshotKey ===
      snapshotMetadata.snapshotKey &&
    snapshotResult.knowledgeCollection.identity.sourceSnapshotRevision ===
      snapshotMetadata.snapshotRevision &&
    areVersionsEqual(request.versions, snapshotResult.knowledgeCollection.versions) &&
    snapshotResult.traceability.snapshot.snapshotId === snapshotMetadata.snapshotId &&
    snapshotResult.traceability.snapshot.snapshotKey === snapshotMetadata.snapshotKey &&
    snapshotResult.traceability.snapshot.snapshotRevision ===
      snapshotMetadata.snapshotRevision &&
    snapshotResult.traceability.snapshot.snapshotVersion ===
      snapshotMetadata.snapshotVersion &&
    snapshotResult.traceability.snapshot.canonicalizationVersion ===
      snapshotMetadata.canonicalizationVersion &&
    snapshotResult.traceability.knowledgeCollection.knowledgeCollectionId ===
      snapshotResult.knowledgeCollection.identity.knowledgeCollectionId
  )
}

function hasKnowledgeStageConsistency(
  request: InsightExecutionRequest,
  snapshotResult: SnapshotKnowledgeIntegrationSuccess,
  knowledgeResult: KnowledgeIntegrationSuccess,
): boolean {
  const knowledgeCollection = snapshotResult.knowledgeCollection

  return (
    knowledgeResult.integrationId === request.knowledgeIntegrationId &&
    knowledgeResult.traceability.integrationId === request.knowledgeIntegrationId &&
    knowledgeResult.traceability.knowledgeCollection.knowledgeCollectionId ===
      knowledgeCollection.identity.knowledgeCollectionId &&
    knowledgeResult.traceability.knowledgeCollection.sourceSnapshotId ===
      knowledgeCollection.identity.sourceSnapshotId &&
    knowledgeResult.traceability.knowledgeCollection.sourceSnapshotKey ===
      knowledgeCollection.identity.sourceSnapshotKey &&
    knowledgeResult.traceability.knowledgeCollection.sourceSnapshotRevision ===
      knowledgeCollection.identity.sourceSnapshotRevision &&
    knowledgeResult.traceability.runtime.executionId === request.executionId &&
    knowledgeResult.adapterResult.request.executionId === request.executionId &&
    knowledgeResult.adapterResult.request.knowledgeCollection.identity
      .knowledgeCollectionId === knowledgeCollection.identity.knowledgeCollectionId &&
    knowledgeResult.adapterResult.request.knowledgeCollection.identity.sourceSnapshotId ===
      knowledgeCollection.identity.sourceSnapshotId &&
    knowledgeResult.adapterResult.request.knowledgeCollection.identity.sourceSnapshotKey ===
      knowledgeCollection.identity.sourceSnapshotKey &&
    knowledgeResult.adapterResult.request.knowledgeCollection.identity
      .sourceSnapshotRevision === knowledgeCollection.identity.sourceSnapshotRevision &&
    knowledgeResult.adapterResult.response.executionId === request.executionId
  )
}

function buildSnapshotRequest(
  request: InsightExecutionRequest,
): SnapshotKnowledgeIntegrationRequest {
  return {
    integrationId: request.snapshotIntegrationId,
    snapshot: deepClone(request.snapshot),
    versions: deepClone(request.versions),
  }
}

function buildKnowledgeRequest(input: {
  readonly request: InsightExecutionRequest
  readonly snapshotResult: SnapshotKnowledgeIntegrationSuccess
}): KnowledgeIntegrationRequest {
  return {
    integrationId: input.request.knowledgeIntegrationId,
    executionId: input.request.executionId,
    ...(input.request.protocolVersion === undefined
      ? {}
      : { protocolVersion: input.request.protocolVersion }),
    knowledgeCollection: deepClone(input.snapshotResult.knowledgeCollection),
    rules: deepClone(input.request.rules),
  }
}

export function createInsightExecutionService(
  dependencies: InsightExecutionDependencies = {},
): InsightExecutionService {
  const snapshotIntegration = hasSnapshotIntegrationPortShape(
    dependencies.snapshotIntegration,
  )
    ? dependencies.snapshotIntegration
    : null

  const knowledgeIntegration = hasKnowledgeIntegrationPortShape(
    dependencies.knowledgeIntegration,
  )
    ? dependencies.knowledgeIntegration
    : null

  return {
    execute(
      request: InsightExecutionRequest | null | undefined,
    ): InsightExecutionResult {
      const validatedRequest = validateRequest(request)
      if (!validatedRequest.ok) {
        return validatedRequest.failure
      }

      if (snapshotIntegration === null && knowledgeIntegration === null) {
        return buildFailure({
          request: validatedRequest.value,
          executionId: validatedRequest.value.executionId,
          stage: 'pipeline',
          code: 'INSIGHT_EXECUTION_MISSING_DEPENDENCY',
          message: 'snapshotIntegration and knowledgeIntegration dependencies are required',
          details: {
            snapshotIntegrationMissing: true,
            knowledgeIntegrationMissing: true,
          },
          traceability: buildTraceability({
            request: validatedRequest.value,
            completedStages: [],
          }),
        })
      }

      if (snapshotIntegration === null) {
        return buildFailure({
          request: validatedRequest.value,
          executionId: validatedRequest.value.executionId,
          stage: 'snapshot-integration',
          code: 'INSIGHT_EXECUTION_MISSING_DEPENDENCY',
          message: 'snapshotIntegration dependency is required',
          details: {
            snapshotIntegrationMissing: true,
          },
          traceability: buildTraceability({
            request: validatedRequest.value,
            completedStages: [],
          }),
        })
      }

      if (knowledgeIntegration === null) {
        return buildFailure({
          request: validatedRequest.value,
          executionId: validatedRequest.value.executionId,
          stage: 'knowledge-integration',
          code: 'INSIGHT_EXECUTION_MISSING_DEPENDENCY',
          message: 'knowledgeIntegration dependency is required',
          details: {
            knowledgeIntegrationMissing: true,
          },
          traceability: buildTraceability({
            request: validatedRequest.value,
            completedStages: [],
          }),
        })
      }

      try {
        const snapshotRequest = buildSnapshotRequest(validatedRequest.value)

        let rawSnapshotResult: unknown
        try {
          rawSnapshotResult = snapshotIntegration.integrate(deepClone(snapshotRequest))
        } catch (error) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'snapshot-integration',
            code: 'INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_EXCEPTION',
            message: 'snapshot integration threw during execution pipeline',
            causeCode: readErrorCode(error),
            details: buildExceptionDetails(error),
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: [],
            }),
          })
        }

        if (!hasSnapshotIntegrationResultShape(rawSnapshotResult)) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'snapshot-integration',
            code: 'INSIGHT_EXECUTION_INCONSISTENT_SNAPSHOT_RESULT',
            message: 'snapshot integration returned an invalid result shape',
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: [],
            }),
          })
        }

        if (rawSnapshotResult.ok === false) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'snapshot-integration',
            code: 'INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_REJECTED',
            message: 'snapshot integration rejected pipeline execution',
            causeCode: rawSnapshotResult.code,
            details: {
              snapshotFailureCode: rawSnapshotResult.code,
            },
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: [],
            }),
            snapshotIntegrationResult: rawSnapshotResult,
          })
        }

        const snapshotResult = rawSnapshotResult

        if (!hasSnapshotStageConsistency(validatedRequest.value, snapshotResult)) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'snapshot-integration',
            code: 'INSIGHT_EXECUTION_TRACEABILITY_MISMATCH',
            message: 'snapshot integration traceability is inconsistent with request metadata',
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: [],
              snapshotIntegrationTraceability: snapshotResult.traceability,
            }),
            snapshotIntegrationResult: snapshotResult,
          })
        }

        const knowledgeRequest = buildKnowledgeRequest({
          request: validatedRequest.value,
          snapshotResult,
        })

        let rawKnowledgeResult: unknown
        try {
          rawKnowledgeResult = knowledgeIntegration.integrate(
            deepClone(knowledgeRequest),
          )
        } catch (error) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'knowledge-integration',
            code: 'INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_EXCEPTION',
            message: 'knowledge integration threw during execution pipeline',
            causeCode: readErrorCode(error),
            details: buildExceptionDetails(error),
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: ['snapshot-integration'],
              snapshotIntegrationTraceability: snapshotResult.traceability,
            }),
            snapshotIntegrationResult: snapshotResult,
          })
        }

        if (!hasKnowledgeIntegrationResultShape(rawKnowledgeResult)) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'knowledge-integration',
            code: 'INSIGHT_EXECUTION_INCONSISTENT_KNOWLEDGE_RESULT',
            message: 'knowledge integration returned an invalid result shape',
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: ['snapshot-integration'],
              snapshotIntegrationTraceability: snapshotResult.traceability,
            }),
            snapshotIntegrationResult: snapshotResult,
          })
        }

        if (rawKnowledgeResult.ok === false) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'knowledge-integration',
            code: 'INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED',
            message: 'knowledge integration rejected pipeline execution',
            causeCode: rawKnowledgeResult.code,
            details: {
              knowledgeFailureCode: rawKnowledgeResult.code,
            },
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: ['snapshot-integration'],
              snapshotIntegrationTraceability: snapshotResult.traceability,
            }),
            snapshotIntegrationResult: snapshotResult,
            knowledgeIntegrationResult: rawKnowledgeResult,
          })
        }

        const knowledgeResult = rawKnowledgeResult

        if (
          !hasKnowledgeStageConsistency(
            validatedRequest.value,
            snapshotResult,
            knowledgeResult,
          )
        ) {
          return buildFailure({
            request: validatedRequest.value,
            executionId: validatedRequest.value.executionId,
            stage: 'knowledge-integration',
            code: 'INSIGHT_EXECUTION_TRACEABILITY_MISMATCH',
            message: 'knowledge integration traceability is inconsistent with snapshot stage output',
            traceability: buildTraceability({
              request: validatedRequest.value,
              completedStages: ['snapshot-integration'],
              snapshotIntegrationTraceability: snapshotResult.traceability,
              knowledgeIntegrationTraceability: knowledgeResult.traceability,
            }),
            snapshotIntegrationResult: snapshotResult,
            knowledgeIntegrationResult: knowledgeResult,
          })
        }

        const success: InsightExecutionSuccess = {
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          stage: 'pipeline',
          executionId: validatedRequest.value.executionId,
          completedStages: ['snapshot-integration', 'knowledge-integration'],
          traceability: buildTraceability({
            request: validatedRequest.value,
            completedStages: ['snapshot-integration', 'knowledge-integration'],
            snapshotIntegrationTraceability: snapshotResult.traceability,
            knowledgeIntegrationTraceability: knowledgeResult.traceability,
            includeRelation: true,
          }),
          snapshotIntegration: deepClone(snapshotResult),
          knowledgeIntegration: deepClone(knowledgeResult),
          runtimeResponse: deepClone(knowledgeResult.adapterResult.response),
        }

        return success
      } catch (error) {
        return buildFailure({
          request: validatedRequest.value,
          executionId: validatedRequest.value.executionId,
          stage: 'pipeline',
          code: 'INSIGHT_EXECUTION_PIPELINE_FAILURE',
          message: 'execution pipeline failed with an unexpected error',
          causeCode: readErrorCode(error),
          details: buildExceptionDetails(error),
          traceability: buildTraceability({
            request: validatedRequest.value,
            completedStages: [],
          }),
        })
      }
    },
  }
}
