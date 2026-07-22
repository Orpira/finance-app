import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { AIContextPackage } from '../src/intelligence/ai-foundation/aiContextBuilderContracts'
import {
  LLM_CAPABILITY_FLAGS,
  LLM_EXECUTION_MODES,
  LLM_FAILURE_CODES,
  LLM_PROTOCOL_VERSIONS,
  type LLMAdapterPort,
  type LLMCapabilityFlag,
  type LLMExecutionMode,
  type LLMFailureCode,
  type LLMInvocationResult,
  type LLMProtocolVersion,
  type LLMProviderDescriptor,
  type LLMRequest,
  type LLMTokenBudget,
} from '../src/intelligence/ai-foundation/llmAdapterContracts'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isJsonSafe(value: unknown, ancestors: ReadonlySet<object> = new Set()): boolean {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry, ancestors))
  }

  if (!isRecord(value)) {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  for (const entry of Object.values(value)) {
    if (!isJsonSafe(entry, nextAncestors)) {
      return false
    }
  }

  return true
}

function asSuccess(result: LLMInvocationResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success but got ${result.code}`)
  }

  return result
}

function asFailure(result: LLMInvocationResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure result')
  }

  return result
}

function createContextPackage(): AIContextPackage {
  return {
    requestId: 'ctx:request:001',
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: 'LOCAL_ONLY',
    policyVersion: 'ai-privacy-policy/1.0.0',
    protocolVersion: 1,
    orderedContextFragments: [
      {
        referenceId: 'ctx:fragment:summary:01',
        descriptorType: 'InsightSummaryReference',
        category: 'INSIGHT_SUMMARY',
        classification: 'PERSONAL',
        data: {
          summaryCode: 'summary.current',
          insightState: 'active',
        },
      },
    ],
    appliedRedactions: [
      {
        referenceId: 'ctx:fragment:summary:01',
        path: 'data.insightState',
        strategy: 'MASK',
        reasonCode: 'redaction.mask.text',
      },
    ],
    appliedMinimization: [
      {
        referenceId: 'ctx:fragment:summary:01',
        path: 'data.debugInfo',
        reasonCode: 'min.remove.internal',
      },
    ],
    traceability: {
      traceId: 'trace:llm:001',
      relationId: 'relation:llm:001',
      requestId: 'ctx:request:001',
      policyVersion: 'ai-privacy-policy/1.0.0',
      protocolVersion: 1,
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
      authorizedCategories: ['INSIGHT_SUMMARY'],
      resolvedReferencesCount: 1,
      decision: 'built',
      relation: {
        requestToEnvelope: 'matched',
        envelopeToDescriptors: 'matched',
      },
    },
  }
}

function createProviderDescriptor(
  overrides?: Partial<LLMProviderDescriptor>,
): LLMProviderDescriptor {
  const descriptor: LLMProviderDescriptor = {
    providerId: 'provider-neutral.stub',
    providerVersion: '1.0.0',
    protocolVersion: 1,
    capabilities: {
      supportedProtocolVersions: [1],
      supportedExecutionModes: ['LOCAL_ONLY', 'EXTERNAL_PROVIDER'],
      capabilityFlags: [
        'CONTRACT_VALIDATION',
        'SYNC_INVOCATION',
        'STRUCTURED_JSON_OUTPUT',
        'TOKEN_BUDGET_ENFORCEMENT',
        'TRACEABILITY_PROPAGATION',
      ],
      maxInputTokens: 8000,
      maxOutputTokens: 2000,
      supportsDeterministicContracts: true,
      acceptsContextPackageOnly: true,
    },
  }

  if (overrides === undefined) {
    return descriptor
  }

  return {
    ...descriptor,
    ...overrides,
    capabilities: {
      ...descriptor.capabilities,
      ...(overrides.capabilities ?? {}),
    },
  }
}

function createTokenBudget(overrides?: Partial<LLMTokenBudget>): LLMTokenBudget {
  return {
    inputTokenLimit: 1200,
    outputTokenLimit: 400,
    totalTokenLimit: 1600,
    reservedOutputTokens: 100,
    ...(overrides ?? {}),
  }
}

function createRequest(overrides?: {
  readonly requestId?: string
  readonly protocolVersion?: LLMProtocolVersion
  readonly executionMode?: LLMExecutionMode
  readonly contextPackage?: AIContextPackage
  readonly provider?: LLMProviderDescriptor
  readonly tokenBudget?: LLMTokenBudget
  readonly requiredCapabilityFlags?: readonly LLMCapabilityFlag[]
}): LLMRequest {
  return {
    requestId: overrides?.requestId ?? 'llm:request:001',
    protocolVersion: overrides?.protocolVersion ?? 1,
    executionMode: overrides?.executionMode ?? 'LOCAL_ONLY',
    contextPackage: overrides?.contextPackage ?? createContextPackage(),
    provider: overrides?.provider ?? createProviderDescriptor(),
    tokenBudget: overrides?.tokenBudget ?? createTokenBudget(),
    requiredCapabilityFlags: overrides?.requiredCapabilityFlags ?? [
      'CONTRACT_VALIDATION',
      'STRUCTURED_JSON_OUTPUT',
    ],
    traceability: {
      traceId: 'trace:llm:invoke:001',
      relationId: 'relation:llm:invoke:001',
      requestId: overrides?.requestId ?? 'llm:request:001',
      contextRequestId: 'ctx:request:001',
      policyVersion: 'ai-privacy-policy/1.0.0',
    },
  }
}

function createTraceability(input: {
  readonly request: Record<string, unknown> | null
  readonly decision: 'accepted' | 'rejected'
  readonly failureCode?: LLMFailureCode
  readonly requestToContext: 'matched' | 'missing' | 'mismatch'
  readonly requestToProtocol: 'matched' | 'missing' | 'mismatch'
  readonly requestToVersion: 'matched' | 'missing' | 'mismatch'
  readonly requestToCapabilities: 'matched' | 'missing' | 'mismatch'
}) {
  const requestTraceability =
    input.request !== null && isRecord(input.request.traceability)
      ? input.request.traceability
      : null
  const contextPackage =
    input.request !== null && isRecord(input.request.contextPackage)
      ? input.request.contextPackage
      : null
  const provider =
    input.request !== null && isRecord(input.request.provider)
      ? input.request.provider
      : null

  const protocolVersion =
    input.request !== null && typeof input.request.protocolVersion === 'number'
      ? input.request.protocolVersion
      : null

  const executionMode =
    input.request !== null &&
    (input.request.executionMode === 'LOCAL_ONLY' || input.request.executionMode === 'EXTERNAL_PROVIDER')
      ? input.request.executionMode
      : null

  return {
    traceId: requestTraceability !== null && isNonEmptyString(requestTraceability.traceId)
      ? requestTraceability.traceId
      : null,
    relationId: requestTraceability !== null && isNonEmptyString(requestTraceability.relationId)
      ? requestTraceability.relationId
      : null,
    requestId: requestTraceability !== null && isNonEmptyString(requestTraceability.requestId)
      ? requestTraceability.requestId
      : null,
    contextRequestId: contextPackage !== null && isNonEmptyString(contextPackage.requestId)
      ? contextPackage.requestId
      : null,
    policyVersion: contextPackage !== null && isNonEmptyString(contextPackage.policyVersion)
      ? contextPackage.policyVersion
      : null,
    protocolVersion: LLM_PROTOCOL_VERSIONS.includes(protocolVersion as LLMProtocolVersion)
      ? protocolVersion as LLMProtocolVersion
      : null,
    executionMode,
    providerId: provider !== null && isNonEmptyString(provider.providerId)
      ? provider.providerId
      : null,
    providerVersion: provider !== null && isNonEmptyString(provider.providerVersion)
      ? provider.providerVersion
      : null,
    decision: input.decision,
    ...(input.failureCode === undefined ? {} : { failureCode: input.failureCode }),
    relation: {
      requestToContext: input.requestToContext,
      requestToProtocol: input.requestToProtocol,
      requestToVersion: input.requestToVersion,
      requestToCapabilities: input.requestToCapabilities,
    },
  }
}

function createContractOnlyAdapter(): LLMAdapterPort {
  function fail(input: {
    readonly request: Record<string, unknown> | null
    readonly code: LLMFailureCode
    readonly message: string
    readonly requestToContext?: 'matched' | 'missing' | 'mismatch'
    readonly requestToProtocol?: 'matched' | 'missing' | 'mismatch'
    readonly requestToVersion?: 'matched' | 'missing' | 'mismatch'
    readonly requestToCapabilities?: 'matched' | 'missing' | 'mismatch'
  }): LLMInvocationResult {
    return {
      ok: false,
      status: 'failure',
      deterministic: true,
      failClosed: true,
      code: input.code,
      message: input.message,
      traceability: createTraceability({
        request: input.request,
        decision: 'rejected',
        failureCode: input.code,
        requestToContext: input.requestToContext ?? 'missing',
        requestToProtocol: input.requestToProtocol ?? 'missing',
        requestToVersion: input.requestToVersion ?? 'missing',
        requestToCapabilities: input.requestToCapabilities ?? 'missing',
      }),
    }
  }

  return {
    invoke(request) {
      if (!isRecord(request)) {
        return fail({
          request: null,
          code: 'INVALID_REQUEST',
          message: 'request must be a non-null object',
        })
      }

      if (!isRecord(request.contextPackage) || !isNonEmptyString(request.contextPackage.requestId)) {
        return fail({
          request,
          code: 'MISSING_CONTEXT_PACKAGE',
          message: 'context package is required',
          requestToContext: 'missing',
          requestToProtocol: 'missing',
          requestToVersion: 'missing',
          requestToCapabilities: 'missing',
        })
      }

      if (request.protocolVersion === undefined || request.protocolVersion === null) {
        return fail({
          request,
          code: 'MISSING_PROTOCOL_VERSION',
          message: 'protocol version is required',
          requestToContext: 'matched',
          requestToProtocol: 'missing',
          requestToVersion: 'missing',
          requestToCapabilities: 'missing',
        })
      }

      if (!LLM_PROTOCOL_VERSIONS.includes(request.protocolVersion as LLMProtocolVersion)) {
        return fail({
          request,
          code: 'UNSUPPORTED_PROTOCOL_VERSION',
          message: 'protocol version is not supported by contract',
          requestToContext: 'matched',
          requestToProtocol: 'mismatch',
          requestToVersion: 'missing',
          requestToCapabilities: 'missing',
        })
      }

      if (!isRecord(request.provider)) {
        return fail({
          request,
          code: 'MISSING_PROVIDER_DESCRIPTOR',
          message: 'provider descriptor is required',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'missing',
          requestToCapabilities: 'missing',
        })
      }

      if (!isNonEmptyString(request.provider.providerVersion)) {
        return fail({
          request,
          code: 'MISSING_PROVIDER_VERSION',
          message: 'provider version is required',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'missing',
          requestToCapabilities: 'missing',
        })
      }

      if (!isRecord(request.provider.capabilities)) {
        return fail({
          request,
          code: 'MISSING_CAPABILITIES',
          message: 'capabilities descriptor is required',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'missing',
        })
      }

      const supportedProtocolVersions = request.provider.capabilities.supportedProtocolVersions
      const supportedExecutionModes = request.provider.capabilities.supportedExecutionModes
      const capabilityFlags = request.provider.capabilities.capabilityFlags

      if (
        !Array.isArray(supportedProtocolVersions) ||
        supportedProtocolVersions.length === 0 ||
        !Array.isArray(supportedExecutionModes) ||
        supportedExecutionModes.length === 0 ||
        !Array.isArray(capabilityFlags)
      ) {
        return fail({
          request,
          code: 'MISSING_CAPABILITIES',
          message: 'capabilities are incomplete',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'missing',
        })
      }

      if (!supportedProtocolVersions.includes(request.protocolVersion as LLMProtocolVersion)) {
        return fail({
          request,
          code: 'INCOMPATIBLE_CAPABILITIES',
          message: 'provider capabilities do not include protocol version',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'mismatch',
        })
      }

      if (!supportedExecutionModes.includes(request.executionMode as LLMExecutionMode)) {
        return fail({
          request,
          code: 'INCOMPATIBLE_EXECUTION_MODE',
          message: 'execution mode is not supported by provider capabilities',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'mismatch',
        })
      }

      const requiredCapabilityFlags = Array.isArray(request.requiredCapabilityFlags)
        ? request.requiredCapabilityFlags
        : []

      if (requiredCapabilityFlags.some((capability) => !capabilityFlags.includes(capability))) {
        return fail({
          request,
          code: 'INCOMPATIBLE_CAPABILITIES',
          message: 'required capabilities are not fully supported',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'mismatch',
        })
      }

      if (!isRecord(request.tokenBudget)) {
        return fail({
          request,
          code: 'TOKEN_BUDGET_INVALID',
          message: 'token budget is required',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'matched',
        })
      }

      const inputLimit = request.tokenBudget.inputTokenLimit
      const outputLimit = request.tokenBudget.outputTokenLimit
      const totalLimit = request.tokenBudget.totalTokenLimit
      const reservedOutput = request.tokenBudget.reservedOutputTokens

      const validBudget =
        isNonNegativeInteger(inputLimit) &&
        isNonNegativeInteger(outputLimit) &&
        isNonNegativeInteger(totalLimit) &&
        isNonNegativeInteger(reservedOutput) &&
        reservedOutput <= outputLimit &&
        totalLimit >= inputLimit + outputLimit

      if (!validBudget) {
        return fail({
          request,
          code: 'TOKEN_BUDGET_INVALID',
          message: 'token budget is inconsistent',
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'matched',
        })
      }

      const traceability = createTraceability({
        request,
        decision: 'accepted',
        requestToContext: 'matched',
        requestToProtocol: 'matched',
        requestToVersion: 'matched',
        requestToCapabilities: 'matched',
      })

      return {
        ok: true,
        status: 'success',
        deterministic: true,
        failClosed: true,
        response: {
          requestId: request.requestId as string,
          providerId: request.provider.providerId as string,
          providerVersion: request.provider.providerVersion as string,
          protocolVersion: request.protocolVersion as LLMProtocolVersion,
          executionMode: request.executionMode as LLMExecutionMode,
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          output: {
            contractState: 'accepted-no-provider-invocation',
          },
          traceability,
        },
        traceability,
      }
    },
  }
}

describe('LLM Adapter Contracts (Milestone 8C)', () => {
  it('contratos JSON-safe', () => {
    const request = createRequest()
    const adapter = createContractOnlyAdapter()
    const success = asSuccess(adapter.invoke(request))

    expect(isJsonSafe(request)).toBe(true)
    expect(isJsonSafe(success)).toBe(true)
    expect(() => JSON.stringify(request)).not.toThrow()
    expect(() => JSON.stringify(success)).not.toThrow()
  })

  it('determinismo', () => {
    const request = createRequest()
    const adapter = createContractOnlyAdapter()

    const first = adapter.invoke(request)
    const second = adapter.invoke(request)

    expect(first).toEqual(second)
  })

  it('ausencia de APIs no deterministas', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/llmAdapterContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Date.now(')).toBe(false)
    expect(source.includes('new Date(')).toBe(false)
    expect(source.includes('Math.random(')).toBe(false)
    expect(source.includes('crypto.randomUUID(')).toBe(false)
  })

  it('failure codes cerrados', () => {
    expect(LLM_FAILURE_CODES).toEqual([
      'INVALID_REQUEST',
      'MISSING_CONTEXT_PACKAGE',
      'MISSING_PROTOCOL_VERSION',
      'UNSUPPORTED_PROTOCOL_VERSION',
      'MISSING_PROVIDER_DESCRIPTOR',
      'MISSING_PROVIDER_VERSION',
      'MISSING_CAPABILITIES',
      'INCOMPATIBLE_CAPABILITIES',
      'INCOMPATIBLE_EXECUTION_MODE',
      'TOKEN_BUDGET_INVALID',
      'INCONSISTENT_INVOCATION_RESULT',
      'INVOCATION_NOT_EXECUTED',
    ])
  })

  it('discriminated unions', () => {
    const adapter = createContractOnlyAdapter()

    const successResult = adapter.invoke(createRequest())
    if (successResult.ok) {
      expect(successResult.status).toBe('success')
      expect(successResult.response.protocolVersion).toBe(1)
    }
    else {
      throw new Error(`unexpected failure: ${successResult.code}`)
    }

    const failureResult = adapter.invoke(null)
    if (!failureResult.ok) {
      expect(failureResult.status).toBe('failure')
      expect(failureResult.code).toBe('INVALID_REQUEST')
    }
    else {
      throw new Error('unexpected success for null request')
    }
  })

  it('compatibilidad de capacidades', () => {
    const adapter = createContractOnlyAdapter()
    const request = createRequest({
      requiredCapabilityFlags: [
        'CONTRACT_VALIDATION',
        'TRACEABILITY_PROPAGATION',
      ],
      provider: createProviderDescriptor({
        capabilities: {
          supportedProtocolVersions: [1],
          supportedExecutionModes: ['LOCAL_ONLY', 'EXTERNAL_PROVIDER'],
          capabilityFlags: ['CONTRACT_VALIDATION'],
          maxInputTokens: 8000,
          maxOutputTokens: 2000,
          supportsDeterministicContracts: true,
          acceptsContextPackageOnly: true,
        },
      }),
    })

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('INCOMPATIBLE_CAPABILITIES')
  })

  it('protocolo faltante', () => {
    const adapter = createContractOnlyAdapter()
    const invalidRequest = {
      ...createRequest(),
    } as Record<string, unknown>
    delete invalidRequest.protocolVersion

    const failure = asFailure(adapter.invoke(invalidRequest as unknown as LLMRequest))
    expect(failure.code).toBe('MISSING_PROTOCOL_VERSION')
  })

  it('protocolo no soportado', () => {
    const adapter = createContractOnlyAdapter()
    const request = {
      ...createRequest(),
      protocolVersion: 99,
    } as unknown as LLMRequest

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('UNSUPPORTED_PROTOCOL_VERSION')
  })

  it('versionado faltante', () => {
    const adapter = createContractOnlyAdapter()
    const request = createRequest({
      provider: createProviderDescriptor({
        providerVersion: '',
      }),
    })

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('MISSING_PROVIDER_VERSION')
  })

  it('capabilities faltantes', () => {
    const adapter = createContractOnlyAdapter()
    const request = {
      ...createRequest(),
      provider: {
        ...createProviderDescriptor(),
        capabilities: undefined,
      },
    } as unknown as LLMRequest

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('MISSING_CAPABILITIES')
  })

  it('modo de ejecucion incompatible', () => {
    const adapter = createContractOnlyAdapter()
    const request = createRequest({
      executionMode: 'EXTERNAL_PROVIDER',
      provider: createProviderDescriptor({
        capabilities: {
          supportedProtocolVersions: [1],
          supportedExecutionModes: ['LOCAL_ONLY'],
          capabilityFlags: [...LLM_CAPABILITY_FLAGS],
          maxInputTokens: 8000,
          maxOutputTokens: 2000,
          supportsDeterministicContracts: true,
          acceptsContextPackageOnly: true,
        },
      }),
    })

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('INCOMPATIBLE_EXECUTION_MODE')
  })

  it('token budget invalido', () => {
    const adapter = createContractOnlyAdapter()
    const request = createRequest({
      tokenBudget: createTokenBudget({
        inputTokenLimit: 1200,
        outputTokenLimit: 600,
        totalTokenLimit: 1000,
        reservedOutputTokens: 100,
      }),
    })

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('TOKEN_BUDGET_INVALID')
  })

  it('adapter recibe solo AIContextPackage', () => {
    const adapter = createContractOnlyAdapter()
    const request = {
      ...createRequest(),
      contextPackage: {
        foo: 'bar',
      },
    } as unknown as LLMRequest

    const failure = asFailure(adapter.invoke(request))
    expect(failure.code).toBe('MISSING_CONTEXT_PACKAGE')
  })

  it('ausencia de acoplamiento prohibido al dominio', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/llmAdapterContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('financialSnapshot')).toBe(false)
    expect(source.includes('FinancialSnapshot')).toBe(false)
    expect(source.includes('KnowledgeCollection')).toBe(false)
    expect(source.includes('InsightRuntime')).toBe(false)
    expect(source.includes('Insight Runtime')).toBe(false)
  })

  it('catalogos de protocolo y modo', () => {
    expect(LLM_PROTOCOL_VERSIONS).toEqual([1])
    expect(LLM_EXECUTION_MODES).toEqual(['LOCAL_ONLY', 'EXTERNAL_PROVIDER'])
  })

  it('ausencia de red', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/llmAdapterContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('fetch(')).toBe(false)
    expect(source.includes('axios')).toBe(false)
    expect(source.includes('HTTP')).toBe(false)
    expect(source.includes('WebSocket')).toBe(false)
  })

  it('ausencia de SDKs IA', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/llmAdapterContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('OpenAI')).toBe(false)
    expect(source.includes('Anthropic')).toBe(false)
    expect(source.includes('Gemini')).toBe(false)
    expect(source.includes('Ollama')).toBe(false)
    expect(source.includes('llama.cpp')).toBe(false)
    expect(source.includes('LM Studio')).toBe(false)
    expect(source.includes('SDK')).toBe(false)
  })

  it('ausencia de prompts', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/llmAdapterContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('prompt')).toBe(false)
    expect(source.includes('chat')).toBe(false)
    expect(source.includes('stream')).toBe(false)
    expect(source.includes('tool')).toBe(false)
    expect(source.includes('embedding')).toBe(false)
    expect(source.includes('RAG')).toBe(false)
  })

  it('ausencia de persistencia', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/llmAdapterContracts.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Dexie')).toBe(false)
    expect(source.includes('indexedDB')).toBe(false)
    expect(source.includes('IndexedDB')).toBe(false)
    expect(source.includes('localStorage')).toBe(false)
    expect(source.includes('sessionStorage')).toBe(false)
  })
})
