import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import {
  buildKnowledgeCollectionFromSnapshot,
} from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  validateKnowledgeCollection,
} from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import {
  INSIGHT_RULE_PROTOCOL_VERSION,
  type InsightRuleDescriptor,
} from '../src/types/insightRule'
import type {
  SnapshotNormativeCode,
  SealedFinancialSnapshot,
  SealedSnapshotId,
  SnapshotKey,
} from '../src/types/financialSnapshot'
import {
  createKnowledgeIntegration,
} from '../src/services/knowledgeIntegration'
import type {
  KnowledgeIntegrationRuntimeAdapterPort,
} from '../src/services/knowledgeIntegrationInterfaces'
import type {
  KnowledgeIntegrationRequest,
  KnowledgeIntegrationResult,
} from '../src/services/knowledgeIntegrationResult'
import type {
  RuntimeAdapterResult,
  RuntimeAdapterSuccess,
} from '../src/services/adapterInterfaces'
import type {
  InsightRuntimeRequest,
} from '../src/insight/runtimeRequest'
import { createValidationReport } from '../src/insight/validationReport'

function brand<T>(value: string | number): T {
  return value as T
}

function asFailure(result: KnowledgeIntegrationResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure')
  }

  return result
}

function asSuccess(result: KnowledgeIntegrationResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success but got ${result.code}`)
  }

  return result
}

const SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/1.0.0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
)
const SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')

function createSnapshotFixture(
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
            hasData: true,
            generalBalance: 100,
            netProfit: 70,
          },
          incomeCount: 2,
          expenseCount: 1,
          adjustmentCount: 0,
        },
        evidence: {
          strategy: 'embedded-v1',
          records: [],
          context: [
            {
              kind: 'settings-context',
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
        },
        appliedRules: [
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
        ],
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
      value: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
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
    evidence: {
      strategy: 'embedded-v1',
      records: [],
      context: [
        {
          kind: 'settings-context',
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
    },
    appliedRules: [
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
    ],
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

function createValidatedKnowledgeCollection() {
  const snapshot = createSnapshotFixture()
  const draft = buildKnowledgeCollectionFromSnapshot({
    snapshot,
    knowledgeVersion: brand('knowledge/1.0.0'),
    builderVersion: brand('knowledge-builder/1.0.0'),
    rulesVersion: brand('knowledge-rules/1.0.0'),
    projectionVersion: brand('knowledge-projection/1.0.0'),
  })

  return validateKnowledgeCollection(draft)
}

function createRequest(
  overrides: Partial<KnowledgeIntegrationRequest> = {},
): KnowledgeIntegrationRequest {
  return {
    integrationId:
      overrides.integrationId ?? 'knowledge-integration:2026-07:basic:eur',
    executionId: overrides.executionId ?? 'runtime-execution:2026-07:basic:eur',
    protocolVersion:
      overrides.protocolVersion ?? INSIGHT_RULE_PROTOCOL_VERSION,
    knowledgeCollection:
      overrides.knowledgeCollection ?? createValidatedKnowledgeCollection(),
    rules: overrides.rules ?? ([] as readonly InsightRuleDescriptor[]),
  }
}

function createRuntimeAdapterSuccess(
  runtimeRequest: InsightRuntimeRequest,
): RuntimeAdapterSuccess {
  return {
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    request: runtimeRequest,
    knowledgeCollection: runtimeRequest
      .knowledgeCollection as RuntimeAdapterSuccess['knowledgeCollection'],
    response: {
      ok: true,
      status: 'success',
      executionId: runtimeRequest.executionId,
      deterministic: true,
      failClosed: true,
      repositoryUpdated: true,
      collection: {
        protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
        sourceKnowledgeCollectionId:
          runtimeRequest.knowledgeCollection.identity.knowledgeCollectionId,
        sourceSnapshotId:
          runtimeRequest.knowledgeCollection.identity.sourceSnapshotId,
        sourceSnapshotKey:
          runtimeRequest.knowledgeCollection.identity.sourceSnapshotKey,
        sourceSnapshotRevision:
          runtimeRequest.knowledgeCollection.identity.sourceSnapshotRevision,
        deterministicOutput: true,
        failClosed: true,
        insights: [],
        executions: [],
      },
      assessment: {
        status: 'ok',
        failures: [],
        generatedInsights: 0,
        skippedRules: 0,
      },
      validationReport: createValidationReport([]),
    },
  }
}

describe('KnowledgeIntegration deterministic boundary (Milestone 7C)', () => {
  it('integracion exitosa', () => {
    const runtimeAdapter: KnowledgeIntegrationRuntimeAdapterPort = {
      execute: vi.fn((runtimeRequest) =>
        createRuntimeAdapterSuccess(runtimeRequest),
      ),
    }

    const integration = createKnowledgeIntegration({ runtimeAdapter })
    const result = integration.integrate(createRequest())
    const success = asSuccess(result)

    expect(success.status).toBe('success')
    expect(success.failClosed).toBe(true)
    expect(success.deterministic).toBe(true)
  })

  it('delegacion unica al Runtime Adapter', () => {
    const execute = vi.fn((runtimeRequest: InsightRuntimeRequest) =>
      createRuntimeAdapterSuccess(runtimeRequest),
    )
    const integration = createKnowledgeIntegration({
      runtimeAdapter: { execute },
    })

    integration.integrate(createRequest())

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('coleccion valida no mutada', () => {
    const request = createRequest()
    const before = JSON.stringify(request.knowledgeCollection)

    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) => {
          ;(runtimeRequest.knowledgeCollection.identity as { knowledgeCollectionId: string })
            .knowledgeCollectionId = 'knowledge-collection:mutated-by-adapter'
          return createRuntimeAdapterSuccess(runtimeRequest)
        }),
      },
    })

    integration.integrate(request)

    expect(JSON.stringify(request.knowledgeCollection)).toBe(before)
  })

  it('coleccion vacia', () => {
    const request = createRequest({
      knowledgeCollection: {
        ...createValidatedKnowledgeCollection(),
        facts: [],
        factCount: 0,
      } as KnowledgeIntegrationRequest['knowledgeCollection'],
    })

    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) =>
          createRuntimeAdapterSuccess(runtimeRequest),
        ),
      },
    })

    const result = integration.integrate(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_INVALID_COLLECTION')
  })

  it('request invalido', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) =>
          createRuntimeAdapterSuccess(runtimeRequest),
        ),
      },
    })

    const result = integration.integrate(null)
    const failure = asFailure(result)

    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_INVALID_REQUEST')
  })

  it('protocolo incompatible', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) =>
          createRuntimeAdapterSuccess(runtimeRequest),
        ),
      },
    })

    const result = integration.integrate(
      createRequest({
        protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION + 1,
      }),
    )
    const failure = asFailure(result)

    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_PROTOCOL_INCOMPATIBLE')
  })

  it('version incompatible', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) =>
          createRuntimeAdapterSuccess(runtimeRequest),
        ),
      },
    })

    const result = integration.integrate(
      createRequest({
        knowledgeCollection: {
          ...createValidatedKnowledgeCollection(),
          versions: {
            ...createValidatedKnowledgeCollection().versions,
            knowledgeVersion: brand('knowledge/9.9.9'),
          },
        } as KnowledgeIntegrationRequest['knowledgeCollection'],
      }),
    )

    const failure = asFailure(result)
    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_VERSION_INCOMPATIBLE')
  })

  it('dependencia ausente', () => {
    const integration = createKnowledgeIntegration({})

    const result = integration.integrate(createRequest())
    const failure = asFailure(result)

    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_MISSING_DEPENDENCY')
  })

  it('excepcion controlable', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn(() => {
          throw Object.assign(new Error('runtime adapter failed'), {
            code: 'ADAPTER_RUNTIME_INVOCATION_FAILED',
          })
        }),
      },
    })

    const result = integration.integrate(createRequest())
    const failure = asFailure(result)

    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE')
    expect(failure.causeCode).toBe('ADAPTER_RUNTIME_INVOCATION_FAILED')
  })

  it('respuesta inconsistente', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn(
          () => ({ ok: true, status: 'success' }) as unknown as RuntimeAdapterResult,
        ),
      },
    })

    const result = integration.integrate(createRequest())
    const failure = asFailure(result)

    expect(failure.code).toBe('KNOWLEDGE_INTEGRATION_INCONSISTENT_RESPONSE')
  })

  it('fail-closed', () => {
    const integration = createKnowledgeIntegration({})

    const result = integration.integrate(createRequest())
    const failure = asFailure(result)

    expect(failure.status).toBe('failure')
    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
  })

  it('determinismo', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) =>
          createRuntimeAdapterSuccess(runtimeRequest),
        ),
      },
    })
    const request = createRequest()

    const first = integration.integrate(request)
    const second = integration.integrate(request)

    expect(first).toEqual(second)
  })

  it('preservacion de trazabilidad', () => {
    const integration = createKnowledgeIntegration({
      runtimeAdapter: {
        execute: vi.fn((runtimeRequest) =>
          createRuntimeAdapterSuccess(runtimeRequest),
        ),
      },
    })
    const request = createRequest()

    const result = integration.integrate(request)
    const success = asSuccess(result)

    expect(success.traceability.integrationId).toBe(request.integrationId)
    expect(success.traceability.knowledgeCollection.knowledgeCollectionId).toBe(
      request.knowledgeCollection.identity.knowledgeCollectionId,
    )
    expect(success.traceability.runtime.executionId).toBe(request.executionId)
    expect(success.traceability.relation.requestKnowledgeCollectionMatches).toBe(true)
    expect(success.traceability.relation.runtimeExecutionIdMatches).toBe(true)
  })

  it('ausencia de acceso a Runtime interno', () => {
    const source = readFileSync(
      new URL('../src/services/knowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('createInsightRuntime')).toBe(false)
    expect(source.includes('getSnapshot(')).toBe(false)
    expect(source.includes('query(')).toBe(false)
  })

  it('ausencia de acceso a Builder', () => {
    const source = readFileSync(
      new URL('../src/services/knowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('buildInsightCollection')).toBe(false)
    expect(source.includes('buildKnowledgeCollectionFromSnapshot')).toBe(false)
  })

  it('ausencia de acceso a Validator', () => {
    const source = readFileSync(
      new URL('../src/services/knowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('validateInsightCollection')).toBe(false)
    expect(source.includes('validateKnowledgeCollection')).toBe(false)
  })

  it('ausencia de acceso a Repository', () => {
    const source = readFileSync(
      new URL('../src/services/knowledgeIntegration.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('createInsightRepository')).toBe(false)
    expect(source.includes('InsightRepository')).toBe(false)
  })
})
