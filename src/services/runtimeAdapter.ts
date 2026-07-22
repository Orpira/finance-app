import {
  KnowledgeBuilderError,
  buildKnowledgeCollectionFromSnapshot,
} from '../intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  KnowledgeValidationError,
  validateKnowledgeCollection,
} from '../intelligence/knowledge-layer/knowledgeCollectionValidator'
import {
  INSIGHT_RULE_PROTOCOL_VERSION,
  type InsightRuleProtocolVersion,
} from '../types/insightRule'
import type { InsightRuntimeRequest } from '../insight/runtimeRequest'
import type {
  InsightRuntimeFailure,
  InsightRuntimeResponse,
  InsightRuntimeSuccess,
} from '../insight/runtimeResponse'
import type {
  RuntimeAdapter,
  RuntimeAdapterDependencies,
  RuntimeAdapterFailure,
  RuntimeAdapterFailureCode,
  RuntimeAdapterInput,
  RuntimeAdapterKnowledgeBuilderPort,
  RuntimeAdapterKnowledgeValidatorPort,
  RuntimeAdapterResult,
  RuntimeAdapterRuntimeFailure,
  RuntimeAdapterRuntimePort,
  RuntimeAdapterSuccess,
  RuntimeAdapterVersions,
} from './adapterInterfaces'

const DEFAULT_KNOWLEDGE_VERSION = 'knowledge/1.0.0'
const DEFAULT_BUILDER_VERSION = 'knowledge-builder/1.0.0'
const DEFAULT_RULES_VERSION = 'knowledge-rules/1.0.0'
const DEFAULT_PROJECTION_VERSION = 'knowledge-projection/1.0.0'

export const DEFAULT_RUNTIME_ADAPTER_VERSIONS: RuntimeAdapterVersions = {
  knowledgeVersion: DEFAULT_KNOWLEDGE_VERSION as RuntimeAdapterVersions['knowledgeVersion'],
  builderVersion: DEFAULT_BUILDER_VERSION as RuntimeAdapterVersions['builderVersion'],
  rulesVersion: DEFAULT_RULES_VERSION as RuntimeAdapterVersions['rulesVersion'],
  projectionVersion: DEFAULT_PROJECTION_VERSION as RuntimeAdapterVersions['projectionVersion'],
}

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

function hasRuntimePortShape(value: unknown): value is RuntimeAdapterRuntimePort {
  return isRecord(value) && typeof value.execute === 'function'
}

function hasBuilderPortShape(value: unknown): value is RuntimeAdapterKnowledgeBuilderPort {
  return isRecord(value) && typeof value.build === 'function'
}

function hasValidatorPortShape(value: unknown): value is RuntimeAdapterKnowledgeValidatorPort {
  return isRecord(value) && typeof value.validate === 'function'
}

function hasRuntimeFailureShape(response: unknown): response is InsightRuntimeFailure {
  if (!isRecord(response)) {
    return false
  }

  return (
    response.ok === false &&
    response.status === 'failure' &&
    response.deterministic === true &&
    response.failClosed === true &&
    (response.executionId === null || isNonEmptyString(response.executionId)) &&
    isNonEmptyString(response.code) &&
    isNonEmptyString(response.message)
  )
}

function hasRuntimeSuccessShape(response: unknown): response is InsightRuntimeSuccess {
  if (!isRecord(response)) {
    return false
  }

  return (
    response.ok === true &&
    response.status === 'success' &&
    response.deterministic === true &&
    response.failClosed === true &&
    response.repositoryUpdated === true &&
    isNonEmptyString(response.executionId) &&
    isRecord(response.collection) &&
    isRecord(response.assessment) &&
    isRecord(response.validationReport)
  )
}

function hasRuntimeResponseShape(response: unknown): response is InsightRuntimeResponse {
  return hasRuntimeSuccessShape(response) || hasRuntimeFailureShape(response)
}

function readErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) {
    return undefined
  }

  if (!isNonEmptyString(error.code)) {
    return undefined
  }

  return error.code
}

function buildAdapterFailure(input: {
  readonly executionId: string | null
  readonly code: RuntimeAdapterFailureCode
  readonly message: string
  readonly causeCode?: string
}): RuntimeAdapterFailure {
  return {
    ok: false,
    status: 'adapter-failure',
    deterministic: true,
    failClosed: true,
    executionId: input.executionId,
    code: input.code,
    message: input.message,
    ...(input.causeCode === undefined ? {} : { causeCode: input.causeCode }),
  }
}

function buildSuccess(input: {
  readonly request: InsightRuntimeRequest
  readonly knowledgeCollection: RuntimeAdapterSuccess['knowledgeCollection']
  readonly response: InsightRuntimeSuccess
}): RuntimeAdapterSuccess {
  return {
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    request: deepClone(input.request),
    knowledgeCollection: deepClone(input.knowledgeCollection),
    response: deepClone(input.response),
  }
}

function buildRuntimeFailure(input: {
  readonly request: InsightRuntimeRequest
  readonly knowledgeCollection: RuntimeAdapterRuntimeFailure['knowledgeCollection']
  readonly response: InsightRuntimeFailure
}): RuntimeAdapterRuntimeFailure {
  return {
    ok: false,
    status: 'runtime-failure',
    deterministic: true,
    failClosed: true,
    request: deepClone(input.request),
    knowledgeCollection: deepClone(input.knowledgeCollection),
    response: deepClone(input.response),
  }
}

interface NormalizedInput {
  readonly executionId: string
  readonly protocolVersion: InsightRuleProtocolVersion
  readonly versions: RuntimeAdapterVersions
  readonly snapshot: RuntimeAdapterInput['snapshot']
  readonly rules: RuntimeAdapterInput['rules']
}

type InputValidationResult =
  | { readonly ok: true; readonly value: NormalizedInput }
  | {
      readonly ok: false
      readonly executionId: string | null
      readonly code: RuntimeAdapterFailureCode
      readonly message: string
    }

function normalizeInput(
  input: RuntimeAdapterInput | null | undefined,
): InputValidationResult {
  if (!isRecord(input)) {
    return {
      ok: false,
      executionId: null,
      code: 'ADAPTER_INVALID_INPUT',
      message: 'runtime adapter input must be a non-null object',
    }
  }

  if (!isNonEmptyString(input.executionId)) {
    return {
      ok: false,
      executionId: null,
      code: 'ADAPTER_INVALID_INPUT',
      message: 'runtime adapter executionId is required',
    }
  }

  if (!isRecord(input.snapshot)) {
    return {
      ok: false,
      executionId: input.executionId,
      code: 'ADAPTER_INVALID_INPUT',
      message: 'runtime adapter snapshot is required',
    }
  }

  if (!Array.isArray(input.rules)) {
    return {
      ok: false,
      executionId: input.executionId,
      code: 'ADAPTER_INVALID_INPUT',
      message: 'runtime adapter rules must be an array',
    }
  }

  const protocolVersion =
    input.protocolVersion ?? INSIGHT_RULE_PROTOCOL_VERSION

  if (!isSafeNonNegativeInteger(protocolVersion)) {
    return {
      ok: false,
      executionId: input.executionId,
      code: 'ADAPTER_INVALID_INPUT',
      message: 'runtime adapter protocolVersion must be a non-negative integer',
    }
  }

  const versions = {
    ...DEFAULT_RUNTIME_ADAPTER_VERSIONS,
    ...(input.versions ?? {}),
  }

  if (
    !isNonEmptyString(versions.knowledgeVersion) ||
    !isNonEmptyString(versions.builderVersion) ||
    !isNonEmptyString(versions.rulesVersion) ||
    !isNonEmptyString(versions.projectionVersion)
  ) {
    return {
      ok: false,
      executionId: input.executionId,
      code: 'ADAPTER_INVALID_INPUT',
      message: 'runtime adapter versions are invalid',
    }
  }

  return {
    ok: true,
    value: {
      executionId: input.executionId,
      protocolVersion,
      versions,
      snapshot: input.snapshot,
      rules: input.rules,
    },
  }
}

function mapBuilderErrorToFailureCode(error: unknown): RuntimeAdapterFailureCode {
  const code = readErrorCode(error)
  if (code === undefined) {
    return 'ADAPTER_KNOWLEDGE_BUILD_FAILED'
  }

  if (
    code === 'KNOWLEDGE_BUILDER_INVALID_SNAPSHOT' ||
    code === 'KNOWLEDGE_BUILDER_INVALID_ENGINE_RESULT' ||
    code === 'KNOWLEDGE_BUILDER_INVALID_EVIDENCE' ||
    code === 'KNOWLEDGE_BUILDER_INVALID_VALUE'
  ) {
    return 'ADAPTER_INCOMPATIBLE_SOURCE_DATA'
  }

  return 'ADAPTER_KNOWLEDGE_BUILD_FAILED'
}

function defaultBuilderPort(): RuntimeAdapterKnowledgeBuilderPort {
  return {
    build(input) {
      return buildKnowledgeCollectionFromSnapshot(input)
    },
  }
}

function defaultValidatorPort(): RuntimeAdapterKnowledgeValidatorPort {
  return {
    validate(collection) {
      return validateKnowledgeCollection(collection)
    },
  }
}

export function createRuntimeAdapter(
  dependencies: RuntimeAdapterDependencies,
): RuntimeAdapter {
  const runtime = hasRuntimePortShape(dependencies.runtime)
    ? dependencies.runtime
    : null
  const builder = hasBuilderPortShape(dependencies.builder)
    ? dependencies.builder
    : defaultBuilderPort()
  const validator = hasValidatorPortShape(dependencies.validator)
    ? dependencies.validator
    : defaultValidatorPort()

  return {
    adaptAndExecute(input: RuntimeAdapterInput | null | undefined): RuntimeAdapterResult {
      const normalized = normalizeInput(input)
      if (!normalized.ok) {
        return buildAdapterFailure({
          executionId: normalized.executionId,
          code: normalized.code,
          message: normalized.message,
        })
      }

      if (runtime === null) {
        return buildAdapterFailure({
          executionId: normalized.value.executionId,
          code: 'ADAPTER_MISSING_DEPENDENCY',
          message: 'runtime dependency is required',
        })
      }

      const runtimeInput = normalized.value

      let draftKnowledgeCollection
      try {
        draftKnowledgeCollection = builder.build({
          snapshot: deepClone(runtimeInput.snapshot),
          knowledgeVersion: runtimeInput.versions.knowledgeVersion,
          builderVersion: runtimeInput.versions.builderVersion,
          rulesVersion: runtimeInput.versions.rulesVersion,
          projectionVersion: runtimeInput.versions.projectionVersion,
        })
      } catch (error) {
        const failureCode = mapBuilderErrorToFailureCode(error)
        const causeCode = readErrorCode(error)
        return buildAdapterFailure({
          executionId: runtimeInput.executionId,
          code: failureCode,
          message: 'runtime adapter failed to build knowledge collection',
          ...(causeCode === undefined ? {} : { causeCode }),
        })
      }

      let validatedKnowledgeCollection
      try {
        validatedKnowledgeCollection = validator.validate(
          deepClone(draftKnowledgeCollection),
        )
      } catch (error) {
        const causeCode = readErrorCode(error)
        return buildAdapterFailure({
          executionId: runtimeInput.executionId,
          code: 'ADAPTER_KNOWLEDGE_VALIDATION_FAILED',
          message: 'runtime adapter failed to validate knowledge collection',
          ...(causeCode === undefined ? {} : { causeCode }),
        })
      }

      const request: InsightRuntimeRequest = {
        executionId: runtimeInput.executionId,
        protocolVersion: runtimeInput.protocolVersion,
        knowledgeCollection: deepClone(validatedKnowledgeCollection),
        rules: deepClone(runtimeInput.rules),
      }

      let rawRuntimeResponse: unknown
      try {
        rawRuntimeResponse = runtime.execute(deepClone(request))
      } catch {
        return buildAdapterFailure({
          executionId: runtimeInput.executionId,
          code: 'ADAPTER_RUNTIME_INVOCATION_FAILED',
          message: 'runtime adapter failed while invoking runtime.execute',
        })
      }

      if (!hasRuntimeResponseShape(rawRuntimeResponse)) {
        return buildAdapterFailure({
          executionId: runtimeInput.executionId,
          code: 'ADAPTER_RUNTIME_INVALID_RESPONSE',
          message: 'runtime adapter received an invalid runtime response',
        })
      }

      if (rawRuntimeResponse.ok) {
        return buildSuccess({
          request,
          knowledgeCollection: validatedKnowledgeCollection,
          response: rawRuntimeResponse,
        })
      }

      return buildRuntimeFailure({
        request,
        knowledgeCollection: validatedKnowledgeCollection,
        response: rawRuntimeResponse,
      })
    },
  }
}

export {
  KnowledgeBuilderError,
  KnowledgeValidationError,
}
