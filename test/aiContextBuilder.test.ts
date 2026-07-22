import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type {
  AIPrivacyAuthorizationRequest,
  AIPrivacyAuthorizationResult,
  AIAuthorizedRequestEnvelope,
  AIDataCategory,
} from '../src/intelligence/ai-foundation/aiFoundationContracts'
import {
  createAIPrivacyBoundary,
} from '../src/intelligence/ai-foundation/aiPrivacyBoundary'
import {
  createDefaultAIPrivacyPolicy,
} from '../src/intelligence/ai-foundation/aiPrivacyPolicy'
import {
  createAIContextBuilder,
} from '../src/intelligence/ai-foundation/aiContextBuilder'
import type {
  AIContextBuildResult,
  AIContextSourceDescriptor,
  ContextSourceResolverPort,
} from '../src/intelligence/ai-foundation/aiContextBuilderContracts'

function asAuthorizedEnvelope(result: AIPrivacyAuthorizationResult): AIAuthorizedRequestEnvelope {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected authorized envelope but got ${result.code}`)
  }

  return result.envelope
}

function asFailure(result: AIContextBuildResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure result')
  }

  return result
}

function asSuccess(result: AIContextBuildResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success result but got ${result.code}`)
  }

  return result
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
    return value.every((item) => isJsonSafe(item, ancestors))
  }

  if (typeof value !== 'object') {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  const nextAncestors = new Set(ancestors)
  nextAncestors.add(value)

  for (const item of Object.values(value as Record<string, unknown>)) {
    if (!isJsonSafe(item, nextAncestors)) {
      return false
    }
  }

  return true
}

function createAuthorizationRequest(): AIPrivacyAuthorizationRequest {
  const policy = createDefaultAIPrivacyPolicy()

  const dataReferences = [
    {
      referenceId: 'ref:insight-summary:01',
      category: 'INSIGHT_SUMMARY',
      classification: 'PERSONAL',
      selector: 'insight.summary.current',
    },
    {
      referenceId: 'ref:app-metadata:01',
      category: 'APP_METADATA',
      classification: 'INTERNAL',
      selector: 'app.metadata.current',
    },
  ] as const

  return {
    requestId: 'ai-context-request:0001',
    protocolVersion: 1,
    purpose: 'EXPLAIN_INSIGHT',
    processingMode: 'LOCAL_ONLY',
    dataReferences,
    policy,
    retention: 'PROHIBITED',
    training: 'PROHIBITED',
    logging: 'METADATA_ONLY',
    minimization: {
      applied: true,
      strategyCodes: [
        'min.remove.empty',
        'min.remove.duplicates',
      ],
    },
    redaction: {
      applied: true,
      strategyCodes: [
        'redaction.remove.sensitive',
        'redaction.mask.text',
        'redaction.hash.reference',
      ],
    },
    traceability: {
      traceId: 'trace:context:0001',
      relationId: 'relation:context:0001',
      requestId: 'ai-context-request:0001',
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      consentId: null,
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
      dataCategories: ['INSIGHT_SUMMARY', 'APP_METADATA'],
    },
    contextBuilderConstraints: [
      {
        code: 'ctx.only.authorized.references',
        requirement: 'must include only references from authorized envelope',
      },
    ],
  }
}

function createAuthorizedEnvelope(): AIAuthorizedRequestEnvelope {
  const boundary = createAIPrivacyBoundary()
  const request = createAuthorizationRequest()
  return asAuthorizedEnvelope(boundary.authorize(request))
}

function descriptorTypeFromCategory(category: AIDataCategory): AIContextSourceDescriptor['descriptorType'] {
  switch (category) {
    case 'INSIGHT_SUMMARY':
      return 'InsightSummaryReference'
    case 'INSIGHT_READ_MODEL':
      return 'InsightReadModelReference'
    case 'FINANCIAL_SNAPSHOT':
      return 'SnapshotReference'
    case 'KNOWLEDGE_COLLECTION':
      return 'KnowledgeReference'
    case 'APP_METADATA':
      return 'MetadataReference'
    case 'USER_PROVIDED_TEXT':
      return 'UserTextReference'
    case 'DIAGNOSTIC_METADATA':
      return 'DiagnosticReference'
  }
}

function createSourceDescriptors(
  envelope: AIAuthorizedRequestEnvelope,
): readonly AIContextSourceDescriptor[] {
  return envelope.authorizedDataReferences.map((reference) => ({
    descriptorType: descriptorTypeFromCategory(reference.category),
    referenceId: reference.referenceId,
    category: reference.category,
    classification: reference.classification,
    selector: reference.selector,
    metadata: {
      source: 'test-fixture',
      ordinal: 1,
    },
  }))
}

interface ResolverFixture {
  readonly payload: Record<string, unknown>
  readonly classification?: AIContextSourceDescriptor['classification']
  readonly fail?: boolean
}

function createResolver(
  fixtureByReferenceId: Readonly<Record<string, ResolverFixture>>,
): ContextSourceResolverPort {
  return {
    resolve(descriptor) {
      const fixture = fixtureByReferenceId[descriptor.referenceId]
      if (fixture === undefined) {
        return {
          ok: false,
          status: 'failure',
          descriptor,
          code: 'REFERENCE_NOT_FOUND',
          message: 'missing fixture for descriptor',
        }
      }

      if (fixture.fail === true) {
        return {
          ok: false,
          status: 'failure',
          descriptor,
          code: 'SOURCE_UNAVAILABLE',
          message: 'forced source failure',
        }
      }

      return {
        ok: true,
        status: 'resolved',
        descriptor,
        fragment: {
          referenceId: descriptor.referenceId,
          descriptorType: descriptor.descriptorType,
          category: descriptor.category,
          classification: fixture.classification ?? descriptor.classification,
          payload: fixture.payload,
        },
      }
    },
  }
}

function createDefaultResolver(): ContextSourceResolverPort {
  return createResolver({
    'ref:insight-summary:01': {
      payload: {
        summaryCode: 'insight.summary.code',
        text: 'Detalle libre del usuario',
        internalId: 'internal-123',
        emptyField: '',
        createdAt: '2026-07-20T10:00:00.000Z',
        repeated: ['a', 'a', '', 'b'],
        nested: {
          selector: 'insight.selector.reference',
          note: 'nota interna',
        },
      },
    },
    'ref:app-metadata:01': {
      payload: {
        appVersion: '1.0.0',
        token: 'very-sensitive-token',
        stack: 'stack-trace-content',
        tags: ['stable', 'stable', ''],
      },
    },
  })
}

describe('AI Context Builder (Milestone 8B)', () => {
  it('envelope valido', () => {
    const envelope = createAuthorizedEnvelope()
    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const success = asSuccess(result)

    expect(success.contextPackage.requestId).toBe(envelope.requestId)
    expect(success.contextPackage.purpose).toBe(envelope.purpose)
    expect(success.contextPackage.processingMode).toBe(envelope.processingMode)
    expect(success.contextPackage.policyVersion).toBe(envelope.policy.policyVersion)
    expect(success.contextPackage.protocolVersion).toBe(envelope.policy.protocolVersion)
  })

  it('envelope invalido', () => {
    const envelope = createAuthorizedEnvelope()
    const invalidEnvelope: AIAuthorizedRequestEnvelope = {
      ...envelope,
      traceability: {
        ...envelope.traceability,
        requestId: 'invalid-request-id',
      },
    }

    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope: invalidEnvelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const failure = asFailure(result)

    expect(failure.code).toBe('INVALID_ENVELOPE')
  })

  it('referencia desconocida', () => {
    const envelope = createAuthorizedEnvelope()
    const descriptors = [
      ...createSourceDescriptors(envelope),
      {
        descriptorType: 'DiagnosticReference',
        referenceId: 'ref:unknown:01',
        category: 'DIAGNOSTIC_METADATA',
        classification: 'INTERNAL',
        selector: 'diagnostic.unknown',
      } as const,
    ]

    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: descriptors,
    })
    const failure = asFailure(result)

    expect(failure.code).toBe('UNKNOWN_REFERENCE')
  })

  it('clasificacion superior', () => {
    const envelope = createAuthorizedEnvelope()
    const resolver = createResolver({
      'ref:insight-summary:01': {
        payload: {
          summaryCode: 'insight.summary.code',
        },
        classification: 'FINANCIAL',
      },
      'ref:app-metadata:01': {
        payload: {
          appVersion: '1.0.0',
        },
      },
    })

    const builder = createAIContextBuilder({ resolver })
    const result = builder.buildContext({
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const failure = asFailure(result)

    expect(failure.code).toBe('CLASSIFICATION_EXCEEDED')
  })

  it('redaccion aplicada', () => {
    const envelope = createAuthorizedEnvelope()
    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const success = asSuccess(result)

    expect(success.contextPackage.appliedRedactions.length).toBeGreaterThan(0)

    const serialized = JSON.stringify(success.contextPackage.orderedContextFragments)
    expect(serialized.includes('<masked>')).toBe(true)
    expect(serialized.includes('very-sensitive-token')).toBe(false)
    expect(serialized.includes('insight.selector.reference')).toBe(false)
  })

  it('minimizacion aplicada', () => {
    const envelope = createAuthorizedEnvelope()
    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const success = asSuccess(result)

    expect(success.contextPackage.appliedMinimization.length).toBeGreaterThan(0)

    const serialized = JSON.stringify(success.contextPackage.orderedContextFragments)
    expect(serialized.includes('internalId')).toBe(false)
    expect(serialized.includes('createdAt')).toBe(false)
    expect(serialized.includes('stack')).toBe(false)
  })

  it('orden canonico', () => {
    const envelope = createAuthorizedEnvelope()
    const descriptors = [...createSourceDescriptors(envelope)].reverse()

    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: descriptors,
    })
    const success = asSuccess(result)

    const orderedReferences = success.contextPackage.orderedContextFragments.map(
      (fragment) => fragment.referenceId,
    )

    expect(orderedReferences).toEqual([
      'ref:insight-summary:01',
      'ref:app-metadata:01',
    ])
  })

  it('determinismo', () => {
    const envelope = createAuthorizedEnvelope()
    const request = {
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    }

    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const first = builder.buildContext(request)
    const second = builder.buildContext(request)

    expect(first).toEqual(second)
  })

  it('package JSON-safe', () => {
    const envelope = createAuthorizedEnvelope()
    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const success = asSuccess(result)

    expect(isJsonSafe(success.contextPackage)).toBe(true)
    expect(() => JSON.stringify(success.contextPackage)).not.toThrow()
  })

  it('inputs no mutados', () => {
    const envelope = createAuthorizedEnvelope()
    const descriptors = createSourceDescriptors(envelope)
    const beforeEnvelope = JSON.stringify(envelope)
    const beforeDescriptors = JSON.stringify(descriptors)

    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(envelope),
    })

    builder.buildContext({
      envelope,
      sourceDescriptors: descriptors,
    })

    expect(JSON.stringify(envelope)).toBe(beforeEnvelope)
    expect(JSON.stringify(descriptors)).toBe(beforeDescriptors)
  })

  it('failure sin package', () => {
    const builder = createAIContextBuilder({
      resolver: createDefaultResolver(),
    })

    const result = builder.buildContext(null)
    const failure = asFailure(result)

    expect('contextPackage' in failure).toBe(false)
  })

  it('ausencia de autorizacion parcial', () => {
    const envelope = createAuthorizedEnvelope()
    const resolver = createResolver({
      'ref:insight-summary:01': {
        payload: {
          summaryCode: 'insight.summary.code',
        },
      },
      'ref:app-metadata:01': {
        payload: {
          appVersion: '1.0.0',
        },
        fail: true,
      },
    })

    const builder = createAIContextBuilder({ resolver })

    const result = builder.buildContext({
      envelope,
      sourceDescriptors: createSourceDescriptors(envelope),
    })
    const failure = asFailure(result)

    expect(failure.code).toBe('RESOLUTION_FAILED')
    expect('contextPackage' in failure).toBe(false)
  })

  it('ausencia de red', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiContextBuilder.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('fetch(')).toBe(false)
    expect(source.includes('axios')).toBe(false)
    expect(source.includes('http')).toBe(false)
    expect(source.includes('WebSocket')).toBe(false)
  })

  it('ausencia de SDK IA', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiContextBuilder.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('OpenAI')).toBe(false)
    expect(source.includes('Anthropic')).toBe(false)
    expect(source.includes('Gemini')).toBe(false)
    expect(source.includes('Ollama')).toBe(false)
    expect(source.includes('LM Studio')).toBe(false)
  })

  it('ausencia de prompts', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiContextBuilder.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('prompt')).toBe(false)
    expect(source.includes('chat')).toBe(false)
    expect(source.includes('conversation')).toBe(false)
  })

  it('ausencia de persistencia', () => {
    const source = readFileSync(
      new URL('../src/intelligence/ai-foundation/aiContextBuilder.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Dexie')).toBe(false)
    expect(source.includes('indexedDB')).toBe(false)
    expect(source.includes('IndexedDB')).toBe(false)
    expect(source.includes('localStorage')).toBe(false)
    expect(source.includes('sessionStorage')).toBe(false)
  })
})
