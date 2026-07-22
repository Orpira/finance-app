import { describe, expect, it, vi } from 'vitest'

import { createInsightEngine } from '../src/insight/insightEngine'
import { createInsightRepository } from '../src/insight/insightRepository'
import { createInsightRuntime } from '../src/insight/insightRuntime'
import type { InsightRuntimeRequest } from '../src/insight/runtimeRequest'
import type {
  InsightRuntimeFailure,
  InsightRuntimeSuccess,
} from '../src/insight/runtimeResponse'
import {
  createRuntimeAdapter,
} from '../src/services/runtimeAdapter'
import type {
  RuntimeAdapterInput,
  RuntimeAdapterRuntimePort,
  RuntimeAdapterSourceSnapshot,
} from '../src/services/adapterInterfaces'
import { createValidationReport } from '../src/insight/validationReport'
import type {
  SealedSnapshotId,
  SnapshotKey,
} from '../src/types/financialSnapshot'
import {
  INSIGHT_RULE_PROTOCOL_VERSION,
  type InsightRuleId,
  type InsightRuleMessageCode,
  type InsightRuleSummaryCode,
  type InsightRuleTitleCode,
  type InsightRuleVersion,
} from '../src/types/insightRule'
import type {
  KnowledgeCollectionId,
  KnowledgeFactId,
} from '../src/types/knowledgeLayer'

function brand<T>(value: string | number): T {
  return value as T
}

const SOURCE_SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
)
const SOURCE_SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')
const SOURCE_KNOWLEDGE_COLLECTION_ID = brand<KnowledgeCollectionId>(
  'knowledge-collection:runtime-adapter-fixture',
)
const FACT_ID = brand<KnowledgeFactId>(
  'knowledge-fact:knowledge/1.0.0:financial-snapshot:financial-snapshot-fingerprint/2.0.0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:cashflow.neutral:0000',
)

function createSourceSnapshot(
  overrides: Partial<RuntimeAdapterSourceSnapshot> = {},
): RuntimeAdapterSourceSnapshot {
  const base: RuntimeAdapterSourceSnapshot = {
    status: 'sealed',
    identity: {
      snapshotId: SOURCE_SNAPSHOT_ID,
      snapshotKey: SOURCE_SNAPSHOT_KEY,
    },
    revision: {
      revision: 1,
    },
    fingerprint: {
      value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    },
    scope: {
      kind: 'monthly',
      periodStart: '2026-07-01',
      periodEndExclusive: '2026-08-01',
      periodBoundary: '[start,end)',
      timezone: 'Europe/Madrid',
      usageMode: 'basic',
      currency: 'EUR',
    },
    canonicalDocument: {
      payload: {
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
      },
    },
    evidence: {
      records: [],
      context: [{ kind: 'settings-context' }],
      coverageCodes: ['coverage.empty_dataset'],
      warningCodes: [],
    },
    appliedRules: [{ ruleId: 'balance.report.current' }],
    snapshotVersion: 'financial-snapshot/1.0.0',
    canonicalizationVersion: 'financial-snapshot-c14n/2.0.0',
    engineVersion: '1.0.0-phase-1a-minimal',
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal',
  }

  return {
    ...base,
    ...overrides,
  }
}

function createRuntimeInput(
  overrides: Partial<RuntimeAdapterInput> = {},
): RuntimeAdapterInput {
  return {
    executionId: overrides.executionId ?? 'runtime-adapter-exec-001',
    snapshot: overrides.snapshot ?? createSourceSnapshot(),
    rules: overrides.rules ?? [],
    protocolVersion:
      overrides.protocolVersion ?? INSIGHT_RULE_PROTOCOL_VERSION,
    versions: overrides.versions,
  }
}

function createRuntimeSuccessResponse(
  executionId = 'runtime-adapter-exec-001',
): InsightRuntimeSuccess {
  return {
    ok: true,
    status: 'success',
    executionId,
    deterministic: true,
    failClosed: true,
    repositoryUpdated: true,
    collection: {
      protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
      sourceKnowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 1,
      deterministicOutput: true,
      failClosed: true,
      insights: [
        {
          insightId: brand('insight:runtime-adapter:1'),
          rule: {
            ruleId: brand<InsightRuleId>('insight-rule.runtime-adapter'),
            ruleVersion: brand<InsightRuleVersion>('1.0.0'),
            protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
          },
          outputKind: 'observation',
          category: 'cash-flow',
          severity: 'notice',
          titleCode: brand<InsightRuleTitleCode>('insight.title.runtime-adapter'),
          messageCode: brand<InsightRuleMessageCode>('insight.message.runtime-adapter'),
          confidence: {
            mode: 'fixed-score',
            scoreUnit: 'percent-0-100',
            score: 80,
          },
          evidence: {
            evidenceType: 'knowledge-fact-set',
            summaryCode: brand<InsightRuleSummaryCode>('insight.evidence.runtime-adapter'),
            source: 'knowledge',
            traceabilityRequired: true,
            requiredFacts: [FACT_ID],
            matchedFacts: [],
            missingFacts: [FACT_ID],
          },
          traceability: {
            knowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
            sourceSnapshotId: SOURCE_SNAPSHOT_ID,
            sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
            sourceSnapshotRevision: 1,
            rule: {
              ruleId: brand<InsightRuleId>('insight-rule.runtime-adapter'),
              ruleVersion: brand<InsightRuleVersion>('1.0.0'),
              protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
            },
            factIds: [FACT_ID],
          },
        },
      ],
      executions: [],
    },
    assessment: {
      status: 'ok',
      failures: [],
      generatedInsights: 1,
      skippedRules: 0,
    },
    validationReport: createValidationReport([]),
  }
}

function createRuntimeFailureResponse(
  executionId = 'runtime-adapter-exec-001',
): InsightRuntimeFailure {
  return {
    ok: false,
    status: 'failure',
    executionId,
    deterministic: true,
    failClosed: true,
    failureKind: 'validation-rejected',
    code: 'RUNTIME_VALIDATION_REJECTED',
    message: 'runtime rejected the pipeline output',
    validationReport: createValidationReport([
      {
        code: 'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        path: 'collection',
        message: 'collection structure invalid',
      },
    ]),
  }
}

describe('RuntimeAdapter deterministic integration boundary (Milestone 7A)', () => {
  it('adaptacion correcta de KnowledgeCollection', () => {
    const execute = vi.fn(() => createRuntimeSuccessResponse())
    const runtime: RuntimeAdapterRuntimePort = { execute }
    const adapter = createRuntimeAdapter({ runtime })

    const result = adapter.adaptAndExecute(createRuntimeInput())

    expect(execute).toHaveBeenCalledTimes(1)
    const request = execute.mock.calls[0][0] as InsightRuntimeRequest
    expect(request.executionId).toBe('runtime-adapter-exec-001')
    expect(request.knowledgeCollection.state).toBe('validated')
    expect(request.knowledgeCollection.identity.sourceSnapshotId).toBe(
      SOURCE_SNAPSHOT_ID,
    )
    expect(request.knowledgeCollection.factCount).toBeGreaterThan(0)

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.knowledgeCollection.state).toBe('validated')
    }
  })

  it('delegacion al Runtime', () => {
    const execute = vi.fn(() => createRuntimeSuccessResponse())
    const adapter = createRuntimeAdapter({ runtime: { execute } })

    adapter.adaptAndExecute(createRuntimeInput())

    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('propagacion correcta de respuestas de runtime success', () => {
    const runtimeResponse = createRuntimeSuccessResponse('exec-success')
    const adapter = createRuntimeAdapter({
      runtime: {
        execute: vi.fn(() => runtimeResponse),
      },
    })

    const result = adapter.adaptAndExecute(
      createRuntimeInput({ executionId: 'exec-success' }),
    )

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.response).toEqual(runtimeResponse)
    }
  })

  it('propagacion correcta de respuestas de runtime failure', () => {
    const runtimeResponse = createRuntimeFailureResponse('exec-failure')
    const adapter = createRuntimeAdapter({
      runtime: {
        execute: vi.fn(() => runtimeResponse),
      },
    })

    const result = adapter.adaptAndExecute(
      createRuntimeInput({ executionId: 'exec-failure' }),
    )

    expect(result.status).toBe('runtime-failure')
    if (result.status === 'runtime-failure') {
      expect(result.response).toEqual(runtimeResponse)
      expect(result.response.ok).toBe(false)
    }
  })

  it('preservacion de fail-closed ante snapshot incompatible', () => {
    const execute = vi.fn(() => createRuntimeSuccessResponse())
    const adapter = createRuntimeAdapter({ runtime: { execute } })

    const invalidSnapshot = {
      ...createSourceSnapshot(),
      status: 'persisted',
    } as unknown as RuntimeAdapterSourceSnapshot

    const result = adapter.adaptAndExecute(
      createRuntimeInput({ snapshot: invalidSnapshot }),
    )

    expect(result.status).toBe('adapter-failure')
    if (result.status === 'adapter-failure') {
      expect(result.code).toBe('ADAPTER_INCOMPATIBLE_SOURCE_DATA')
      expect(result.failClosed).toBe(true)
      expect(result.deterministic).toBe(true)
    }
    expect(execute).toHaveBeenCalledTimes(0)
  })

  it('coleccion vacia de insights', () => {
    const runtime = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })
    const adapter = createRuntimeAdapter({ runtime })

    const result = adapter.adaptAndExecute(createRuntimeInput({ rules: [] }))

    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.response.collection.insights).toEqual([])
      expect(result.response.collection.executions).toEqual([])
    }
  })

  it('datos incompatibles', () => {
    const adapter = createRuntimeAdapter({
      runtime: {
        execute: vi.fn(() => createRuntimeSuccessResponse()),
      },
    })

    const invalidSnapshot = {
      ...createSourceSnapshot(),
      canonicalDocument: {
        payload: {
          engineResult: {
            incomeCount: 0,
            expenseCount: 0,
            adjustmentCount: 0,
          },
        },
      },
    } as unknown as RuntimeAdapterSourceSnapshot

    const result = adapter.adaptAndExecute(
      createRuntimeInput({ snapshot: invalidSnapshot }),
    )

    expect(result.status).toBe('adapter-failure')
    if (result.status === 'adapter-failure') {
      expect(result.code).toBe('ADAPTER_INCOMPATIBLE_SOURCE_DATA')
    }
  })

  it('determinismo', () => {
    const runtimeResponse = createRuntimeSuccessResponse('deterministic-exec')
    const adapter = createRuntimeAdapter({
      runtime: {
        execute: vi.fn(() => runtimeResponse),
      },
    })
    const input = createRuntimeInput({ executionId: 'deterministic-exec' })

    const first = adapter.adaptAndExecute(input)
    const second = adapter.adaptAndExecute(input)

    expect(first).toEqual(second)
  })

  it('aislamiento respecto al Runtime', () => {
    const execute = vi.fn(() => createRuntimeSuccessResponse())
    const runtime = new Proxy(
      { execute },
      {
        get(target, property) {
          if (property === 'execute') {
            return target.execute
          }

          throw new Error(`unexpected runtime property access: ${String(property)}`)
        },
      },
    ) as unknown as RuntimeAdapterRuntimePort

    const adapter = createRuntimeAdapter({ runtime })

    const result = adapter.adaptAndExecute(createRuntimeInput())

    expect(result.status).toBe('success')
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
