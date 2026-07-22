import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  createSnapshotKnowledgeIntegration,
  createSnapshotKnowledgeLayerPort,
} from '../src/services/snapshotKnowledgeIntegration'
import type {
  SnapshotKnowledgeLayerPort,
  SnapshotKnowledgeLayerSnapshot,
} from '../src/services/snapshotKnowledgeIntegrationInterfaces'
import type {
  SnapshotKnowledgeIntegrationRequest,
  SnapshotKnowledgeIntegrationResult,
} from '../src/services/snapshotKnowledgeIntegrationResult'
import type {
  SealedFinancialSnapshot,
  SealedSnapshotId,
  SnapshotKey,
  SnapshotNormativeCode,
} from '../src/types/financialSnapshot'
import type {
  KnowledgeBuilderVersion,
  KnowledgeCollectionVersions,
  KnowledgeProjectionVersion,
  KnowledgeRulesVersion,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'

function brand<T>(value: string | number): T {
  return value as T
}

function asResultFailure(result: SnapshotKnowledgeIntegrationResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure result')
  }
  return result
}

function asResultSuccess(result: SnapshotKnowledgeIntegrationResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success result but got ${result.code}`)
  }
  return result
}

const SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/1.0.0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
)
const SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')

function createVersions(): KnowledgeCollectionVersions {
  return {
    knowledgeVersion: brand<KnowledgeVersion>('knowledge/1.0.0'),
    builderVersion: brand<KnowledgeBuilderVersion>('knowledge-builder/1.0.0'),
    rulesVersion: brand<KnowledgeRulesVersion>('knowledge-rules/1.0.0'),
    projectionVersion: brand<KnowledgeProjectionVersion>('knowledge-projection/1.0.0'),
  }
}

function createCanonicalSnapshot(
  overrides: Partial<SealedFinancialSnapshot<unknown>> = {},
): SealedFinancialSnapshot<unknown> {
  const baseScope = {
    kind: 'monthly' as const,
    periodStart: '2026-07-01',
    periodEndExclusive: '2026-08-01',
    periodBoundary: '[start,end)' as const,
    asOf: '2026-07-31T23:59:59.000Z',
    timezone: 'Europe/Madrid',
    usageMode: 'basic',
    currency: 'EUR',
    filters: {},
  }

  const baseEvidence = {
    strategy: 'embedded-v1' as const,
    records: [],
    context: [
      {
        kind: 'settings-context' as const,
        usageMode: 'basic',
        currency: 'EUR',
        timezone: 'Europe/Madrid',
      },
    ],
    candidateRecordCount: 0,
    includedRecordCount: 0,
    excludedRecordCount: 0,
    coverageCodes: [brand<SnapshotNormativeCode>('coverage.empty_dataset')],
    warningCodes: [],
  }

  const baseAppliedRules = [
    {
      ruleId: 'balance.report.current',
      order: 0,
      engineVersion: '1.0.0-phase-1a-minimal',
      rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal',
      explanationCode: brand<SnapshotNormativeCode>('rule.balance.report.current'),
      affectedFields: [],
      limitationCodes: [],
      warningCodes: [],
    },
  ]

  const base: SealedFinancialSnapshot<unknown> = {
    identity: {
      snapshotId: SNAPSHOT_ID,
      snapshotKey: SNAPSHOT_KEY,
    },
    revision: {
      revision: 1,
      reasonCode: brand<SnapshotNormativeCode>('revision.source_changed'),
    },
    status: 'sealed',
    canonicalDocument: {
      canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
      payload: {
        snapshotVersion: 'financial-snapshot/1.0.0',
        engineVersion: '1.0.0-phase-1a-minimal',
        rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal',
        scope: baseScope,
        engineResult: {
          balanceReport: {
            hasData: false,
            generalBalance: 0,
            netProfit: 0,
          },
          incomeCount: 0,
          expenseCount: 0,
          adjustmentCount: 0,
        },
        evidence: baseEvidence,
        appliedRules: baseAppliedRules,
        metadata: {
          generatedAt: '2026-07-31T23:59:59.000Z',
          generationReasonCode: brand<SnapshotNormativeCode>('generation.shadow_evaluation'),
          provenance: 'local',
          qualityCodes: [],
          warningCodes: [],
          limitationCodes: [],
        },
      },
    },
    fingerprint: {
      value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      algorithm: 'SHA-256',
      encoding: 'hex-lower',
      domain: 'private-balance:financial-snapshot:fingerprint:v1:',
      fingerprintVersion: 'financial-snapshot-fingerprint/1.0.0',
      canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
    },
    sealedAt: '2026-07-31T23:59:59.000Z',
    snapshotVersion: 'financial-snapshot/1.0.0',
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
    engineVersion: '1.0.0-phase-1a-minimal',
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal',
    scope: baseScope,
    evidence: baseEvidence,
    appliedRules: baseAppliedRules,
    metadata: {
      generatedAt: '2026-07-31T23:59:59.000Z',
      generationReasonCode: brand<SnapshotNormativeCode>('generation.shadow_evaluation'),
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
  }

  return {
    ...base,
    ...overrides,
  }
}

function createRequest(
  overrides: Partial<SnapshotKnowledgeIntegrationRequest> = {},
): SnapshotKnowledgeIntegrationRequest {
  const hasSnapshotOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'snapshot',
  )
  const hasVersionsOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'versions',
  )

  return {
    integrationId: overrides.integrationId ?? 'integration:financial-snapshot:2026-07',
    snapshot: hasSnapshotOverride
      ? (overrides.snapshot as SealedFinancialSnapshot<unknown>)
      : createCanonicalSnapshot(),
    versions: hasVersionsOverride
      ? (overrides.versions as KnowledgeCollectionVersions)
      : createVersions(),
  }
}

function buildValidatedCollectionFixture(
  request: SnapshotKnowledgeIntegrationRequest,
) {
  const knowledgeLayer = createSnapshotKnowledgeLayerPort()
  return knowledgeLayer.buildValidatedCollection({
    snapshot: request.snapshot as unknown as SnapshotKnowledgeLayerSnapshot,
    versions: request.versions,
  })
}

describe('SnapshotKnowledgeIntegration deterministic boundary (Milestone 7B)', () => {
  it('integracion exitosa', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(createRequest())
    const success = asResultSuccess(result)

    expect(success.status).toBe('success')
    expect(success.deterministic).toBe(true)
    expect(success.failClosed).toBe(true)
    expect(success.knowledgeCollection.state).toBe('validated')
  })

  it('delegacion unica a Knowledge Layer', () => {
    const request = createRequest()
    const collection = buildValidatedCollectionFixture(request)
    const buildValidatedCollection = vi.fn(() => collection)
    const knowledgeLayer: SnapshotKnowledgeLayerPort = {
      buildValidatedCollection,
    }
    const integration = createSnapshotKnowledgeIntegration({ knowledgeLayer })

    integration.integrate(request)

    expect(buildValidatedCollection).toHaveBeenCalledTimes(1)
  })

  it('snapshot valido no mutado', () => {
    const request = createRequest()
    const before = JSON.stringify(request.snapshot)
    const collection = buildValidatedCollectionFixture(request)
    const knowledgeLayer: SnapshotKnowledgeLayerPort = {
      buildValidatedCollection: vi.fn((input) => {
        ;(input.snapshot.scope as { timezone: string }).timezone = 'America/Bogota'
        return collection
      }),
    }
    const integration = createSnapshotKnowledgeIntegration({ knowledgeLayer })

    const result = integration.integrate(request)

    expect(asResultSuccess(result).status).toBe('success')
    expect(JSON.stringify(request.snapshot)).toBe(before)
  })

  it('respuesta determinista', () => {
    const request = createRequest()
    const collection = buildValidatedCollectionFixture(request)
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: {
        buildValidatedCollection: vi.fn(() => collection),
      },
    })

    const first = integration.integrate(request)
    const second = integration.integrate(request)

    expect(first).toEqual(second)
  })

  it('snapshot nulo', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(
      createRequest({ snapshot: null as unknown as SealedFinancialSnapshot<unknown> }),
    )

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_INVALID_SNAPSHOT')
  })

  it('request invalido', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(null)

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_INVALID_REQUEST')
  })

  it('snapshot estructuralmente invalido', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const invalidSnapshot = {
      ...createCanonicalSnapshot(),
      status: 'persisted',
    } as unknown as SealedFinancialSnapshot<unknown>

    const result = integration.integrate(
      createRequest({ snapshot: invalidSnapshot }),
    )

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_INVALID_SNAPSHOT')
  })

  it('version de snapshot incompatible', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(
      createRequest({
        snapshot: {
          ...createCanonicalSnapshot(),
          snapshotVersion: 'financial-snapshot/9.9.9',
        },
      }),
    )

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_SNAPSHOT_VERSION_INCOMPATIBLE')
  })

  it('protocolo no soportado', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(
      createRequest({
        snapshot: {
          ...createCanonicalSnapshot(),
          canonicalizationVersion: 'financial-snapshot-c14n/9.9.9',
        },
      }),
    )

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_PROTOCOL_UNSUPPORTED')
  })

  it('dependencia ausente', () => {
    const integration = createSnapshotKnowledgeIntegration({})

    const result = integration.integrate(createRequest())

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_MISSING_DEPENDENCY')
  })

  it('excepcion controlable de Knowledge Layer', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: {
        buildValidatedCollection: vi.fn(() => {
          throw Object.assign(new Error('boom'), {
            code: 'KNOWLEDGE_BUILDER_INVALID_SNAPSHOT',
          })
        }),
      },
    })

    const result = integration.integrate(createRequest())

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_KNOWLEDGE_LAYER_FAILURE')
    expect(failure.causeCode).toBe('KNOWLEDGE_BUILDER_INVALID_SNAPSHOT')
  })

  it('respuesta nula de Knowledge Layer', () => {
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: {
        buildValidatedCollection: vi.fn(() => null as unknown as never),
      },
    })

    const result = integration.integrate(createRequest())

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_KNOWLEDGE_LAYER_INVALID_RESPONSE')
  })

  it('KnowledgeCollection inconsistente', () => {
    const request = createRequest()
    const collection = buildValidatedCollectionFixture(request)
    const inconsistentCollection = {
      ...collection,
      state: 'draft',
    } as unknown as typeof collection

    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: {
        buildValidatedCollection: vi.fn(() => inconsistentCollection),
      },
    })

    const result = integration.integrate(request)

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_KNOWLEDGE_COLLECTION_INCONSISTENT')
  })

  it('traceability correcta', () => {
    const request = createRequest()
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(request)
    const success = asResultSuccess(result)

    expect(success.traceability.integrationId).toBe(request.integrationId)
    expect(success.traceability.snapshot.snapshotId).toBe(
      request.snapshot.identity.snapshotId,
    )
    expect(success.traceability.snapshot.snapshotVersion).toBe(
      request.snapshot.snapshotVersion,
    )
    expect(success.traceability.knowledgeCollection.knowledgeCollectionId).toBe(
      success.knowledgeCollection.identity.knowledgeCollectionId,
    )
    expect(success.traceability.relation.sourceSnapshotIdMatches).toBe(true)
    expect(success.traceability.relation.sourceSnapshotKeyMatches).toBe(true)
    expect(success.traceability.relation.sourceSnapshotRevisionMatches).toBe(true)
    expect(success.traceability.relation.sourceFingerprintMatches).toBe(true)
  })

  it('traceability inconsistente', () => {
    const request = createRequest()
    const collection = buildValidatedCollectionFixture(request)
    const inconsistentCollection = {
      ...collection,
      identity: {
        ...collection.identity,
        sourceSnapshotId: brand<SealedSnapshotId>('financial-snapshot:other'),
      },
    }

    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: {
        buildValidatedCollection: vi.fn(() => inconsistentCollection),
      },
    })

    const result = integration.integrate(request)

    const failure = asResultFailure(result)
    expect(failure.code).toBe('INTEGRATION_TRACEABILITY_INCONSISTENT')
  })

  it('coleccion valida con dataset financiero vacio', () => {
    const request = createRequest({
      snapshot: createCanonicalSnapshot(),
    })
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: createSnapshotKnowledgeLayerPort(),
    })

    const result = integration.integrate(request)
    const success = asResultSuccess(result)

    expect(success.knowledgeCollection.validation.status).toBe('valid')
    expect(success.knowledgeCollection.factCount).toBeGreaterThan(0)
  })

  it('fail-closed', () => {
    const integration = createSnapshotKnowledgeIntegration({})

    const result = integration.integrate(createRequest())
    const failure = asResultFailure(result)

    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
    expect(failure.status).toBe('failure')
  })

  it('misma entrada produce el mismo resultado', () => {
    const request = createRequest()
    const collection = buildValidatedCollectionFixture(request)
    const integration = createSnapshotKnowledgeIntegration({
      knowledgeLayer: {
        buildValidatedCollection: vi.fn(() => collection),
      },
    })

    const first = integration.integrate(request)
    const second = integration.integrate(request)

    expect(first).toEqual(second)
  })

  it('ausencia de Date.now, UUID aleatorio y valores ambientales', () => {
    const source = readFileSync(
      new URL('../src/services/snapshotKnowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Date.now')).toBe(false)
    expect(source.includes('randomUUID')).toBe(false)
    expect(source.includes('uuid')).toBe(false)
    expect(source.includes('import.meta.env')).toBe(false)
    expect(source.includes('process.env')).toBe(false)
  })

  it('no acceso a Dexie', () => {
    const source = readFileSync(
      new URL('../src/services/snapshotKnowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Dexie')).toBe(false)
  })

  it('no acceso a IndexedDB', () => {
    const source = readFileSync(
      new URL('../src/services/snapshotKnowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('indexedDB')).toBe(false)
    expect(source.includes('IndexedDB')).toBe(false)
  })

  it('no ejecucion del InsightRuntime', () => {
    const source = readFileSync(
      new URL('../src/services/snapshotKnowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('InsightRuntime')).toBe(false)
    expect(source.includes('createInsightRuntime')).toBe(false)
    expect(source.includes('runtimeAdapter')).toBe(false)
  })

  it('no duplicacion de logica financiera', () => {
    const source = readFileSync(
      new URL('../src/services/snapshotKnowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('runFinancialEngine')).toBe(false)
    expect(source.includes('buildBalanceReport')).toBe(false)
    expect(source.includes('recordBelongsToUsageMode')).toBe(false)
    expect(source.includes('getEffectiveFinancialDuration')).toBe(false)
  })

  it('no duplicacion de logica de Knowledge Layer', () => {
    const source = readFileSync(
      new URL('../src/services/snapshotKnowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('factsFromSnapshot(')).toBe(false)
    expect(source.includes('stableSortFactTypes(')).toBe(false)
    expect(source.includes('assertUniqueFactIds(')).toBe(false)
    expect(source.includes('runCheck(')).toBe(false)
  })
})
