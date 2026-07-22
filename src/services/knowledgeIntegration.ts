import { INSIGHT_RULE_PROTOCOL_VERSION } from '../types/insightRule'
import type { InsightRuntimeRequest } from '../insight/runtimeRequest'
import { DEFAULT_RUNTIME_ADAPTER_VERSIONS } from './runtimeAdapter'
import type {
  RuntimeAdapterFailure,
  RuntimeAdapterResult,
  RuntimeAdapterRuntimeFailure,
  RuntimeAdapterSuccess,
} from './adapterInterfaces'
import type {
  KnowledgeIntegration,
  KnowledgeIntegrationDependencies,
  KnowledgeIntegrationRuntimeAdapterPort,
} from './knowledgeIntegrationInterfaces'
import type {
  KnowledgeIntegrationFailure,
  KnowledgeIntegrationFailureCode,
  KnowledgeIntegrationRequest,
  KnowledgeIntegrationResult,
  KnowledgeIntegrationSuccess,
  KnowledgeRuntimeTraceability,
} from './knowledgeIntegrationResult'
import type {
  InsightRuleProtocolVersion,
} from '../types/insightRule'
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

function hasRuntimeAdapterPortShape(
  value: unknown,
): value is KnowledgeIntegrationRuntimeAdapterPort {
  return isRecord(value) && typeof value.execute === 'function'
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

function hasValidatedKnowledgeCollectionShape(
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

  if (collection.facts.length === 0) {
    return false
  }

  return true
}

function hasRuntimeAdapterFailureShape(value: unknown): value is RuntimeAdapterFailure {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === false &&
    value.status === 'adapter-failure' &&
    value.deterministic === true &&
    value.failClosed === true &&
    (value.executionId === null || isNonEmptyString(value.executionId)) &&
    isNonEmptyString(value.code) &&
    isNonEmptyString(value.message)
  )
}

function hasRuntimeAdapterRuntimeFailureShape(
  value: unknown,
): value is RuntimeAdapterRuntimeFailure {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === false &&
    value.status === 'runtime-failure' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isRecord(value.request) &&
    isRecord(value.knowledgeCollection) &&
    isRecord(value.response)
  )
}

function hasRuntimeAdapterSuccessShape(value: unknown): value is RuntimeAdapterSuccess {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === true &&
    value.status === 'success' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isRecord(value.request) &&
    isRecord(value.knowledgeCollection) &&
    isRecord(value.response)
  )
}

function hasRuntimeAdapterResultShape(value: unknown): value is RuntimeAdapterResult {
  return (
    hasRuntimeAdapterFailureShape(value) ||
    hasRuntimeAdapterRuntimeFailureShape(value) ||
    hasRuntimeAdapterSuccessShape(value)
  )
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !isNonEmptyString(error.code)) {
    return undefined
  }

  return error.code
}

function buildFailure(input: {
  readonly integrationId: string | null
  readonly code: KnowledgeIntegrationFailureCode
  readonly message: string
  readonly causeCode?: string
  readonly details?: Readonly<Record<string, string | number | boolean | null>>
}): KnowledgeIntegrationFailure {
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

type RequestValidationResult =
  | { readonly ok: true; readonly value: KnowledgeIntegrationRequest }
  | { readonly ok: false; readonly failure: KnowledgeIntegrationFailure }

function validateRequest(
  request: KnowledgeIntegrationRequest | null | undefined,
): RequestValidationResult {
  if (!isRecord(request)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: null,
        code: 'KNOWLEDGE_INTEGRATION_INVALID_REQUEST',
        message: 'knowledge integration request must be a non-null object',
      }),
    }
  }

  if (!isNonEmptyString(request.integrationId)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: null,
        code: 'KNOWLEDGE_INTEGRATION_INVALID_REQUEST',
        message: 'integrationId is required',
      }),
    }
  }

  if (!isNonEmptyString(request.executionId)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: request.integrationId,
        code: 'KNOWLEDGE_INTEGRATION_INVALID_REQUEST',
        message: 'executionId is required',
      }),
    }
  }

  if (!Array.isArray(request.rules)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: request.integrationId,
        code: 'KNOWLEDGE_INTEGRATION_INVALID_REQUEST',
        message: 'rules must be an array',
      }),
    }
  }

  if (!hasValidatedKnowledgeCollectionShape(request.knowledgeCollection)) {
    return {
      ok: false,
      failure: buildFailure({
        integrationId: request.integrationId,
        code: 'KNOWLEDGE_INTEGRATION_INVALID_COLLECTION',
        message: 'knowledgeCollection is not a valid validated collection',
      }),
    }
  }

  return {
    ok: true,
    value: request,
  }
}

function isCompatibleVersions(
  versions: KnowledgeCollectionVersions,
  supported: KnowledgeCollectionVersions,
): boolean {
  return (
    versions.knowledgeVersion === supported.knowledgeVersion &&
    versions.builderVersion === supported.builderVersion &&
    versions.rulesVersion === supported.rulesVersion &&
    versions.projectionVersion === supported.projectionVersion
  )
}

function isTraceabilityConsistent(
  input: {
    readonly request: KnowledgeIntegrationRequest
    readonly runtimeRequest: InsightRuntimeRequest
    readonly adapterResult: RuntimeAdapterSuccess
  },
): boolean {
  const inputCollection = input.request.knowledgeCollection
  const adapterCollection = input.adapterResult.knowledgeCollection

  return (
    input.runtimeRequest.executionId === input.adapterResult.request.executionId &&
    input.runtimeRequest.protocolVersion ===
      input.adapterResult.request.protocolVersion &&
    input.runtimeRequest.knowledgeCollection.identity.knowledgeCollectionId ===
      inputCollection.identity.knowledgeCollectionId &&
    adapterCollection.identity.knowledgeCollectionId ===
      inputCollection.identity.knowledgeCollectionId &&
    adapterCollection.identity.sourceSnapshotId ===
      inputCollection.identity.sourceSnapshotId &&
    adapterCollection.identity.sourceSnapshotKey ===
      inputCollection.identity.sourceSnapshotKey &&
    adapterCollection.identity.sourceSnapshotRevision ===
      inputCollection.identity.sourceSnapshotRevision &&
    adapterCollection.identity.sourceFingerprintValue ===
      inputCollection.identity.sourceFingerprintValue &&
    input.adapterResult.response.executionId === input.runtimeRequest.executionId
  )
}

function buildTraceability(input: {
  readonly request: KnowledgeIntegrationRequest
  readonly runtimeRequest: InsightRuntimeRequest
}): KnowledgeRuntimeTraceability {
  const collection = input.request.knowledgeCollection

  return {
    integrationId: input.request.integrationId,
    knowledgeCollection: {
      knowledgeCollectionId: collection.identity.knowledgeCollectionId,
      sourceSnapshotId: collection.identity.sourceSnapshotId,
      sourceSnapshotKey: collection.identity.sourceSnapshotKey,
      sourceSnapshotRevision: collection.identity.sourceSnapshotRevision,
      versions: deepClone(collection.versions),
      factCount: collection.factCount,
    },
    runtime: {
      executionId: input.runtimeRequest.executionId,
      protocolVersion: input.runtimeRequest.protocolVersion,
      rulesCount: input.runtimeRequest.rules.length,
    },
    relation: {
      requestExecutionIdMatches: true,
      requestProtocolMatches: true,
      requestKnowledgeCollectionMatches: true,
      adapterKnowledgeCollectionMatches: true,
      runtimeExecutionIdMatches: true,
    },
  }
}

function toSupportedVersions(
  value: KnowledgeIntegrationDependencies['supportedVersions'],
): KnowledgeCollectionVersions {
  if (hasVersionsShape(value)) {
    return value
  }

  return DEFAULT_RUNTIME_ADAPTER_VERSIONS
}

function toSupportedProtocol(
  value: KnowledgeIntegrationDependencies['supportedProtocolVersion'],
): InsightRuleProtocolVersion {
  if (!isSafeNonNegativeInteger(value)) {
    return INSIGHT_RULE_PROTOCOL_VERSION
  }

  return value
}

export function createKnowledgeIntegration(
  dependencies: KnowledgeIntegrationDependencies = {},
): KnowledgeIntegration {
  const runtimeAdapter = hasRuntimeAdapterPortShape(dependencies.runtimeAdapter)
    ? dependencies.runtimeAdapter
    : null
  const supportedVersions = toSupportedVersions(dependencies.supportedVersions)
  const supportedProtocolVersion = toSupportedProtocol(
    dependencies.supportedProtocolVersion,
  )

  return {
    integrate(
      request: KnowledgeIntegrationRequest | null | undefined,
    ): KnowledgeIntegrationResult {
      const validatedRequest = validateRequest(request)
      if (!validatedRequest.ok) {
        return validatedRequest.failure
      }

      if (runtimeAdapter === null) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_MISSING_DEPENDENCY',
          message: 'runtime adapter dependency is required',
        })
      }

      const protocolVersion =
        validatedRequest.value.protocolVersion ?? supportedProtocolVersion

      if (!isSafeNonNegativeInteger(protocolVersion)) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_INVALID_REQUEST',
          message: 'protocolVersion must be a non-negative integer',
        })
      }

      if (protocolVersion !== supportedProtocolVersion) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_PROTOCOL_INCOMPATIBLE',
          message: 'protocolVersion is not supported by runtime adapter boundary',
          details: {
            protocolVersion,
            supportedProtocolVersion,
          },
        })
      }

      if (
        !isCompatibleVersions(
          validatedRequest.value.knowledgeCollection.versions,
          supportedVersions,
        )
      ) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_VERSION_INCOMPATIBLE',
          message: 'knowledge collection versions are not supported',
          details: {
            knowledgeVersion:
              validatedRequest.value.knowledgeCollection.versions
                .knowledgeVersion,
            supportedKnowledgeVersion: supportedVersions.knowledgeVersion,
          },
        })
      }

      const runtimeRequest: InsightRuntimeRequest = {
        executionId: validatedRequest.value.executionId,
        protocolVersion,
        knowledgeCollection: deepClone(validatedRequest.value.knowledgeCollection),
        rules: deepClone(validatedRequest.value.rules),
      }

      let rawAdapterResult: unknown
      try {
        rawAdapterResult = runtimeAdapter.execute(deepClone(runtimeRequest))
      } catch (error) {
        const causeCode = readErrorCode(error)
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE',
          message: 'runtime adapter threw during integration',
          ...(causeCode === undefined ? {} : { causeCode }),
        })
      }

      if (!hasRuntimeAdapterResultShape(rawAdapterResult)) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_INCONSISTENT_RESPONSE',
          message: 'runtime adapter returned an invalid response shape',
        })
      }

      if (rawAdapterResult.ok === false) {
        const causeCode =
          rawAdapterResult.status === 'adapter-failure'
            ? rawAdapterResult.code
            : rawAdapterResult.response.code

        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE',
          message: 'runtime adapter reported a fail-closed rejection',
          causeCode,
          details: {
            adapterStatus: rawAdapterResult.status,
          },
        })
      }

      if (
        !isTraceabilityConsistent({
          request: validatedRequest.value,
          runtimeRequest,
          adapterResult: rawAdapterResult,
        })
      ) {
        return buildFailure({
          integrationId: validatedRequest.value.integrationId,
          code: 'KNOWLEDGE_INTEGRATION_TRACEABILITY_INCONSISTENT',
          message: 'runtime adapter result does not preserve collection traceability',
        })
      }

      const success: KnowledgeIntegrationSuccess = {
        ok: true,
        status: 'success',
        deterministic: true,
        failClosed: true,
        integrationId: validatedRequest.value.integrationId,
        traceability: buildTraceability({
          request: validatedRequest.value,
          runtimeRequest,
        }),
        adapterResult: deepClone(rawAdapterResult),
      }

      return success
    },
  }
}
