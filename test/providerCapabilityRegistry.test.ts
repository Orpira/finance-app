import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { AIPurpose } from '../src/intelligence/ai-foundation/aiFoundationContracts'
import type {
  LLMExecutionMode,
  LLMProtocolVersion,
} from '../src/intelligence/ai-foundation/llmAdapterContracts'
import type {
  AdapterResolutionRequest,
  AdapterResolutionResult,
  LLMCapabilitySet,
  LLMDeclarativeCapability,
  LLMProviderDescriptor,
} from '../src/intelligence/ai-foundation/providerCapabilityRegistryContracts'
import {
  createLLMCapabilityResolver,
  createLLMProviderRegistry,
} from '../src/intelligence/ai-foundation/providerCapabilityRegistry'

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

function asSuccess(result: AdapterResolutionResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success but got ${result.code}`)
  }

  return result
}

function asFailure(result: AdapterResolutionResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure')
  }

  return result
}

function createCapabilitySet(overrides?: {
  readonly protocolVersions?: readonly LLMProtocolVersion[]
  readonly executionModes?: readonly LLMExecutionMode[]
  readonly declaredCapabilities?: readonly LLMDeclarativeCapability[]
}): LLMCapabilitySet {
  return {
    protocolVersions: overrides?.protocolVersions ?? [1],
    executionModes: overrides?.executionModes ?? ['LOCAL_ONLY'],
    declaredCapabilities: overrides?.declaredCapabilities ?? [
      'TEXT_GENERATION',
      'LOCAL_EXECUTION',
      'TOKEN_ACCOUNTING_SUPPORTED',
    ],
    supportsDeterministicResolution: true,
    failClosed: true,
  }
}

function createProviderDescriptor(overrides?: {
  readonly providerId?: string
  readonly providerVersion?: string
  readonly protocolVersion?: LLMProtocolVersion
  readonly supportedPurposes?: readonly AIPurpose[]
  readonly capabilitySet?: LLMCapabilitySet
}): LLMProviderDescriptor {
  return {
    providerId: overrides?.providerId ?? 'provider.local.alpha',
    providerVersion: overrides?.providerVersion ?? '1.0.0',
    protocolVersion: overrides?.protocolVersion ?? 1,
    supportedPurposes: overrides?.supportedPurposes ?? ['EXPLAIN_INSIGHT'],
    capabilitySet: overrides?.capabilitySet ?? createCapabilitySet(),
  }
}

function createRequest(overrides?: {
  readonly requestId?: string
  readonly purpose?: AIPurpose
  readonly protocolVersion?: LLMProtocolVersion
  readonly executionMode?: LLMExecutionMode
  readonly requiredCapabilities?: readonly LLMDeclarativeCapability[]
  readonly requiredProviderVersion?: string
}): AdapterResolutionRequest {
  const request: AdapterResolutionRequest = {
    requestId: overrides?.requestId ?? 'resolution-request:001',
    purpose: overrides?.purpose ?? 'EXPLAIN_INSIGHT',
    protocolVersion: overrides?.protocolVersion ?? 1,
    executionMode: overrides?.executionMode ?? 'LOCAL_ONLY',
    requiredCapabilities: overrides?.requiredCapabilities ?? [
      'TEXT_GENERATION',
      'LOCAL_EXECUTION',
    ],
  }

  if (overrides?.requiredProviderVersion !== undefined) {
    return {
      ...request,
      requiredProviderVersion: overrides.requiredProviderVersion,
    }
  }

  return request
}

describe('Provider Capability Registry (Milestone 8D)', () => {
  it('registro vacio', () => {
    const registry = createLLMProviderRegistry({ providers: [] })
    const resolver = createLLMCapabilityResolver()

    const failure = asFailure(resolver.resolve(createRequest(), registry))

    expect(failure.code).toBe('EMPTY_REGISTRY')
  })

  it('provider compatible', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.local.beta',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'TEXT_GENERATION',
              'STRUCTURED_OUTPUT',
              'LOCAL_EXECUTION',
              'TOKEN_ACCOUNTING_SUPPORTED',
            ],
          }),
        }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const success = asSuccess(
      resolver.resolve(
        createRequest({
          requiredCapabilities: [
            'TEXT_GENERATION',
            'STRUCTURED_OUTPUT',
            'LOCAL_EXECUTION',
          ],
        }),
        registry,
      ),
    )

    expect(success.provider.providerId).toBe('provider.local.beta')
  })

  it('provider incompatible', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.local.gamma',
          supportedPurposes: ['DIAGNOSTIC_ANALYSIS'],
          capabilitySet: createCapabilitySet({
            declaredCapabilities: ['TEXT_GENERATION', 'LOCAL_EXECUTION'],
          }),
        }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const failure = asFailure(
      resolver.resolve(
        createRequest({ requiredCapabilities: [] }),
        registry,
      ),
    )

    expect(failure.code).toBe('PROVIDER_INCOMPATIBLE')
  })

  it('capacidades faltantes', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.local.delta',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: ['TEXT_GENERATION', 'LOCAL_EXECUTION'],
          }),
        }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const failure = asFailure(
      resolver.resolve(
        createRequest({
          requiredCapabilities: ['TEXT_GENERATION', 'STRUCTURED_OUTPUT'],
        }),
        registry,
      ),
    )

    expect(failure.code).toBe('NO_CAPABILITY_MATCH')
  })

  it('multiples providers', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.zeta',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: ['TEXT_GENERATION'],
          }),
        }),
        createProviderDescriptor({
          providerId: 'provider.beta',
          providerVersion: '2.0.0',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'TEXT_GENERATION',
              'LOCAL_EXECUTION',
              'STRUCTURED_OUTPUT',
            ],
          }),
        }),
        createProviderDescriptor({
          providerId: 'provider.alpha',
          providerVersion: '1.0.0',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'TEXT_GENERATION',
              'LOCAL_EXECUTION',
              'STRUCTURED_OUTPUT',
            ],
          }),
        }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const success = asSuccess(
      resolver.resolve(
        createRequest({
          requiredCapabilities: [
            'TEXT_GENERATION',
            'STRUCTURED_OUTPUT',
          ],
        }),
        registry,
      ),
    )

    expect(success.provider.providerId).toBe('provider.alpha')
  })

  it('seleccion determinista', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.local.epsilon',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'TEXT_GENERATION',
              'STRUCTURED_OUTPUT',
              'LOCAL_EXECUTION',
            ],
          }),
        }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const request = createRequest({
      requiredCapabilities: ['TEXT_GENERATION', 'STRUCTURED_OUTPUT'],
    })

    const first = resolver.resolve(request, registry)
    const second = resolver.resolve(request, registry)

    expect(first).toEqual(second)
  })

  it('orden canonico', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.b',
          providerVersion: '1.0.0',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'LOCAL_EXECUTION',
              'TEXT_GENERATION',
              'TEXT_GENERATION',
              'STRUCTURED_OUTPUT',
            ],
          }),
        }),
        createProviderDescriptor({
          providerId: 'provider.a',
          providerVersion: '2.0.0',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'STRUCTURED_OUTPUT',
              'LOCAL_EXECUTION',
              'TEXT_GENERATION',
            ],
          }),
        }),
      ],
    })

    expect(registry.providers.map((provider) => provider.providerId)).toEqual([
      'provider.a',
      'provider.b',
    ])

    expect(registry.providers[0]?.capabilitySet.declaredCapabilities).toEqual([
      'TEXT_GENERATION',
      'STRUCTURED_OUTPUT',
      'LOCAL_EXECUTION',
    ])
  })

  it('JSON-safe', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.local.zeta',
          capabilitySet: createCapabilitySet({
            declaredCapabilities: [
              'TEXT_GENERATION',
              'LOCAL_EXECUTION',
            ],
          }),
        }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const result = resolver.resolve(createRequest({ requiredCapabilities: [] }), registry)

    expect(isJsonSafe(registry)).toBe(true)
    expect(isJsonSafe(result)).toBe(true)
    expect(() => JSON.stringify(registry)).not.toThrow()
    expect(() => JSON.stringify(result)).not.toThrow()
  })

  it('readonly', () => {
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({ providerId: 'provider.readonly' }),
      ],
    })

    const resolver = createLLMCapabilityResolver()
    const success = asSuccess(
      resolver.resolve(createRequest({ requiredCapabilities: [] }), registry),
    )

    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.providers)).toBe(true)
    expect(Object.isFrozen(success)).toBe(true)

    expect(() => {
      const mutableProviders = registry.providers as LLMProviderDescriptor[]
      mutableProviders.push(createProviderDescriptor({ providerId: 'provider.mutated' }))
    }).toThrow()
  })

  it('fail-closed', () => {
    const resolver = createLLMCapabilityResolver()
    const failure = asFailure(
      resolver.resolve(
        null,
        createLLMProviderRegistry({
          providers: [createProviderDescriptor({ providerId: 'provider.fail.closed' })],
        }),
      ),
    )

    expect(failure.status).toBe('failure')
    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
  })

  it('protocolo incompatible', () => {
    const resolver = createLLMCapabilityResolver()
    const registry = createLLMProviderRegistry({
      providers: [createProviderDescriptor({ providerId: 'provider.protocol' })],
    })

    const failure = asFailure(
      resolver.resolve(
        createRequest({
          protocolVersion: 99 as unknown as LLMProtocolVersion,
        }),
        registry,
      ),
    )

    expect(failure.code).toBe('INVALID_REQUEST')
  })

  it('execution mode incompatible', () => {
    const resolver = createLLMCapabilityResolver()
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.mode.local',
          capabilitySet: createCapabilitySet({
            executionModes: ['LOCAL_ONLY'],
            declaredCapabilities: ['TEXT_GENERATION', 'LOCAL_EXECUTION'],
          }),
        }),
      ],
    })

    const failure = asFailure(
      resolver.resolve(
        createRequest({
          executionMode: 'EXTERNAL_PROVIDER',
          requiredCapabilities: ['TEXT_GENERATION'],
        }),
        registry,
      ),
    )

    expect(failure.code).toBe('EXECUTION_MODE_INCOMPATIBLE')
  })

  it('version incompatible', () => {
    const resolver = createLLMCapabilityResolver()
    const registry = createLLMProviderRegistry({
      providers: [
        createProviderDescriptor({
          providerId: 'provider.version.one',
          providerVersion: '1.0.0',
        }),
      ],
    })

    const failure = asFailure(
      resolver.resolve(
        createRequest({
          requiredCapabilities: [],
          requiredProviderVersion: '9.0.0',
        }),
        registry,
      ),
    )

    expect(failure.code).toBe('VERSION_INCOMPATIBLE')
  })

  it('ausencia de APIs no deterministas', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistry.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Date.now(')).toBe(false)
    expect(source.includes('new Date(')).toBe(false)
    expect(source.includes('Math.random(')).toBe(false)
    expect(source.includes('crypto.randomUUID(')).toBe(false)
  })

  it('ausencia de red', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistryContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceResolver = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistry.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('fetch(')).toBe(false)
    expect(sourceResolver.includes('fetch(')).toBe(false)
    expect(sourceContracts.includes('axios')).toBe(false)
    expect(sourceResolver.includes('axios')).toBe(false)
    expect(sourceContracts.includes('HTTP')).toBe(false)
    expect(sourceResolver.includes('HTTP')).toBe(false)
    expect(sourceContracts.includes('WebSocket')).toBe(false)
    expect(sourceResolver.includes('WebSocket')).toBe(false)
  })

  it('ausencia de SDK IA', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistryContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceResolver = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistry.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('OpenAI')).toBe(false)
    expect(sourceResolver.includes('OpenAI')).toBe(false)
    expect(sourceContracts.includes('Anthropic')).toBe(false)
    expect(sourceResolver.includes('Anthropic')).toBe(false)
    expect(sourceContracts.includes('Gemini')).toBe(false)
    expect(sourceResolver.includes('Gemini')).toBe(false)
    expect(sourceContracts.includes('Ollama')).toBe(false)
    expect(sourceResolver.includes('Ollama')).toBe(false)
    expect(sourceContracts.includes('LM Studio')).toBe(false)
    expect(sourceResolver.includes('LM Studio')).toBe(false)
    expect(sourceContracts.includes('SDK')).toBe(false)
    expect(sourceResolver.includes('SDK')).toBe(false)
  })

  it('ausencia de prompts y persistencia', () => {
    const sourceContracts = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistryContracts.ts', import.meta.url),
      'utf8',
    )
    const sourceResolver = readFileSync(
      new URL('../src/intelligence/ai-foundation/providerCapabilityRegistry.ts', import.meta.url),
      'utf8',
    )

    expect(sourceContracts.includes('prompt')).toBe(false)
    expect(sourceResolver.includes('prompt')).toBe(false)
    expect(sourceContracts.includes('chat')).toBe(false)
    expect(sourceResolver.includes('chat')).toBe(false)
    expect(sourceContracts.includes('Dexie')).toBe(false)
    expect(sourceResolver.includes('Dexie')).toBe(false)
    expect(sourceContracts.includes('indexedDB')).toBe(false)
    expect(sourceResolver.includes('indexedDB')).toBe(false)
    expect(sourceContracts.includes('IndexedDB')).toBe(false)
    expect(sourceResolver.includes('IndexedDB')).toBe(false)
    expect(sourceContracts.includes('localStorage')).toBe(false)
    expect(sourceResolver.includes('localStorage')).toBe(false)
    expect(sourceContracts.includes('sessionStorage')).toBe(false)
    expect(sourceResolver.includes('sessionStorage')).toBe(false)
  })
})
