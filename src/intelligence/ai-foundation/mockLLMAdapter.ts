import {
  LLM_FAILURE_CODES,
  LLM_PROTOCOL_VERSIONS,
  type LLMAdapterPort,
  type LLMCapabilityFlag,
  type LLMExecutionMode,
  type LLMFailureCode,
  type LLMInvocationFailure,
  type LLMInvocationResult,
  type LLMProtocolVersion,
  type LLMRequest,
} from './llmAdapterContracts'
import {
  createMockLLMResponseFactory,
  type MockLLMResponseFactory,
} from './mockLLMResponseFactory'

export interface MockLLMAdapter extends LLMAdapterPort {
  readonly adapterId: string
}

export interface CreateMockLLMAdapterInput {
  readonly adapterId?: string
  readonly responseFactory?: MockLLMResponseFactory
}

function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    return value.map((entry) => deepClone(entry)) as T
  }

  const cloned: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    cloned[key] = deepClone(entry)
  }

  return cloned as T
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      deepFreeze(entry)
    }
    return Object.freeze(value)
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    deepFreeze(entry)
  }

  return Object.freeze(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

const FAILURE_CODE_SET = new Set<string>(LLM_FAILURE_CODES)

function isKnownFailureCode(value: string): value is LLMFailureCode {
  return FAILURE_CODE_SET.has(value)
}

function isKnownExecutionMode(value: string): value is LLMExecutionMode {
  return value === 'LOCAL_ONLY' || value === 'EXTERNAL_PROVIDER'
}

function isKnownProtocolVersion(value: number): value is LLMProtocolVersion {
  return LLM_PROTOCOL_VERSIONS.includes(value as LLMProtocolVersion)
}

function buildRejectedTraceability(input: {
  readonly request: unknown
  readonly code: LLMFailureCode
  readonly requestToContext?: 'matched' | 'missing' | 'mismatch'
  readonly requestToProtocol?: 'matched' | 'missing' | 'mismatch'
  readonly requestToVersion?: 'matched' | 'missing' | 'mismatch'
  readonly requestToCapabilities?: 'matched' | 'missing' | 'mismatch'
}): LLMInvocationFailure['traceability'] {
  const request = isRecord(input.request) ? input.request : null
  const traceability = request !== null && isRecord(request.traceability)
    ? request.traceability
    : null
  const contextPackage = request !== null && isRecord(request.contextPackage)
    ? request.contextPackage
    : null
  const provider = request !== null && isRecord(request.provider)
    ? request.provider
    : null

  const protocolVersion =
    request !== null && typeof request.protocolVersion === 'number' && isKnownProtocolVersion(request.protocolVersion)
      ? request.protocolVersion
      : null

  const executionMode =
    request !== null && typeof request.executionMode === 'string' && isKnownExecutionMode(request.executionMode)
      ? request.executionMode
      : null

  return {
    traceId: traceability !== null && isNonEmptyString(traceability.traceId)
      ? traceability.traceId
      : null,
    relationId: traceability !== null && isNonEmptyString(traceability.relationId)
      ? traceability.relationId
      : null,
    requestId: traceability !== null && isNonEmptyString(traceability.requestId)
      ? traceability.requestId
      : null,
    contextRequestId: contextPackage !== null && isNonEmptyString(contextPackage.requestId)
      ? contextPackage.requestId
      : null,
    policyVersion: contextPackage !== null && isNonEmptyString(contextPackage.policyVersion)
      ? contextPackage.policyVersion
      : null,
    protocolVersion,
    executionMode,
    providerId: provider !== null && isNonEmptyString(provider.providerId)
      ? provider.providerId
      : null,
    providerVersion: provider !== null && isNonEmptyString(provider.providerVersion)
      ? provider.providerVersion
      : null,
    decision: 'rejected',
    failureCode: input.code,
    relation: {
      requestToContext: input.requestToContext ?? 'missing',
      requestToProtocol: input.requestToProtocol ?? 'missing',
      requestToVersion: input.requestToVersion ?? 'missing',
      requestToCapabilities: input.requestToCapabilities ?? 'missing',
    },
  }
}

function buildFailure(input: {
  readonly request: unknown
  readonly code: LLMFailureCode
  readonly message: string
  readonly requestToContext?: 'matched' | 'missing' | 'mismatch'
  readonly requestToProtocol?: 'matched' | 'missing' | 'mismatch'
  readonly requestToVersion?: 'matched' | 'missing' | 'mismatch'
  readonly requestToCapabilities?: 'matched' | 'missing' | 'mismatch'
}): LLMInvocationFailure {
  return deepFreeze({
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: input.code,
    message: input.message,
    traceability: buildRejectedTraceability(input),
  })
}

function hasContextPackageShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.purpose) &&
    isKnownExecutionMode(value.processingMode as string) &&
    isNonEmptyString(value.policyVersion) &&
    typeof value.protocolVersion === 'number' &&
    isKnownProtocolVersion(value.protocolVersion) &&
    Array.isArray(value.orderedContextFragments) &&
    Array.isArray(value.appliedRedactions) &&
    Array.isArray(value.appliedMinimization) &&
    isRecord(value.traceability)
  )
}

function hasProviderCapabilitiesShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  if (
    !Array.isArray(value.supportedProtocolVersions) ||
    !Array.isArray(value.supportedExecutionModes) ||
    !Array.isArray(value.capabilityFlags)
  ) {
    return false
  }

  if (
    !isSafeNonNegativeInteger(value.maxInputTokens) ||
    !isSafeNonNegativeInteger(value.maxOutputTokens) ||
    value.supportsDeterministicContracts !== true ||
    value.acceptsContextPackageOnly !== true
  ) {
    return false
  }

  return true
}

function hasProviderShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.providerId) &&
    isNonEmptyString(value.providerVersion) &&
    typeof value.protocolVersion === 'number' &&
    isKnownProtocolVersion(value.protocolVersion) &&
    hasProviderCapabilitiesShape(value.capabilities)
  )
}

function hasTokenBudgetShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  const inputTokenLimit = value.inputTokenLimit
  const outputTokenLimit = value.outputTokenLimit
  const totalTokenLimit = value.totalTokenLimit
  const reservedOutputTokens = value.reservedOutputTokens

  if (
    !isSafeNonNegativeInteger(inputTokenLimit) ||
    !isSafeNonNegativeInteger(outputTokenLimit) ||
    !isSafeNonNegativeInteger(totalTokenLimit) ||
    !isSafeNonNegativeInteger(reservedOutputTokens)
  ) {
    return false
  }

  if (reservedOutputTokens > outputTokenLimit) {
    return false
  }

  return totalTokenLimit >= inputTokenLimit + outputTokenLimit
}

function hasRequestTraceabilityShape(value: unknown): boolean {
  if (!isRecord(value)) {
    return false
  }

  return (
    isNonEmptyString(value.traceId) &&
    isNonEmptyString(value.relationId) &&
    isNonEmptyString(value.requestId) &&
    isNonEmptyString(value.contextRequestId) &&
    isNonEmptyString(value.policyVersion)
  )
}

function parseRequest(value: unknown):
  | { readonly ok: true; readonly request: LLMRequest }
  | { readonly ok: false; readonly failure: LLMInvocationFailure } {
  if (!isRecord(value)) {
    return {
      ok: false,
      failure: buildFailure({
        request: null,
        code: 'INVALID_REQUEST',
        message: 'mock adapter request must be a non-null object',
      }),
    }
  }

  const requestId = value.requestId
  if (!isNonEmptyString(requestId)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'INVALID_REQUEST',
        message: 'requestId is required',
      }),
    }
  }

  if (value.protocolVersion === undefined || value.protocolVersion === null) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'MISSING_PROTOCOL_VERSION',
        message: 'protocolVersion is required',
        requestToContext: 'missing',
        requestToProtocol: 'missing',
        requestToVersion: 'missing',
        requestToCapabilities: 'missing',
      }),
    }
  }

  if (typeof value.protocolVersion !== 'number' || !isKnownProtocolVersion(value.protocolVersion)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'UNSUPPORTED_PROTOCOL_VERSION',
        message: 'protocolVersion is not supported by mock adapter',
        requestToContext: 'missing',
        requestToProtocol: 'mismatch',
        requestToVersion: 'missing',
        requestToCapabilities: 'missing',
      }),
    }
  }

  if (typeof value.executionMode !== 'string' || !isKnownExecutionMode(value.executionMode)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'INCOMPATIBLE_EXECUTION_MODE',
        message: 'executionMode is invalid or unsupported by mock adapter',
        requestToContext: 'missing',
        requestToProtocol: 'matched',
        requestToVersion: 'missing',
        requestToCapabilities: 'missing',
      }),
    }
  }

  const executionMode = value.executionMode

  if (!hasContextPackageShape(value.contextPackage)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'MISSING_CONTEXT_PACKAGE',
        message: 'context package is required and must be contract-valid',
        requestToContext: 'missing',
        requestToProtocol: 'matched',
        requestToVersion: 'missing',
        requestToCapabilities: 'missing',
      }),
    }
  }

  if (!hasProviderShape(value.provider)) {
    const providerRecord = isRecord(value.provider) ? value.provider : null

    if (providerRecord === null || !isNonEmptyString(providerRecord.providerId)) {
      return {
        ok: false,
        failure: buildFailure({
          request: value,
          code: 'MISSING_PROVIDER_DESCRIPTOR',
          message: 'provider descriptor is required',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'missing',
          requestToCapabilities: 'missing',
        }),
      }
    }

    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'MISSING_CAPABILITIES',
        message: 'provider capabilities are required and must be complete',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'missing',
        requestToCapabilities: 'missing',
      }),
    }
  }

  const provider = value.provider as LLMRequest['provider']

  if (!hasTokenBudgetShape(value.tokenBudget)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'TOKEN_BUDGET_INVALID',
        message: 'token budget is invalid or inconsistent',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'matched',
        requestToCapabilities: 'matched',
      }),
    }
  }

  const tokenBudget = value.tokenBudget as LLMRequest['tokenBudget']

  if (!Array.isArray(value.requiredCapabilityFlags)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'INCOMPATIBLE_CAPABILITIES',
        message: 'requiredCapabilityFlags must be provided as an array',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'matched',
        requestToCapabilities: 'mismatch',
      }),
    }
  }

  if (!hasRequestTraceabilityShape(value.traceability)) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'INVALID_REQUEST',
        message: 'request traceability is required',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'matched',
        requestToCapabilities: 'missing',
      }),
    }
  }

  const capabilities = provider.capabilities
  const capabilityFlags = capabilities.capabilityFlags
  const requiredCapabilityFlags = value.requiredCapabilityFlags

  if (
    !capabilities.supportedProtocolVersions.includes(value.protocolVersion) ||
    !capabilities.supportedExecutionModes.includes(executionMode)
  ) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'INCOMPATIBLE_EXECUTION_MODE',
        message: 'provider capabilities do not support requested mode or protocol',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'matched',
        requestToCapabilities: 'mismatch',
      }),
    }
  }

  for (const required of requiredCapabilityFlags) {
    if (!capabilityFlags.includes(required as LLMCapabilityFlag)) {
      return {
        ok: false,
        failure: buildFailure({
          request: value,
          code: 'INCOMPATIBLE_CAPABILITIES',
          message: 'provider capabilities do not satisfy required capability flags',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'mismatch',
        }),
      }
    }
  }

  if (
    tokenBudget.inputTokenLimit > capabilities.maxInputTokens ||
    tokenBudget.outputTokenLimit > capabilities.maxOutputTokens
  ) {
    return {
      ok: false,
      failure: buildFailure({
        request: value,
        code: 'TOKEN_BUDGET_INVALID',
        message: 'token budget exceeds provider limits',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'matched',
        requestToCapabilities: 'matched',
      }),
    }
  }

  return {
    ok: true,
    request: deepClone(value as unknown as LLMRequest),
  }
}

function hasInvocationFailureShape(value: unknown): value is LLMInvocationFailure {
  if (!isRecord(value)) {
    return false
  }

  return (
    value.ok === false &&
    value.status === 'failure' &&
    value.deterministic === true &&
    value.failClosed === true &&
    isNonEmptyString(value.code) &&
    isKnownFailureCode(value.code) &&
    isNonEmptyString(value.message) &&
    isRecord(value.traceability)
  )
}

function isInvocationResultConsistent(
  request: LLMRequest,
  result: LLMInvocationResult,
): boolean {
  if (!result.ok) {
    return hasInvocationFailureShape(result)
  }

  return (
    result.response.requestId === request.requestId &&
    result.response.providerId === request.provider.providerId &&
    result.response.providerVersion === request.provider.providerVersion &&
    result.response.protocolVersion === request.protocolVersion &&
    result.response.executionMode === request.executionMode &&
    result.response.traceability.requestId === request.requestId &&
    result.traceability.requestId === request.requestId &&
    result.response.traceability.contextRequestId === request.contextPackage.requestId &&
    result.traceability.contextRequestId === request.contextPackage.requestId &&
    result.response.traceability.policyVersion === request.contextPackage.policyVersion &&
    result.traceability.policyVersion === request.contextPackage.policyVersion
  )
}

export function createMockLLMAdapter(
  input: CreateMockLLMAdapterInput = {},
): MockLLMAdapter {
  const responseFactory = input.responseFactory ?? createMockLLMResponseFactory()
  const adapterId = isNonEmptyString(input.adapterId)
    ? input.adapterId
    : 'mock-llm-adapter/1.0.0'

  return {
    adapterId,

    invoke(request: LLMRequest | null | undefined): LLMInvocationResult {
      const parsed = parseRequest(request)
      if (!parsed.ok) {
        return parsed.failure
      }

      try {
        const response = responseFactory.createResponse(parsed.request)
        const successResult: LLMInvocationResult = {
          ok: true,
          status: 'success',
          deterministic: true,
          failClosed: true,
          response: deepClone(response),
          traceability: deepClone(response.traceability),
        }

        if (!isInvocationResultConsistent(parsed.request, successResult)) {
          return buildFailure({
            request: parsed.request,
            code: 'INCONSISTENT_INVOCATION_RESULT',
            message: 'mock adapter produced an inconsistent invocation result',
            requestToContext: 'matched',
            requestToProtocol: 'matched',
            requestToVersion: 'matched',
            requestToCapabilities: 'matched',
          })
        }

        return deepFreeze(successResult)
      } catch {
        return buildFailure({
          request: parsed.request,
          code: 'INVOCATION_NOT_EXECUTED',
          message: 'mock adapter response factory failed to produce a response',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'matched',
        })
      }
    },
  }
}
