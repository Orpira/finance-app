import { readFileSync } from 'node:fs'

import { describe, expect, it, vi } from 'vitest'

import { createInsightExecutionService } from '../src/services/insightExecutionService'
import type {
  InsightExecutionKnowledgeIntegrationPort,
  InsightExecutionSnapshotIntegrationPort,
} from '../src/services/insightExecutionInterfaces'
import type {
  InsightExecutionRequest,
  InsightExecutionResult,
} from '../src/services/insightExecutionResult'
import type {
  SnapshotKnowledgeInputSnapshot,
} from '../src/services/snapshotKnowledgeIntegrationInterfaces'
import type {
  SnapshotKnowledgeIntegrationFailure,
  SnapshotKnowledgeIntegrationResult,
  SnapshotKnowledgeIntegrationSuccess,
} from '../src/services/snapshotKnowledgeIntegrationResult'
import type {
  KnowledgeIntegrationFailure,
  KnowledgeIntegrationResult,
  KnowledgeIntegrationSuccess,
} from '../src/services/knowledgeIntegrationResult'
import type {
  InsightRuleDescriptor,
} from '../src/types/insightRule'
import type {
  KnowledgeCollectionVersions,
  ValidatedKnowledgeCollection,
} from '../src/types/knowledgeLayer'

function asFailure(result: InsightExecutionResult) {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected failure')
  }

  return result
}

function asSuccess(result: InsightExecutionResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected success but got ${result.code}`)
  }

  return result
}

function createVersions(): KnowledgeCollectionVersions {
  return {
    knowledgeVersion: 'knowledge/1.0.0' as KnowledgeCollectionVersions['knowledgeVersion'],
    builderVersion:
      'knowledge-builder/1.0.0' as KnowledgeCollectionVersions['builderVersion'],
    rulesVersion: 'knowledge-rules/1.0.0' as KnowledgeCollectionVersions['rulesVersion'],
    projectionVersion:
      'knowledge-projection/1.0.0' as KnowledgeCollectionVersions['projectionVersion'],
  }
}

function createSnapshotFixture(): SnapshotKnowledgeInputSnapshot {
  return {
    identity: {
      snapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/1.0.0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      snapshotKey: 'snapshot-key:monthly:2026-07',
    },
    revision: {
      revision: 1,
    },
    snapshotVersion: 'financial-snapshot/1.0.0',
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0',
  } as unknown as SnapshotKnowledgeInputSnapshot
}

function createRulesFixture(): readonly InsightRuleDescriptor[] {
  return [
    {
      reference: {
        ruleId: 'insight-rule.execution.fixture',
        ruleVersion: '1.0.0',
        protocolVersion: 1,
      },
    } as unknown as InsightRuleDescriptor,
  ]
}

function createRequest(
  overrides: Partial<InsightExecutionRequest> = {},
): InsightExecutionRequest {
  const hasSnapshotOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'snapshot',
  )
  const hasRulesOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'rules',
  )
  const hasVersionsOverride = Object.prototype.hasOwnProperty.call(
    overrides,
    'versions',
  )

  return {
    executionId: overrides.executionId ?? 'runtime-execution:2026-07:basic:eur',
    snapshotIntegrationId:
      overrides.snapshotIntegrationId ??
      'snapshot-integration:2026-07:basic:eur',
    knowledgeIntegrationId:
      overrides.knowledgeIntegrationId ??
      'knowledge-integration:2026-07:basic:eur',
    snapshot: hasSnapshotOverride
      ? (overrides.snapshot as InsightExecutionRequest['snapshot'])
      : createSnapshotFixture(),
    rules: hasRulesOverride
      ? (overrides.rules as InsightExecutionRequest['rules'])
      : createRulesFixture(),
    versions: hasVersionsOverride
      ? (overrides.versions as InsightExecutionRequest['versions'])
      : createVersions(),
    protocolVersion: overrides.protocolVersion ?? 1,
  }
}

function createKnowledgeCollectionFixture(
  request: InsightExecutionRequest,
): ValidatedKnowledgeCollection {
  const snapshot = request.snapshot as unknown as {
    identity: { snapshotId: string; snapshotKey: string }
    revision: { revision: number }
  }

  return {
    state: 'validated',
    identity: {
      knowledgeCollectionId: 'knowledge-collection:execution:2026-07',
      sourceSnapshotId: snapshot.identity.snapshotId,
      sourceSnapshotKey: snapshot.identity.snapshotKey,
      sourceSnapshotRevision: snapshot.revision.revision,
      sourceFingerprintValue:
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    },
    versions: request.versions,
    facts: [{ factId: 'knowledge-fact:execution:1' }],
    relationships: [],
    factCount: 1,
    validation: {
      status: 'valid',
    },
  } as unknown as ValidatedKnowledgeCollection
}

function createSnapshotSuccess(
  request: InsightExecutionRequest,
): SnapshotKnowledgeIntegrationSuccess {
  const snapshot = request.snapshot as unknown as {
    identity: { snapshotId: string; snapshotKey: string }
    revision: { revision: number }
    snapshotVersion: string
    canonicalizationVersion: string
  }

  const knowledgeCollection = createKnowledgeCollectionFixture(request)

  return {
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    integrationId: request.snapshotIntegrationId,
    knowledgeCollection,
    traceability: {
      integrationId: request.snapshotIntegrationId,
      snapshot: {
        snapshotId: snapshot.identity.snapshotId,
        snapshotKey: snapshot.identity.snapshotKey,
        snapshotRevision: snapshot.revision.revision,
        snapshotVersion: snapshot.snapshotVersion,
        canonicalizationVersion: snapshot.canonicalizationVersion,
      },
      knowledgeCollection: {
        knowledgeCollectionId: knowledgeCollection.identity.knowledgeCollectionId,
        versions: knowledgeCollection.versions,
        state: 'validated',
      },
      relation: {
        sourceSnapshotIdMatches: true,
        sourceSnapshotKeyMatches: true,
        sourceSnapshotRevisionMatches: true,
        sourceFingerprintMatches: true,
      },
    },
  }
}

function createSnapshotFailure(
  request: InsightExecutionRequest,
): SnapshotKnowledgeIntegrationFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    integrationId: request.snapshotIntegrationId,
    code: 'INTEGRATION_INVALID_SNAPSHOT',
    message: 'snapshot rejected by integration boundary',
  }
}

function createKnowledgeSuccess(input: {
  readonly request: InsightExecutionRequest
  readonly snapshotResult: SnapshotKnowledgeIntegrationSuccess
}): KnowledgeIntegrationSuccess {
  const knowledgeCollection = input.snapshotResult.knowledgeCollection

  return {
    ok: true,
    status: 'success',
    deterministic: true,
    failClosed: true,
    integrationId: input.request.knowledgeIntegrationId,
    traceability: {
      integrationId: input.request.knowledgeIntegrationId,
      knowledgeCollection: {
        knowledgeCollectionId: knowledgeCollection.identity.knowledgeCollectionId,
        sourceSnapshotId: knowledgeCollection.identity.sourceSnapshotId,
        sourceSnapshotKey: knowledgeCollection.identity.sourceSnapshotKey,
        sourceSnapshotRevision: knowledgeCollection.identity.sourceSnapshotRevision,
        versions: knowledgeCollection.versions,
        factCount: knowledgeCollection.factCount,
      },
      runtime: {
        executionId: input.request.executionId,
        protocolVersion: input.request.protocolVersion ?? 1,
        rulesCount: input.request.rules.length,
      },
      relation: {
        requestExecutionIdMatches: true,
        requestProtocolMatches: true,
        requestKnowledgeCollectionMatches: true,
        adapterKnowledgeCollectionMatches: true,
        runtimeExecutionIdMatches: true,
      },
    },
    adapterResult: {
      ok: true,
      status: 'success',
      deterministic: true,
      failClosed: true,
      request: {
        executionId: input.request.executionId,
        protocolVersion: input.request.protocolVersion ?? 1,
        knowledgeCollection,
        rules: input.request.rules,
      },
      knowledgeCollection,
      response: {
        ok: true,
        status: 'success',
        executionId: input.request.executionId,
        deterministic: true,
        failClosed: true,
        repositoryUpdated: true,
        collection: {
          protocolVersion: input.request.protocolVersion ?? 1,
          sourceKnowledgeCollectionId: knowledgeCollection.identity.knowledgeCollectionId,
          sourceSnapshotId: knowledgeCollection.identity.sourceSnapshotId,
          sourceSnapshotKey: knowledgeCollection.identity.sourceSnapshotKey,
          sourceSnapshotRevision: knowledgeCollection.identity.sourceSnapshotRevision,
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
        validationReport: {
          status: 'valid',
          failClosed: true,
          deterministic: true,
          issueCount: 0,
          issues: [],
        },
      },
    },
  }
}

function createKnowledgeFailure(
  request: InsightExecutionRequest,
): KnowledgeIntegrationFailure {
  return {
    ok: false,
    status: 'failure',
    deterministic: true,
    failClosed: true,
    integrationId: request.knowledgeIntegrationId,
    code: 'KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE',
    message: 'runtime adapter rejected integration',
  }
}

describe('InsightExecutionService deterministic orchestration boundary (Milestone 7D)', () => {
  it('pipeline completo exitoso', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({
      request,
      snapshotResult,
    })

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => knowledgeResult),
      },
    })

    const result = service.execute(request)
    const success = asSuccess(result)

    expect(success.status).toBe('success')
    expect(success.executionId).toBe(request.executionId)
    expect(success.runtimeResponse.executionId).toBe(request.executionId)
    expect(success.completedStages).toEqual([
      'snapshot-integration',
      'knowledge-integration',
    ])
  })

  it('SnapshotKnowledgeIntegration invocado exactamente una vez', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({ request, snapshotResult })
    const integrateSnapshot = vi.fn(() => snapshotResult)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: integrateSnapshot,
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => knowledgeResult),
      },
    })

    service.execute(request)

    expect(integrateSnapshot).toHaveBeenCalledTimes(1)
  })

  it('KnowledgeIntegration invocado exactamente una vez en exito de 7B', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const integrateKnowledge = vi.fn<
      (request: KnowledgeIntegrationRequest) => KnowledgeIntegrationResult
    >(() => createKnowledgeSuccess({ request, snapshotResult }))

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: integrateKnowledge,
      },
    })

    service.execute(request)

    expect(integrateKnowledge).toHaveBeenCalledTimes(1)
  })

  it('KnowledgeIntegration no invocado cuando 7B falla', () => {
    const request = createRequest()
    const integrateKnowledge = vi.fn<
      (request: KnowledgeIntegrationRequest) => KnowledgeIntegrationResult
    >(() => createKnowledgeFailure(request))

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => createSnapshotFailure(request)),
      },
      knowledgeIntegration: {
        integrate: integrateKnowledge,
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_REJECTED')
    expect(integrateKnowledge).toHaveBeenCalledTimes(0)
  })

  it('request invalido', () => {
    const service = createInsightExecutionService({})

    const result = service.execute(null)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_INVALID_REQUEST')
  })

  it('snapshot ausente', () => {
    const request = createRequest({
      snapshot: null as unknown as SnapshotKnowledgeInputSnapshot,
    })

    const service = createInsightExecutionService({})

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_MISSING_SNAPSHOT')
  })

  it('catalogo de reglas ausente cuando es obligatorio', () => {
    const request = createRequest({
      rules: undefined as unknown as readonly InsightRuleDescriptor[],
    })

    const service = createInsightExecutionService({})

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_MISSING_RULE_CATALOG')
  })

  it('dependencia 7B ausente', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_MISSING_DEPENDENCY')
    expect(failure.stage).toBe('snapshot-integration')
  })

  it('dependencia 7C ausente', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => createSnapshotSuccess(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_MISSING_DEPENDENCY')
    expect(failure.stage).toBe('knowledge-integration')
  })

  it('rejection de 7B correctamente propagado', () => {
    const request = createRequest()
    const snapshotFailure = createSnapshotFailure(request)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotFailure),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_REJECTED')
    expect(failure.snapshotIntegrationResult).toEqual(snapshotFailure)
  })

  it('rejection de 7C correctamente propagado', () => {
    const request = createRequest()
    const snapshotSuccess = createSnapshotSuccess(request)
    const knowledgeFailure = createKnowledgeFailure(request)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotSuccess),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => knowledgeFailure),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED')
    expect(failure.snapshotIntegrationResult).toEqual(snapshotSuccess)
    expect(failure.knowledgeIntegrationResult).toEqual(knowledgeFailure)
  })

  it('excepcion controlable de 7B', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => {
          throw Object.assign(new Error('snapshot integration failed'), {
            code: 'INTEGRATION_KNOWLEDGE_LAYER_FAILURE',
          })
        }),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_SNAPSHOT_INTEGRATION_EXCEPTION')
    expect(failure.causeCode).toBe('INTEGRATION_KNOWLEDGE_LAYER_FAILURE')
  })

  it('excepcion controlable de 7C', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => createSnapshotSuccess(request)),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => {
          throw Object.assign(new Error('knowledge integration failed'), {
            code: 'KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE',
          })
        }),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_EXCEPTION')
    expect(failure.causeCode).toBe('KNOWLEDGE_INTEGRATION_ADAPTER_FAILURE')
    expect(failure.traceability.completedStages).toEqual(['snapshot-integration'])
  })

  it('respuesta nula de 7B', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => null as unknown as SnapshotKnowledgeIntegrationResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_INCONSISTENT_SNAPSHOT_RESULT')
  })

  it('respuesta estructuralmente inconsistente de 7B', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(
          () => ({ ok: true, status: 'success' }) as unknown as SnapshotKnowledgeIntegrationResult,
        ),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_INCONSISTENT_SNAPSHOT_RESULT')
  })

  it('respuesta nula de 7C', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => createSnapshotSuccess(request)),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => null as unknown as KnowledgeIntegrationResult),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_INCONSISTENT_KNOWLEDGE_RESULT')
    expect(failure.traceability.completedStages).toEqual(['snapshot-integration'])
  })

  it('respuesta estructuralmente inconsistente de 7C', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => createSnapshotSuccess(request)),
      },
      knowledgeIntegration: {
        integrate: vi.fn(
          () => ({ ok: true, status: 'success' }) as unknown as KnowledgeIntegrationResult,
        ),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_INCONSISTENT_KNOWLEDGE_RESULT')
  })

  it('trazabilidad completa en exito', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({ request, snapshotResult })

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => knowledgeResult),
      },
    })

    const result = service.execute(request)
    const success = asSuccess(result)

    expect(success.traceability.executionId).toBe(request.executionId)
    expect(success.traceability.snapshotIntegrationId).toBe(request.snapshotIntegrationId)
    expect(success.traceability.knowledgeIntegrationId).toBe(request.knowledgeIntegrationId)
    expect(success.traceability.snapshotIntegrationTraceability).toEqual(
      snapshotResult.traceability,
    )
    expect(success.traceability.knowledgeIntegrationTraceability).toEqual(
      knowledgeResult.traceability,
    )
    expect(success.traceability.relation?.runtimeExecutionMatchesRequest).toBe(true)
  })

  it('trazabilidad parcial correcta en fallo de 7C', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_KNOWLEDGE_INTEGRATION_REJECTED')
    expect(failure.traceability.completedStages).toEqual(['snapshot-integration'])
    expect(failure.traceability.snapshotIntegrationTraceability).toEqual(
      snapshotResult.traceability,
    )
    expect(failure.traceability.knowledgeIntegrationTraceability).toBeUndefined()
  })

  it('mismatch entre snapshot y trazabilidad de 7B', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    ;(
      snapshotResult.knowledgeCollection.identity as {
        sourceSnapshotId: string
      }
    ).sourceSnapshotId = 'financial-snapshot:other'

    const integrateKnowledge = vi.fn<
      (request: KnowledgeIntegrationRequest) => KnowledgeIntegrationResult
    >(() => createKnowledgeFailure(request))

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: integrateKnowledge,
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_TRACEABILITY_MISMATCH')
    expect(failure.stage).toBe('snapshot-integration')
    expect(integrateKnowledge).toHaveBeenCalledTimes(0)
  })

  it('mismatch entre KnowledgeCollection y trazabilidad de 7C', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({ request, snapshotResult })
    ;(
      knowledgeResult.traceability.knowledgeCollection as {
        knowledgeCollectionId: string
      }
    ).knowledgeCollectionId = 'knowledge-collection:other'

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => knowledgeResult),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.code).toBe('INSIGHT_EXECUTION_TRACEABILITY_MISMATCH')
    expect(failure.stage).toBe('knowledge-integration')
  })

  it('fail-closed', () => {
    const request = createRequest({
      rules: undefined as unknown as readonly InsightRuleDescriptor[],
    })

    const service = createInsightExecutionService({})

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.status).toBe('failure')
    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
  })

  it('ausencia de exito parcial', () => {
    const request = createRequest()

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => createSnapshotSuccess(request)),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeFailure(request)),
      },
    })

    const result = service.execute(request)
    const failure = asFailure(result)

    expect(failure.status).toBe('failure')
    expect('runtimeResponse' in failure).toBe(false)
  })

  it('determinismo', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => createKnowledgeSuccess({ request, snapshotResult })),
      },
    })

    const first = service.execute(request)
    const second = service.execute(request)

    expect(first).toEqual(second)
  })

  it('misma entrada y mismos dobles producen exactamente el mismo resultado', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({ request, snapshotResult })

    const snapshotPort: InsightExecutionSnapshotIntegrationPort = {
      integrate: vi.fn(() => snapshotResult),
    }
    const knowledgePort: InsightExecutionKnowledgeIntegrationPort = {
      integrate: vi.fn(() => knowledgeResult),
    }

    const serviceA = createInsightExecutionService({
      snapshotIntegration: snapshotPort,
      knowledgeIntegration: knowledgePort,
    })
    const serviceB = createInsightExecutionService({
      snapshotIntegration: snapshotPort,
      knowledgeIntegration: knowledgePort,
    })

    const first = serviceA.execute(request)
    const second = serviceB.execute(request)

    expect(first).toEqual(second)
  })

  it('snapshot no mutado', () => {
    const request = createRequest()
    const before = JSON.stringify(request.snapshot)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn((input) => {
          ;(
            input.snapshot as unknown as {
              identity: { snapshotId: string }
            }
          ).identity.snapshotId = 'financial-snapshot:mutated'
          return createSnapshotSuccess(request)
        }),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() =>
          createKnowledgeSuccess({
            request,
            snapshotResult: createSnapshotSuccess(request),
          }),
        ),
      },
    })

    service.execute(request)

    expect(JSON.stringify(request.snapshot)).toBe(before)
  })

  it('reglas no mutadas', () => {
    const request = createRequest()
    const before = JSON.stringify(request.rules)

    const snapshotResult = createSnapshotSuccess(request)
    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn((input) => {
          ;(input.rules as unknown as Array<unknown>).push({ ruleId: 'mutated' })
          return createKnowledgeSuccess({ request, snapshotResult })
        }),
      },
    })

    service.execute(request)

    expect(JSON.stringify(request.rules)).toBe(before)
  })

  it('resultado de 7B no mutado', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const before = JSON.stringify(snapshotResult)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn((input) => {
          ;(
            input.knowledgeCollection.identity as {
              knowledgeCollectionId: string
            }
          ).knowledgeCollectionId = 'knowledge-collection:mutated'
          return createKnowledgeSuccess({ request, snapshotResult })
        }),
      },
    })

    service.execute(request)

    expect(JSON.stringify(snapshotResult)).toBe(before)
  })

  it('resultado de 7C no mutado', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({ request, snapshotResult })
    const before = JSON.stringify(knowledgeResult)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: vi.fn(() => snapshotResult),
      },
      knowledgeIntegration: {
        integrate: vi.fn(() => knowledgeResult),
      },
    })

    service.execute(request)

    expect(JSON.stringify(knowledgeResult)).toBe(before)
  })

  it('ausencia de Date.now y UUID aleatorio', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Date.now')).toBe(false)
    expect(source.includes('randomUUID')).toBe(false)
    expect(source.includes('uuid')).toBe(false)
  })

  it('ausencia de acceso directo a InsightRuntime', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('createInsightRuntime')).toBe(false)
    expect(source.includes('InsightRuntime')).toBe(false)
  })

  it('ausencia de acceso directo a Runtime Adapter', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('createRuntimeAdapter')).toBe(false)
    expect(source.includes('adaptAndExecute')).toBe(false)
  })

  it('ausencia de acceso directo a Builder', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('buildInsightCollection')).toBe(false)
    expect(source.includes('buildKnowledgeCollectionFromSnapshot')).toBe(false)
  })

  it('ausencia de acceso directo a Validator', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('validateInsightCollection')).toBe(false)
    expect(source.includes('validateKnowledgeCollection')).toBe(false)
  })

  it('ausencia de acceso directo a Repository', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('createInsightRepository')).toBe(false)
    expect(source.includes('InsightRepository')).toBe(false)
  })

  it('ausencia de acceso a Dexie', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('Dexie')).toBe(false)
  })

  it('ausencia de acceso a IndexedDB', () => {
    const source = readFileSync(
      new URL('../src/services/insightExecutionService.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('indexedDB')).toBe(false)
    expect(source.includes('IndexedDB')).toBe(false)
  })

  it('cada etapa se ejecuta como maximo una vez', () => {
    const request = createRequest()
    const snapshotResult = createSnapshotSuccess(request)
    const knowledgeResult = createKnowledgeSuccess({ request, snapshotResult })

    const integrateSnapshot = vi.fn(() => snapshotResult)
    const integrateKnowledge = vi.fn(() => knowledgeResult)

    const service = createInsightExecutionService({
      snapshotIntegration: {
        integrate: integrateSnapshot,
      },
      knowledgeIntegration: {
        integrate: integrateKnowledge,
      },
    })

    service.execute(request)

    expect(integrateSnapshot).toHaveBeenCalledTimes(1)
    expect(integrateKnowledge).toHaveBeenCalledTimes(1)
  })
})
