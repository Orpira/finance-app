import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type {
  AIPrivacyAuthorizationRequest,
  AIPrivacyAuthorizationResult,
  AIAuthorizedRequestEnvelope,
} from '../src/intelligence/ai-foundation/aiFoundationContracts'
import type {
  AIPrivacyBoundaryPort,
} from '../src/intelligence/ai-foundation/aiPrivacyBoundaryInterfaces'
import type {
  LLMAdapterPort,
  LLMCapabilityFlag,
  LLMFailureCode,
  LLMInvocationResult,
  LLMProtocolVersion,
  LLMRequest,
} from '../src/intelligence/ai-foundation/llmAdapterContracts'
import type {
  LLMDeclarativeCapability,
} from '../src/intelligence/ai-foundation/providerCapabilityRegistryContracts'
import type {
  AdapterCapabilityAssertion,
  AdapterFixture,
  AdapterValidationResult,
} from '../src/intelligence/ai-foundation/providerComplianceSuiteContracts'
import {
  ADAPTER_COMPLIANCE_FAILURE_CODES,
} from '../src/intelligence/ai-foundation/providerComplianceSuiteContracts'
import {
  createAdapterCompliancePort,
  createDefaultAdapterComplianceSuite,
} from '../src/intelligence/ai-foundation/providerComplianceSuite'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonSafe(
  value: unknown,
  ancestors: ReadonlySet<object> = new Set(),
): boolean {
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

function asFailureResult(result: LLMInvocationResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure invocation result')
  }

  return result
}

function createContextPackage() {
  return {
    requestId: 'ctx:8e:001',
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: 'LOCAL_ONLY',
    policyVersion: 'ai-privacy-policy/1.0.0',
    protocolVersion: 1,
    orderedContextFragments: [
      {
        referenceId: 'ctx-fragment:8e:01',
        descriptorType: 'InsightSummaryReference',
        category: 'INSIGHT_SUMMARY',
        classification: 'PERSONAL',
        data: {
          summaryCode: 'summary.8e',
          decisionState: 'informative',
        },
      },
    ],
    appliedRedactions: [
      {
        referenceId: 'ctx-fragment:8e:01',
        path: 'data.decisionState',
        strategy: 'MASK',
        reasonCode: 'mask.personal',
      },
    ],
    appliedMinimization: [
      {
        referenceId: 'ctx-fragment:8e:01',
        path: 'data.debugInfo',
        reasonCode: 'drop.debug',
      },
    ],
    traceability: {
      traceId: 'trace:8e:ctx:001',
      relationId: 'relation:8e:ctx:001',
      requestId: 'ctx:8e:001',
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
  } as const
}

function createRequest(overrides?: {
  readonly protocolVersion?: LLMProtocolVersion
  readonly providerVersion?: string
  readonly capabilityFlags?: readonly LLMCapabilityFlag[]
  readonly supportedProtocolVersions?: readonly LLMProtocolVersion[]
}): LLMRequest {
  const protocolVersion = overrides?.protocolVersion ?? 1

  return {
    requestId: 'llm:8e:request:001',
    protocolVersion,
    executionMode: 'LOCAL_ONLY',
    contextPackage: createContextPackage(),
    provider: {
      providerId: 'provider.compliance.stub',
      providerVersion: overrides?.providerVersion ?? '1.0.0',
      protocolVersion,
      capabilities: {
        supportedProtocolVersions:
          overrides?.supportedProtocolVersions ?? [protocolVersion],
        supportedExecutionModes: ['LOCAL_ONLY'],
        capabilityFlags: overrides?.capabilityFlags ?? [
          'CONTRACT_VALIDATION',
          'SYNC_INVOCATION',
          'STRUCTURED_JSON_OUTPUT',
          'TRACEABILITY_PROPAGATION',
        ],
        maxInputTokens: 2048,
        maxOutputTokens: 512,
        supportsDeterministicContracts: true,
        acceptsContextPackageOnly: true,
      },
    },
    tokenBudget: {
      inputTokenLimit: 800,
      outputTokenLimit: 200,
      totalTokenLimit: 1000,
      reservedOutputTokens: 50,
    },
    requiredCapabilityFlags: [
      'CONTRACT_VALIDATION',
      'STRUCTURED_JSON_OUTPUT',
    ],
    traceability: {
      traceId: 'trace:8e:invoke:001',
      relationId: 'relation:8e:invoke:001',
      requestId: 'llm:8e:request:001',
      contextRequestId: 'ctx:8e:001',
      policyVersion: 'ai-privacy-policy/1.0.0',
    },
  }
}

function createAuthorizedEnvelope(): AIAuthorizedRequestEnvelope {
  const context = createContextPackage()

  return {
    requestId: context.requestId,
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: context.processingMode,
    authorizedDataReferences: [
      {
        referenceId: 'ctx-fragment:8e:01',
        category: 'INSIGHT_SUMMARY',
        classification: 'PERSONAL',
        selector: 'insight.summary.current',
      },
    ],
    authorizedCategories: ['INSIGHT_SUMMARY'],
    maxAuthorizedClassification: 'PERSONAL',
    policy: {
      policyId: 'ai-privacy-default-policy',
      policyVersion: context.policyVersion,
      protocolVersion: context.protocolVersion,
    },
    consent: null,
    requirements: {
      minimizationRequired: true,
      minimizationApplied: true,
      minimizationStrategyCodes: ['drop.debug'],
      redactionRequired: true,
      redactionApplied: true,
      redactionStrategyCodes: ['mask.personal'],
      contextBuilderConstraints: [
        {
          code: 'context.request.match',
          requirement: 'context request id must match authorization envelope',
        },
      ],
    },
    governance: {
      retention: 'EPHEMERAL',
      training: 'PROHIBITED',
      logging: 'METADATA_ONLY',
    },
    traceability: {
      traceId: 'trace:8e:privacy:001',
      relationId: 'relation:8e:privacy:001',
      requestId: context.requestId,
      policyId: 'ai-privacy-default-policy',
      policyVersion: context.policyVersion,
      consentId: null,
      purpose: context.purpose,
      processingMode: context.processingMode,
      categories: ['INSIGHT_SUMMARY'],
      maxClassification: 'PERSONAL',
      decision: 'authorized',
      relation: {
        requestToPolicy: 'matched',
        requestToConsent: 'not-required',
      },
    },
  }
}

function createPrivacyBoundary(
  result: AIPrivacyAuthorizationResult,
): AIPrivacyBoundaryPort {
  return {
    authorize() {
      return result
    },
  }
}

function createPrivacySuccessBoundary(): AIPrivacyBoundaryPort {
  return createPrivacyBoundary({
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    envelope: createAuthorizedEnvelope(),
    traceability: createAuthorizedEnvelope().traceability,
  })
}

function createPrivacyFailureBoundary(): AIPrivacyBoundaryPort {
  return createPrivacyBoundary({
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    code: 'INVALID_REQUEST',
    message: 'authorization denied by fixture',
    traceability: {
      traceId: 'trace:8e:privacy:001',
      relationId: 'relation:8e:privacy:001',
      requestId: 'ctx:8e:001',
      policyId: 'ai-privacy-default-policy',
      policyVersion: 'ai-privacy-policy/1.0.0',
      consentId: null,
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
      categories: ['INSIGHT_SUMMARY'],
      maxClassification: 'PERSONAL',
      decision: 'rejected',
      failureCode: 'INVALID_REQUEST',
      relation: {
        requestToPolicy: 'matched',
        requestToConsent: 'not-required',
      },
    },
  })
}

function createCompliantAdapter(): LLMAdapterPort {
  function fail(code: LLMFailureCode, message: string): LLMInvocationResult {
    return {
      ok: false,
      status: 'failure',
      deterministic: true,
      failClosed: true,
      code,
      message,
      traceability: {
        traceId: 'trace:8e:invoke:001',
        relationId: 'relation:8e:invoke:001',
        requestId: 'llm:8e:request:001',
        contextRequestId: 'ctx:8e:001',
        policyVersion: 'ai-privacy-policy/1.0.0',
        protocolVersion: 1,
        executionMode: 'LOCAL_ONLY',
        providerId: 'provider.compliance.stub',
        providerVersion: '1.0.0',
        decision: 'rejected',
        failureCode: code,
        relation: {
          requestToContext: 'matched',
          requestToProtocol: 'matched',
          requestToVersion: 'matched',
          requestToCapabilities: 'matched',
        },
      },
    }
  }

  return {
    invoke(request) {
      if (!isRecord(request)) {
        return fail('INVALID_REQUEST', 'request must be an object')
      }

      if (!isRecord(request.contextPackage) || !isRecord(request.contextPackage.traceability)) {
        return fail('MISSING_CONTEXT_PACKAGE', 'context package is required')
      }

      if (!isRecord(request.provider) || !isRecord(request.provider.capabilities)) {
        return fail('MISSING_CAPABILITIES', 'provider capabilities are required')
      }

      if (!Array.isArray(request.requiredCapabilityFlags)) {
        return fail('INCOMPATIBLE_CAPABILITIES', 'required flags must be declared')
      }

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
          executionMode: request.executionMode as LLMRequest['executionMode'],
          tokenUsage: {
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
          },
          output: {
            contractState: 'validated-only',
          },
          traceability: {
            traceId: 'trace:8e:invoke:001',
            relationId: 'relation:8e:invoke:001',
            requestId: request.requestId as string,
            contextRequestId: request.contextPackage.requestId as string,
            policyVersion: request.contextPackage.policyVersion as string,
            protocolVersion: request.protocolVersion as LLMProtocolVersion,
            executionMode: request.executionMode as LLMRequest['executionMode'],
            providerId: request.provider.providerId as string,
            providerVersion: request.provider.providerVersion as string,
            decision: 'accepted',
            relation: {
              requestToContext: 'matched',
              requestToProtocol: 'matched',
              requestToVersion: 'matched',
              requestToCapabilities: 'matched',
            },
          },
        },
        traceability: {
          traceId: 'trace:8e:invoke:001',
          relationId: 'relation:8e:invoke:001',
          requestId: request.requestId as string,
          contextRequestId: request.contextPackage.requestId as string,
          policyVersion: request.contextPackage.policyVersion as string,
          protocolVersion: request.protocolVersion as LLMProtocolVersion,
          executionMode: request.executionMode as LLMRequest['executionMode'],
          providerId: request.provider.providerId as string,
          providerVersion: request.provider.providerVersion as string,
          decision: 'accepted',
          relation: {
            requestToContext: 'matched',
            requestToProtocol: 'matched',
            requestToVersion: 'matched',
            requestToCapabilities: 'matched',
          },
        },
      }
    },
  }
}

function createInvalidContractAdapter(): LLMAdapterPort {
  return {
    invoke() {
      return {
        ok: true,
        status: 'success',
        deterministic: true,
        failClosed: true,
      } as unknown as LLMInvocationResult
    },
  }
}

function createAssertion(overrides?: {
  readonly protocolVersion?: LLMProtocolVersion
  readonly requiredProviderVersion?: string
  readonly requiredCapabilityFlags?: readonly LLMCapabilityFlag[]
  readonly requiredDeclarativeCapabilities?: readonly LLMDeclarativeCapability[]
}): AdapterCapabilityAssertion {
  return {
    protocolVersion: overrides?.protocolVersion ?? 1,
    executionMode: 'LOCAL_ONLY',
    ...(overrides?.requiredProviderVersion === undefined
      ? {}
      : { requiredProviderVersion: overrides.requiredProviderVersion }),
    requiredCapabilityFlags: overrides?.requiredCapabilityFlags ?? [
      'CONTRACT_VALIDATION',
      'STRUCTURED_JSON_OUTPUT',
    ],
    requiredDeclarativeCapabilities:
      overrides?.requiredDeclarativeCapabilities ?? [
        'TEXT_GENERATION',
        'LOCAL_EXECUTION',
      ],
    requireDeterministicContracts: true,
    requireContextPackageOnly: true,
    requireFailClosed: true,
  }
}

function createFixture(overrides?: {
  readonly fixtureId?: string
  readonly adapter?: LLMAdapterPort
  readonly privacyBoundary?: AIPrivacyBoundaryPort
  readonly request?: LLMRequest
  readonly capabilityAssertion?: AdapterCapabilityAssertion
  readonly declaredCapabilities?: readonly LLMDeclarativeCapability[]
  readonly allowedFailureCodes?: readonly LLMFailureCode[]
}): AdapterFixture {
  const request = overrides?.request ?? createRequest()

  return {
    fixtureId: overrides?.fixtureId ?? 'fixture:8e:valid:001',
    privacyBoundary: overrides?.privacyBoundary ?? createPrivacySuccessBoundary(),
    privacyRequest: {
      requestId: 'privacy:8e:request:001',
      protocolVersion: 1,
      purpose: request.contextPackage.purpose,
      processingMode: request.contextPackage.processingMode,
      dataReferences: [
        {
          referenceId: 'ctx-fragment:8e:01',
          category: 'INSIGHT_SUMMARY',
          classification: 'PERSONAL',
          selector: 'insight.summary.current',
        },
      ],
      policy: undefined,
      consent: undefined,
      retention: 'EPHEMERAL',
      training: 'PROHIBITED',
      logging: 'METADATA_ONLY',
      minimization: {
        applied: true,
        strategyCodes: ['drop.debug'],
      },
      redaction: {
        applied: true,
        strategyCodes: ['mask.personal'],
      },
      traceability: {
        traceId: 'trace:8e:privacy:001',
        relationId: 'relation:8e:privacy:001',
        requestId: 'privacy:8e:request:001',
        policyId: 'ai-privacy-default-policy',
        policyVersion: 'ai-privacy-policy/1.0.0',
        consentId: null,
        purpose: request.contextPackage.purpose,
        processingMode: request.contextPackage.processingMode,
        dataCategories: ['INSIGHT_SUMMARY'],
      },
      contextBuilderConstraints: [
        {
          code: 'context.request.match',
          requirement: 'context request id must match authorization envelope',
        },
      ],
    } as unknown as AIPrivacyAuthorizationRequest,
    adapter: overrides?.adapter ?? createCompliantAdapter(),
    request,
    capabilityAssertion: overrides?.capabilityAssertion ?? createAssertion(),
    declaredCapabilities: overrides?.declaredCapabilities ?? [
      'TEXT_GENERATION',
      'STRUCTURED_OUTPUT',
      'LOCAL_EXECUTION',
      'TOKEN_ACCOUNTING_SUPPORTED',
    ],
    allowedFailureCodes: overrides?.allowedFailureCodes ?? [
      'INVALID_REQUEST',
      'MISSING_CONTEXT_PACKAGE',
    ],
  }
}

function firstFailureCode(results: readonly AdapterValidationResult[]): string | null {
  const failure = results.find((entry) => !entry.passed)
  return failure?.failure?.code ?? null
}

describe('Provider Compliance Suite (Milestone 8E)', () => {
  it('adaptador valido', () => {
    const suite = createDefaultAdapterComplianceSuite()
    const port = createAdapterCompliancePort({ suite })
    const report = port.runCompliance(createFixture())

    expect(report.ok).toBe(true)
    expect(report.status).toBe('success')
    expect(report.failures).toHaveLength(0)
    expect(report.summary.failedRules).toBe(0)
  })

  it('adaptador incompatible', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(
      createFixture({
        adapter: createInvalidContractAdapter(),
      }),
    )

    expect(report.ok).toBe(false)
    expect(report.summary.failedRules).toBeGreaterThan(0)
    expect([
      'CONTEXT_PACKAGE_ONLY_VIOLATION',
      'INVALID_INVOCATION_RESULT',
    ]).toContain(firstFailureCode(report.results))
  })

  it('version incompatible', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(
      createFixture({
        capabilityAssertion: createAssertion({
          requiredProviderVersion: '9.9.9',
        }),
      }),
    )

    expect(report.ok).toBe(false)
    expect(report.failures.some((failure) => {
      return failure.code === 'PROVIDER_VERSION_INCOMPATIBLE'
    })).toBe(true)
  })

  it('protocolo incompatible', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(
      createFixture({
        request: createRequest({
          supportedProtocolVersions: [],
        }),
      }),
    )

    expect(report.ok).toBe(false)
    expect(report.failures.some((failure) => {
      return failure.code === 'PROTOCOL_VERSION_INCOMPATIBLE'
    })).toBe(true)
  })

  it('capacidades inconsistentes', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(
      createFixture({
        request: createRequest({
          capabilityFlags: ['CONTRACT_VALIDATION'],
        }),
        capabilityAssertion: createAssertion({
          requiredCapabilityFlags: [
            'CONTRACT_VALIDATION',
            'TRACEABILITY_PROPAGATION',
          ],
        }),
      }),
    )

    expect(report.ok).toBe(false)
    expect(report.failures.some((failure) => {
      return failure.code === 'CAPABILITY_ASSERTION_FAILED'
    })).toBe(true)
  })

  it('failure codes cerrados', () => {
    expect(ADAPTER_COMPLIANCE_FAILURE_CODES).toEqual([
      'INVALID_FIXTURE',
      'INVALID_SCENARIO',
      'PRIVACY_BOUNDARY_VIOLATION',
      'CONTEXT_PACKAGE_ONLY_VIOLATION',
      'ADAPTER_PORT_MISSING',
      'CAPABILITY_ASSERTION_FAILED',
      'FAIL_CLOSED_VIOLATION',
      'INVALID_INVOCATION_RESULT',
      'PROTOCOL_VERSION_INCOMPATIBLE',
      'PROVIDER_VERSION_INCOMPATIBLE',
      'DETERMINISM_VIOLATION',
      'INCONSISTENT_VALIDATION_STATE',
    ])
  })

  it('JSON-safe', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(createFixture())

    expect(isJsonSafe(report)).toBe(true)
    expect(() => JSON.stringify(report)).not.toThrow()
  })

  it('readonly', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(createFixture())

    expect(Object.isFrozen(report)).toBe(true)
    expect(Object.isFrozen(report.results)).toBe(true)
    expect(Object.isFrozen(report.failures)).toBe(true)

    expect(() => {
      const mutableResults = report.results as AdapterValidationResult[]
      mutableResults.push({
        ruleId: 'ADAPTER_PORT_IMPLEMENTED',
        passed: true,
      })
    }).toThrow()
  })

  it('determinismo', () => {
    const port = createAdapterCompliancePort()
    const fixture = createFixture()

    const first = port.runCompliance(fixture)
    const second = port.runCompliance(fixture)

    expect(first).toEqual(second)
  })

  it('privacy boundary rechaza', () => {
    const port = createAdapterCompliancePort()
    const report = port.runCompliance(
      createFixture({
        privacyBoundary: createPrivacyFailureBoundary(),
      }),
    )

    expect(report.ok).toBe(false)
    expect(report.failures.some((failure) => {
      return failure.code === 'PRIVACY_BOUNDARY_VIOLATION'
    })).toBe(true)
  })

  it('fail-closed en request nulo', () => {
    const adapter = createCompliantAdapter()
    const result = adapter.invoke(null)
    const failure = asFailureResult(result)

    expect(failure.code).toBe('INVALID_REQUEST')
    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
  })

  it('ausencia de APIs no deterministas', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuiteContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceSuite = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuite.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('Date.now(')).toBe(false)
    expect(sourceSuite.includes('Date.now(')).toBe(false)
    expect(sourceContracts.includes('new Date(')).toBe(false)
    expect(sourceSuite.includes('new Date(')).toBe(false)
    expect(sourceContracts.includes('Math.random(')).toBe(false)
    expect(sourceSuite.includes('Math.random(')).toBe(false)
    expect(sourceContracts.includes('crypto.randomUUID(')).toBe(false)
    expect(sourceSuite.includes('crypto.randomUUID(')).toBe(false)
  })

  it('ausencia de red', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuiteContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceSuite = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuite.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('fetch(')).toBe(false)
    expect(sourceSuite.includes('fetch(')).toBe(false)
    expect(sourceContracts.includes('axios')).toBe(false)
    expect(sourceSuite.includes('axios')).toBe(false)
    expect(sourceContracts.includes('HTTP')).toBe(false)
    expect(sourceSuite.includes('HTTP')).toBe(false)
  })

  it('ausencia de SDK', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuiteContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceSuite = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuite.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('OpenAI')).toBe(false)
    expect(sourceSuite.includes('OpenAI')).toBe(false)
    expect(sourceContracts.includes('Anthropic')).toBe(false)
    expect(sourceSuite.includes('Anthropic')).toBe(false)
    expect(sourceContracts.includes('Gemini')).toBe(false)
    expect(sourceSuite.includes('Gemini')).toBe(false)
    expect(sourceContracts.includes('Ollama')).toBe(false)
    expect(sourceSuite.includes('Ollama')).toBe(false)
    expect(sourceContracts.includes('SDK')).toBe(false)
    expect(sourceSuite.includes('SDK')).toBe(false)
  })

  it('ausencia de prompts y persistencia', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuiteContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceSuite = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerComplianceSuite.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('prompt')).toBe(false)
    expect(sourceSuite.includes('prompt')).toBe(false)
    expect(sourceContracts.includes('chat')).toBe(false)
    expect(sourceSuite.includes('chat')).toBe(false)
    expect(sourceContracts.includes('Dexie')).toBe(false)
    expect(sourceSuite.includes('Dexie')).toBe(false)
    expect(sourceContracts.includes('IndexedDB')).toBe(false)
    expect(sourceSuite.includes('IndexedDB')).toBe(false)
    expect(sourceContracts.includes('localStorage')).toBe(false)
    expect(sourceSuite.includes('localStorage')).toBe(false)
    expect(sourceContracts.includes('sessionStorage')).toBe(false)
    expect(sourceSuite.includes('sessionStorage')).toBe(false)
  })
})
