import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createValidationReport } from '../src/insight/validationReport'
import type {
  Insight,
  InsightRuleExecutionStatus,
  InsightRuleExecutionTrace,
} from '../src/insight/types'
import type {
  InsightRuntimeFailure,
  InsightRuntimeSuccess,
} from '../src/insight/runtimeResponse'
import { createInsightReadModels } from '../src/services/insightReadModels'
import type {
  InsightReadModelFailure,
  InsightReadModelProjection,
  InsightReadModelResult,
} from '../src/services/readModelInterfaces'
import type {
  InsightRuleCategory,
  InsightRuleSeverity,
} from '../src/types/insightRule'

const KNOWLEDGE_COLLECTION_ID = 'knowledge-collection:read-models:2026-07'
const SNAPSHOT_ID =
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const SNAPSHOT_KEY = 'snapshot-key:monthly:2026-07'
const SNAPSHOT_REVISION = 3

function brand<T>(value: string | number): T {
  return value as T
}

function asProjection(result: InsightReadModelResult): InsightReadModelProjection {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`expected projection success but got ${result.code}`)
  }

  return result
}

function asFailure(result: InsightReadModelResult): InsightReadModelFailure {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('expected projection failure')
  }

  return result
}

function createInsightFixture(input: {
  readonly id: string
  readonly category: InsightRuleCategory
  readonly severity: InsightRuleSeverity
  readonly confidenceMode: Insight['confidence']['mode']
  readonly confidenceScore: number
}): Insight {
  const ruleReference = {
    ruleId: brand(`insight-rule.${input.id}`),
    ruleVersion: brand('1.0.0'),
    protocolVersion: 1,
  }

  const factId = brand(`knowledge-fact:read-models:${input.id}:1`)

  return {
    insightId: brand(`insight:read-models:${input.id}`),
    rule: ruleReference,
    outputKind: 'observation',
    category: input.category,
    severity: input.severity,
    titleCode: brand(`insight.title.${input.id}`),
    messageCode: brand(`insight.message.${input.id}`),
    confidence: {
      mode: input.confidenceMode,
      scoreUnit: 'percent-0-100',
      score: input.confidenceScore,
    },
    evidence: {
      evidenceType: 'knowledge-fact-set',
      summaryCode: brand(`insight.summary.${input.id}`),
      source: 'knowledge',
      traceabilityRequired: true,
      requiredFacts: [factId],
      matchedFacts: [],
      missingFacts: [factId],
    },
    traceability: {
      knowledgeCollectionId: brand(KNOWLEDGE_COLLECTION_ID),
      sourceSnapshotId: brand(SNAPSHOT_ID),
      sourceSnapshotKey: brand(SNAPSHOT_KEY),
      sourceSnapshotRevision: SNAPSHOT_REVISION,
      rule: ruleReference,
      factIds: [factId],
    },
  } as unknown as Insight
}

function createExecutionTraceFixture(input: {
  readonly id: string
  readonly status: InsightRuleExecutionStatus
  readonly generatedInsightId?: string
}): InsightRuleExecutionTrace {
  const base = {
    rule: {
      ruleId: brand(`insight-rule.${input.id}`),
      ruleVersion: brand('1.0.0'),
      protocolVersion: 1,
    },
    enabled: true,
    status: input.status,
    compatibilityChecks: [],
  }

  if (input.status === 'generated') {
    return {
      ...base,
      generatedInsightId: brand(
        input.generatedInsightId ?? `insight:read-models:${input.id}`,
      ),
    } as unknown as InsightRuleExecutionTrace
  }

  return {
    ...base,
    skipReason: 'rule-disabled',
  } as unknown as InsightRuleExecutionTrace
}

function createRuntimeSuccessResponse(overrides: {
  readonly executionId?: string
  readonly insights?: readonly Insight[]
  readonly executions?: readonly InsightRuleExecutionTrace[]
  readonly generatedInsights?: number
  readonly skippedRules?: number
} = {}): InsightRuntimeSuccess {
  const insights =
    overrides.insights ??
    [
      createInsightFixture({
        id: 'cashflow-critical',
        category: 'cash-flow',
        severity: 'critical',
        confidenceMode: 'fixed-score',
        confidenceScore: 25,
      }),
      createInsightFixture({
        id: 'spending-warning',
        category: 'spending',
        severity: 'warning',
        confidenceMode: 'bounded-score',
        confidenceScore: 70,
      }),
      createInsightFixture({
        id: 'spending-info',
        category: 'spending',
        severity: 'info',
        confidenceMode: 'evidence-derived',
        confidenceScore: 90,
      }),
    ]

  const executions =
    overrides.executions ??
    [
      createExecutionTraceFixture({
        id: 'cashflow-critical',
        status: 'generated',
      }),
      createExecutionTraceFixture({
        id: 'spending-warning',
        status: 'generated',
      }),
      createExecutionTraceFixture({
        id: 'spending-info',
        status: 'generated',
      }),
      createExecutionTraceFixture({
        id: 'skipped-rule',
        status: 'skipped',
      }),
    ]

  return {
    ok: true,
    status: 'success',
    executionId: overrides.executionId ?? 'runtime-exec:read-models:001',
    deterministic: true,
    failClosed: true,
    repositoryUpdated: true,
    collection: {
      protocolVersion: 1,
      sourceKnowledgeCollectionId: brand(KNOWLEDGE_COLLECTION_ID),
      sourceSnapshotId: brand(SNAPSHOT_ID),
      sourceSnapshotKey: brand(SNAPSHOT_KEY),
      sourceSnapshotRevision: SNAPSHOT_REVISION,
      deterministicOutput: true,
      failClosed: true,
      insights,
      executions,
    },
    assessment: {
      status: 'ok',
      failures: [],
      generatedInsights: overrides.generatedInsights ?? insights.length,
      skippedRules:
        overrides.skippedRules ??
        executions.filter((execution) => execution.status === 'skipped').length,
    },
    validationReport: createValidationReport([]),
  }
}

function createRuntimeFailureResponse(): InsightRuntimeFailure {
  return {
    ok: false,
    status: 'failure',
    executionId: 'runtime-exec:read-models:failure',
    deterministic: true,
    failClosed: true,
    failureKind: 'pipeline-failure',
    code: 'RUNTIME_ORCHESTRATOR_FAILURE',
    message: 'runtime pipeline failed',
    validationReport: createValidationReport([
      {
        code: 'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        path: 'collection',
        message: 'collection is invalid',
      },
    ]),
  }
}

describe('InsightReadModels deterministic projection boundary (Milestone 7E)', () => {
  it('proyeccion correcta para respuesta runtime success', () => {
    const runtimeResponse = createRuntimeSuccessResponse()
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    expect(projection.summary.runtimeStatus).toBe('success')
    expect(projection.summary.totalInsights).toBe(3)
    expect(projection.insights).toHaveLength(3)
    expect(projection.insightsByCategory['cash-flow']).toHaveLength(1)
    expect(projection.insightsByCategory.spending).toHaveLength(2)
    expect(projection.insightsBySeverity.critical).toHaveLength(1)
    expect(projection.insightsBySeverity.warning).toHaveLength(1)
    expect(projection.insightsBySeverity.info).toHaveLength(1)
    expect(projection.updateMetadata.executionId).toBe(runtimeResponse.executionId)
    expect(projection.updateMetadata.sourceKnowledgeCollectionId).toBe(
      KNOWLEDGE_COLLECTION_ID,
    )
  })

  it('determinismo', () => {
    const runtimeResponse = createRuntimeSuccessResponse()
    const readModels = createInsightReadModels()

    const first = readModels.project(runtimeResponse)
    const second = readModels.project(runtimeResponse)

    expect(first).toEqual(second)
  })

  it('coleccion vacia', () => {
    const runtimeResponse = createRuntimeSuccessResponse({
      insights: [],
      executions: [],
      generatedInsights: 0,
      skippedRules: 0,
    })
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    expect(projection.summary.totalInsights).toBe(0)
    expect(projection.statistics.totalInsights).toBe(0)
    expect(projection.confidenceIndicators.averageScore).toBeNull()
    expect(projection.confidenceIndicators.minimumScore).toBeNull()
    expect(projection.confidenceIndicators.maximumScore).toBeNull()
    expect(projection.traceability).toEqual([])
  })

  it('trazabilidad preservada para navegacion', () => {
    const runtimeResponse = createRuntimeSuccessResponse()
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    const runtimeInsight = runtimeResponse.collection.insights[0]
    const traceability = projection.traceability[0]

    expect(traceability.insightId).toBe(runtimeInsight.insightId)
    expect(traceability.ruleId).toBe(runtimeInsight.traceability.rule.ruleId)
    expect(traceability.ruleVersion).toBe(
      runtimeInsight.traceability.rule.ruleVersion,
    )
    expect(traceability.knowledgeCollectionId).toBe(
      runtimeInsight.traceability.knowledgeCollectionId,
    )
    expect(traceability.sourceSnapshotId).toBe(
      runtimeInsight.traceability.sourceSnapshotId,
    )
    expect(traceability.sourceSnapshotKey).toBe(
      runtimeInsight.traceability.sourceSnapshotKey,
    )
    expect(traceability.sourceSnapshotRevision).toBe(
      runtimeInsight.traceability.sourceSnapshotRevision,
    )
  })

  it('estadisticas coherentes', () => {
    const runtimeResponse = createRuntimeSuccessResponse()
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    expect(projection.statistics.totalInsights).toBe(3)
    expect(projection.statistics.totalByCategory['cash-flow']).toBe(1)
    expect(projection.statistics.totalByCategory.spending).toBe(2)
    expect(projection.statistics.totalBySeverity.critical).toBe(1)
    expect(projection.statistics.totalBySeverity.warning).toBe(1)
    expect(projection.statistics.totalBySeverity.info).toBe(1)
    expect(projection.statistics.totalByStatus.generated).toBe(3)
    expect(projection.statistics.totalByStatus.skipped).toBe(1)
    expect(projection.statistics.confidenceMinimum).toBe(25)
    expect(projection.statistics.confidenceMaximum).toBe(90)
    expect(projection.statistics.confidenceAverage).toBeCloseTo(61.666666, 5)
    expect(projection.confidenceIndicators.byMode['fixed-score']).toBe(1)
    expect(projection.confidenceIndicators.byMode['bounded-score']).toBe(1)
    expect(projection.confidenceIndicators.byMode['evidence-derived']).toBe(1)
  })

  it('datos de entrada no mutados y salida inmutable', () => {
    const runtimeResponse = createRuntimeSuccessResponse()
    const before = JSON.stringify(runtimeResponse)
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    expect(Object.isFrozen(projection)).toBe(true)
    expect(Object.isFrozen(projection.insights)).toBe(true)
    expect(Object.isFrozen(projection.insights[0])).toBe(true)
    expect(Object.isFrozen(projection.traceability)).toBe(true)

    expect(() => {
      ;(projection.insights as unknown as Array<unknown>).push({})
    }).toThrow()

    expect(() => {
      ;(projection.traceability[0].factIds as unknown as Array<unknown>).push('x')
    }).toThrow()

    expect(JSON.stringify(runtimeResponse)).toBe(before)
  })

  it('runtime failure produce read model fail-closed para UI sin exponer internals', () => {
    const runtimeResponse = createRuntimeFailureResponse()
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    expect(projection.summary.runtimeStatus).toBe('failure')
    expect(projection.summary.totalInsights).toBe(0)
    expect(projection.runtimeFailure?.failureKind).toBe('pipeline-failure')
    expect(projection.runtimeFailure?.code).toBe('RUNTIME_ORCHESTRATOR_FAILURE')
    expect(projection.runtimeFailure?.validationIssueCount).toBe(2)
    expect(projection.insights).toEqual([])
    expect(projection.updateMetadata.repositoryUpdated).toBe(false)
  })

  it('respuesta runtime invalida', () => {
    const readModels = createInsightReadModels()

    const result = readModels.project(null)
    const failure = asFailure(result)

    expect(failure.code).toBe('READ_MODEL_INVALID_RUNTIME_RESPONSE')
    expect(failure.failClosed).toBe(true)
    expect(failure.deterministic).toBe(true)
  })

  it('ausencia de acceso al nucleo interno', () => {
    const source = readFileSync(
      new URL('../src/services/insightReadModels.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('createInsightEngine')).toBe(false)
    expect(source.includes('createInsightRuntime')).toBe(false)
    expect(source.includes('createRuntimeAdapter')).toBe(false)
    expect(source.includes('buildInsightCollection')).toBe(false)
    expect(source.includes('validateInsightCollection')).toBe(false)
    expect(source.includes('createInsightRepository')).toBe(false)
    expect(source.includes('Dexie')).toBe(false)
    expect(source.includes('indexedDB')).toBe(false)
    expect(source.includes('IndexedDB')).toBe(false)
  })

  it('ausencia de logica de negocio', () => {
    const runtimeResponse = createRuntimeSuccessResponse()
    const readModels = createInsightReadModels()

    const result = readModels.project(runtimeResponse)
    const projection = asProjection(result)

    for (const insight of projection.insights) {
      const original = runtimeResponse.collection.insights.find(
        (item) => item.insightId === insight.insightId,
      )

      expect(original).toBeDefined()
      expect(insight.category).toBe(original?.category)
      expect(insight.severity).toBe(original?.severity)
      expect(insight.confidence.score).toBe(original?.confidence.score)
      expect(insight.titleCode).toBe(original?.titleCode)
      expect(insight.messageCode).toBe(original?.messageCode)
    }

    const source = readFileSync(
      new URL('../src/services/insightReadModels.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('generalBalance')).toBe(false)
    expect(source.includes('netProfit')).toBe(false)
    expect(source.includes('incomeCount')).toBe(false)
    expect(source.includes('expenseCount')).toBe(false)
    expect(source.includes('adjustmentCount')).toBe(false)
    expect(source.includes('executeRule')).toBe(false)
  })
})
