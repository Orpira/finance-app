import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import type { InsightEngineResult } from '../src/insight/engineResult'
import { createInsightEngine } from '../src/insight/insightEngine'
import { createInsightRepository } from '../src/insight/insightRepository'
import { createInsightRuntime } from '../src/insight/insightRuntime'
import type { InsightRepository } from '../src/insight/repositoryInterfaces'
import type {
  InsightRuntimeQuery,
  InsightRuntimeSnapshot,
} from '../src/insight/runtimeInterfaces'
import type { InsightRuntimeRequest } from '../src/insight/runtimeRequest'
import type { InsightRuntimeResponse } from '../src/insight/runtimeResponse'
import type {
  Insight,
  InsightCollection,
} from '../src/insight/types'
import { createValidationReport } from '../src/insight/validationReport'
import type {
  IanaTimeZone,
  SealedSnapshotId,
  SnapshotKey,
} from '../src/types/financialSnapshot'
import {
  INSIGHT_RULE_PROTOCOL_VERSION,
  type InsightRuleDescriptor,
  type InsightRuleId,
  type InsightRuleMessageCode,
  type InsightRuleSummaryCode,
  type InsightRuleTitleCode,
  type InsightRuleVersion,
} from '../src/types/insightRule'
import type {
  KnowledgeBuilderVersion,
  KnowledgeCollection,
  KnowledgeCollectionId,
  KnowledgeFactId,
  KnowledgeProjectionVersion,
  KnowledgeRevision,
  KnowledgeRulesVersion,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'
import type { CurrencyCode } from '../src/types/settings'

function brand<T>(value: string | number): T {
  return value as T
}

function expectSuccess(response: InsightRuntimeResponse) {
  expect(response.ok).toBe(true)
  if (!response.ok) {
    throw new Error(`expected success but got ${response.code}`)
  }
  return response
}

function expectFailure(response: InsightRuntimeResponse) {
  expect(response.ok).toBe(false)
  if (response.ok) {
    throw new Error('expected failure response')
  }
  return response
}

const SOURCE_SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:1111111111111111111111111111111111111111111111111111111111111111',
)
const SOURCE_SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')
const SOURCE_KNOWLEDGE_COLLECTION_ID = brand<KnowledgeCollectionId>(
  'knowledge-collection:runtime-fixture',
)
const KNOWLEDGE_VERSION = brand<KnowledgeVersion>('knowledge/1.0.0')
const BUILDER_VERSION =
  brand<KnowledgeBuilderVersion>('knowledge-builder/1.0.0')
const RULES_VERSION = brand<KnowledgeRulesVersion>('knowledge-rules/1.0.0')
const PROJECTION_VERSION =
  brand<KnowledgeProjectionVersion>('knowledge-projection/1.0.0')

const KNOWLEDGE_FACT_ID = brand<KnowledgeFactId>(
  'knowledge-fact:knowledge/1.0.0:financial-snapshot:financial-snapshot-fingerprint/2.0.0:1111111111111111111111111111111111111111111111111111111111111111:cashflow.stable:0000',
)
const KNOWLEDGE_SNAPSHOT_KEY =
  brand<KnowledgeSnapshotKey>('snapshot-key:monthly:2026-07')
const KNOWLEDGE_REVISION = brand<KnowledgeRevision>(1)
const FIXED_TIMEZONE = brand<IanaTimeZone>('Europe/Madrid')
const FIXED_CURRENCY = 'EUR' as CurrencyCode

function createKnowledgeCollection(): KnowledgeCollection {
  return {
    state: 'validated',
    identity: {
      knowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 1,
      sourceFingerprintValue:
        '1111111111111111111111111111111111111111111111111111111111111111',
    },
    versions: {
      knowledgeVersion: KNOWLEDGE_VERSION,
      builderVersion: BUILDER_VERSION,
      rulesVersion: RULES_VERSION,
      projectionVersion: PROJECTION_VERSION,
    },
    facts: [],
    relationships: [],
    factCount: 0,
    validation: {
      status: 'valid',
      checks: [{ code: 'fixture.valid', passed: true }],
      failedChecks: 0,
    },
  }
}

function createRuleDescriptor(ruleIdText = 'insight-rule.runtime'): InsightRuleDescriptor {
  return {
    reference: {
      ruleId: brand<InsightRuleId>(ruleIdText),
      ruleVersion: brand<InsightRuleVersion>('1.0.0'),
      protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    },
    input: {
      dependency: {
        dependencyId: brand('dependency.knowledge.runtime'),
        knowledge: {
          sourceLayer: 'knowledge-layer',
          snapshotTypes: ['knowledge'],
          requiredKnowledgeVersions: [KNOWLEDGE_VERSION],
          minimumKnowledgeRevision: KNOWLEDGE_REVISION,
          snapshotKeyMode: 'whitelist',
          snapshotKeys: [KNOWLEDGE_SNAPSHOT_KEY],
          requiredFacts: [KNOWLEDGE_FACT_ID],
          factMatchPolicy: 'all-required',
          requiredScope: {
            scopeKinds: ['aggregate'],
            requiresAsOf: true,
            currencyRequirement: {
              mode: 'fixed-currency',
              currency: FIXED_CURRENCY,
            },
            timezoneRequirement: {
              mode: 'fixed-timezone',
              timezone: FIXED_TIMEZONE,
            },
          },
          compatibleInsightCategories: ['cash-flow'],
        },
      },
      parameters: [],
    },
    output: {
      outputKind: 'observation',
      titleCode: brand<InsightRuleTitleCode>('insight.title.runtime'),
      messageCode: brand<InsightRuleMessageCode>('insight.message.runtime'),
      category: 'cash-flow',
      severity: 'notice',
      confidencePolicy: {
        mode: 'fixed-score',
        scoreUnit: 'percent-0-100',
        score: 80,
      },
      evidenceType: 'knowledge-fact-set',
    },
    evidence: {
      evidenceType: 'knowledge-fact-set',
      summaryCode: brand<InsightRuleSummaryCode>('insight.evidence.runtime'),
      requiredFacts: [KNOWLEDGE_FACT_ID],
      traceabilityRequired: true,
      source: 'knowledge',
    },
    metadata: {
      domain: 'insight-engine',
      ownerTeam: 'private-balance-insight',
      tags: ['runtime', 'fixture'],
      deterministicIdentity: true,
      deterministicOutput: true,
      localFirst: true,
      failClosed: true,
    },
    compatibility: {
      minimumProtocol: INSIGHT_RULE_PROTOCOL_VERSION,
      maximumProtocol: INSIGHT_RULE_PROTOCOL_VERSION,
      deprecated: false,
      replacementRule: null,
      breakingChanges: [],
      supportedKnowledgeVersion: [KNOWLEDGE_VERSION],
    },
    lifecycle: {
      status: 'active',
      introducedInProtocol: INSIGHT_RULE_PROTOCOL_VERSION,
      deprecatedInProtocol: null,
      retiredInProtocol: null,
    },
  }
}

function createRuntimeRequest(
  input: {
    readonly executionId?: string
    readonly protocolVersion?: number
    readonly knowledgeCollection?: KnowledgeCollection
    readonly rules?: readonly InsightRuleDescriptor[]
  } = {},
): InsightRuntimeRequest {
  return {
    executionId: input.executionId ?? 'runtime-execution-001',
    protocolVersion: input.protocolVersion ?? INSIGHT_RULE_PROTOCOL_VERSION,
    knowledgeCollection: input.knowledgeCollection ?? createKnowledgeCollection(),
    rules: input.rules ?? [],
  }
}

function createInsightFixture(insightIdText = 'insight:runtime:1'): Insight {
  return {
    insightId: brand(insightIdText),
    rule: {
      ruleId: brand<InsightRuleId>('insight-rule.runtime'),
      ruleVersion: brand<InsightRuleVersion>('1.0.0'),
      protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    },
    outputKind: 'observation',
    category: 'cash-flow',
    severity: 'notice',
    titleCode: brand<InsightRuleTitleCode>('insight.title.runtime'),
    messageCode: brand<InsightRuleMessageCode>('insight.message.runtime'),
    confidence: {
      mode: 'fixed-score',
      scoreUnit: 'percent-0-100',
      score: 85,
    },
    evidence: {
      evidenceType: 'knowledge-fact-set',
      summaryCode: brand<InsightRuleSummaryCode>('insight.evidence.runtime'),
      source: 'knowledge',
      traceabilityRequired: true,
      requiredFacts: [KNOWLEDGE_FACT_ID],
      matchedFacts: [],
      missingFacts: [KNOWLEDGE_FACT_ID],
    },
    traceability: {
      knowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 1,
      rule: {
        ruleId: brand<InsightRuleId>('insight-rule.runtime'),
        ruleVersion: brand<InsightRuleVersion>('1.0.0'),
        protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
      },
      factIds: [KNOWLEDGE_FACT_ID],
    },
  }
}

function createCollectionWithInsights(
  insights: readonly Insight[],
): InsightCollection {
  return {
    protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    sourceKnowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
    sourceSnapshotId: SOURCE_SNAPSHOT_ID,
    sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
    sourceSnapshotRevision: 1,
    deterministicOutput: true,
    failClosed: true,
    insights,
    executions: insights.map((insight) => ({
      rule: insight.rule,
      enabled: true,
      status: 'generated' as const,
      compatibilityChecks: [
        {
          code: 'rule-protocol-compatible' as const,
          passed: true,
        },
      ],
      generatedInsightId: insight.insightId,
    })),
  }
}

function createAcceptedResult(
  repository: InsightRepository,
  collection: InsightCollection,
): InsightEngineResult {
  return {
    status: 'accepted',
    deterministic: true,
    failClosed: true,
    repositoryUpdated: true,
    collection,
    assessment: {
      status: 'ok',
      failures: [],
      generatedInsights: collection.insights.length,
      skippedRules: 0,
    },
    validationReport: createValidationReport([]),
    repository: repository.replace(collection),
  }
}

function createRejectedResult(repository: InsightRepository): InsightEngineResult {
  return {
    status: 'rejected',
    deterministic: true,
    failClosed: true,
    repositoryUpdated: false,
    collection: createCollectionWithInsights([]),
    assessment: {
      status: 'blocked',
      failures: [
        {
          code: 'RULE_EXECUTION_BLOCKED',
          message: 'rule failed',
        },
      ],
      generatedInsights: 0,
      skippedRules: 1,
    },
    validationReport: createValidationReport([
      {
        code: 'INSIGHT_VALIDATION_INVALID_STRUCTURE',
        path: 'collection',
        message: 'invalid output',
      },
    ]),
    repository,
  }
}

describe('Insight Runtime stable boundary (Milestone 6G)', () => {
  it('ejecucion exitosa', () => {
    const runtime = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })

    const response = runtime.execute(createRuntimeRequest())
    const success = expectSuccess(response)

    expect(success.status).toBe('success')
    expect(success.deterministic).toBe(true)
    expect(success.failClosed).toBe(true)
    expect(success.validationReport.status).toBe('valid')
    expect(success.collection.insights).toEqual([])
  })

  it('delegacion unica al orchestrator', () => {
    const baseRepository = createInsightRepository()
    const runSpy = vi.fn((input: {
      readonly repository: InsightRepository
    }) => createAcceptedResult(input.repository, createCollectionWithInsights([])))

    const runtime = createInsightRuntime({
      orchestrator: { run: runSpy },
      repository: baseRepository,
    })

    runtime.execute(createRuntimeRequest())

    expect(runSpy).toHaveBeenCalledTimes(1)
  })

  it('respuesta de exito determinista', () => {
    const runtime = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })
    const request = createRuntimeRequest({ executionId: 'runtime-deterministic' })

    const first = runtime.execute(request)
    const second = runtime.execute(request)

    expect(first).toEqual(second)
  })

  it('misma entrada y mismo estado producen la misma salida', () => {
    const request = createRuntimeRequest({ executionId: 'runtime-same-state' })

    const runtimeA = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })
    const runtimeB = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })

    const first = runtimeA.execute(request)
    const second = runtimeB.execute(request)

    expect(first).toEqual(second)
  })

  it('validacion rechazada', () => {
    const baseRepository = createInsightRepository()
    const runtime = createInsightRuntime({
      orchestrator: {
        run: vi.fn(() => createRejectedResult(baseRepository)),
      },
      repository: baseRepository,
    })

    const response = runtime.execute(createRuntimeRequest())
    const failure = expectFailure(response)

    expect(failure.failureKind).toBe('validation-rejected')
    expect(failure.code).toBe('RUNTIME_VALIDATION_REJECTED')
    expect(failure.validationReport?.status).toBe('invalid')
  })

  it('request invalido', () => {
    const runtime = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })

    const response = runtime.execute(null)
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_INVALID_REQUEST')
  })

  it('knowledge collection incompatible', () => {
    const runtime = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })

    const invalidKnowledgeCollection = {
      ...createKnowledgeCollection(),
      state: 'draft',
    } as unknown as KnowledgeCollection

    const response = runtime.execute(
      createRuntimeRequest({
        knowledgeCollection: invalidKnowledgeCollection,
      }),
    )
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_INCOMPATIBLE_KNOWLEDGE_COLLECTION')
  })

  it('catalogo de reglas invalido', () => {
    const runtime = createInsightRuntime({
      orchestrator: createInsightEngine(),
      repository: createInsightRepository(),
    })

    const invalidRule = {
      ...createRuleDescriptor(),
      metadata: {
        ...createRuleDescriptor().metadata,
        failClosed: false,
      },
    } as unknown as InsightRuleDescriptor

    const response = runtime.execute(
      createRuntimeRequest({
        rules: [invalidRule],
      }),
    )
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_INVALID_RULE_CATALOG')
  })

  it('fallo controlado del orchestrator', () => {
    const repository = createInsightRepository()
    const runtime = createInsightRuntime({
      orchestrator: {
        run: vi.fn(() => {
          throw new Error('pipeline crash')
        }),
      },
      repository,
    })

    const response = runtime.execute(createRuntimeRequest())
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_ORCHESTRATOR_FAILURE')
    expect(runtime.count()).toBe(0)
  })

  it('repository actualizado en exito', () => {
    const repository = createInsightRepository()
    const insight = createInsightFixture('insight:runtime:updated')
    const collection = createCollectionWithInsights([insight])

    const runtime = createInsightRuntime({
      orchestrator: {
        run: vi.fn((input: {
          readonly repository: InsightRepository
        }) => createAcceptedResult(input.repository, collection)),
      },
      repository,
    })

    const response = runtime.execute(createRuntimeRequest())
    const success = expectSuccess(response)

    expect(success.repositoryUpdated).toBe(true)
    expect(runtime.count()).toBe(1)
    expect(runtime.exists(brand('insight:runtime:updated'))).toBe(true)
  })

  it('repository intacto en fallo', () => {
    const insight = createInsightFixture('insight:runtime:stable')
    const initialCollection = createCollectionWithInsights([insight])
    const repository = createInsightRepository(initialCollection)
    const runtime = createInsightRuntime({
      orchestrator: {
        run: vi.fn((input: {
          readonly repository: InsightRepository
        }) => createRejectedResult(input.repository)),
      },
      repository,
    })

    const before = runtime.getAll()
    const response = runtime.execute(createRuntimeRequest())
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_VALIDATION_REJECTED')
    expect(runtime.getAll()).toEqual(before)
    expect(runtime.count()).toBe(1)
  })

  it('getSnapshot', () => {
    const insight = createInsightFixture('insight:runtime:snapshot')
    const repository = createInsightRepository(
      createCollectionWithInsights([insight]),
    )
    const runtime = createInsightRuntime({
      repository,
    })

    const snapshot: InsightRuntimeSnapshot = runtime.getSnapshot()

    expect(snapshot.ready).toBe(true)
    expect(snapshot.insightCount).toBe(1)
    expect(snapshot.insights).toHaveLength(1)
    expect(snapshot.statistics.totalInsights).toBe(1)
  })

  it('getAll', () => {
    const insight = createInsightFixture('insight:runtime:get-all')
    const repository = createInsightRepository(
      createCollectionWithInsights([insight]),
    )
    const runtime = createInsightRuntime({
      repository,
    })

    const all = runtime.getAll()
    expect(all).toHaveLength(1)

    const mutable = all as Insight[]
    mutable.pop()

    expect(runtime.count()).toBe(1)
  })

  it('getById', () => {
    const insight = createInsightFixture('insight:runtime:get-by-id')
    const repository = createInsightRepository(
      createCollectionWithInsights([insight]),
    )
    const runtime = createInsightRuntime({
      repository,
    })

    const found = runtime.getById(brand('insight:runtime:get-by-id'))
    const missing = runtime.getById(brand('insight:runtime:missing'))

    expect(found?.insightId).toBe('insight:runtime:get-by-id')
    expect(missing).toBeNull()
  })

  it('query delegada al repository', () => {
    const insight = createInsightFixture('insight:runtime:query')
    const baseRepository = createInsightRepository(
      createCollectionWithInsights([insight]),
    )
    const getByCategorySpy = vi.fn((category: Insight['category']) =>
      baseRepository.getByCategory(category),
    )
    const getAllSpy = vi.fn(() => {
      throw new Error('getAll should not be used for category query')
    })

    const repository: InsightRepository = {
      ...baseRepository,
      getByCategory: getByCategorySpy,
      getAll: getAllSpy,
    }

    const runtime = createInsightRuntime({ repository })

    const result = runtime.query({
      kind: 'by-category',
      category: 'cash-flow',
    })

    expect(result.kind).toBe('insights')
    if (result.kind === 'insights') {
      expect(result.insights).toHaveLength(1)
    }
    expect(getByCategorySpy).toHaveBeenCalledTimes(1)
    expect(getAllSpy).toHaveBeenCalledTimes(0)
  })

  it('count', () => {
    const insight = createInsightFixture('insight:runtime:count')
    const runtime = createInsightRuntime({
      repository: createInsightRepository(createCollectionWithInsights([insight])),
    })

    expect(runtime.count()).toBe(1)
  })

  it('exists', () => {
    const insight = createInsightFixture('insight:runtime:exists')
    const runtime = createInsightRuntime({
      repository: createInsightRepository(createCollectionWithInsights([insight])),
    })

    expect(runtime.exists(brand('insight:runtime:exists'))).toBe(true)
    expect(runtime.exists(brand('insight:runtime:missing'))).toBe(false)
  })

  it('coleccion vacia', () => {
    const runtime = createInsightRuntime({
      repository: createInsightRepository(),
    })

    expect(runtime.count()).toBe(0)
    expect(runtime.getAll()).toEqual([])

    const queryResult = runtime.query({ kind: 'statistics' })
    expect(queryResult.kind).toBe('statistics')
    if (queryResult.kind === 'statistics') {
      expect(queryResult.statistics.totalInsights).toBe(0)
    }
  })

  it('dependencias faltantes', () => {
    const runtime = createInsightRuntime()

    const response = runtime.execute(createRuntimeRequest())
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_MISSING_DEPENDENCY')
  })

  it('fail-closed ante resultado inconsistente del orchestrator', () => {
    const repository = createInsightRepository(
      createCollectionWithInsights([createInsightFixture('insight:runtime:before-fail')]),
    )
    const runtime = createInsightRuntime({
      orchestrator: {
        run: vi.fn(() => ({
          ...createAcceptedResult(repository, createCollectionWithInsights([])),
          repositoryUpdated: false,
        })),
      },
      repository,
    })

    const beforeCount = runtime.count()
    const response = runtime.execute(createRuntimeRequest())
    const failure = expectFailure(response)

    expect(failure.code).toBe('RUNTIME_ORCHESTRATOR_INCONSISTENT_RESULT')
    expect(runtime.count()).toBe(beforeCount)
  })

  it('runtime no duplica logica del repository', () => {
    const baseRepository = createInsightRepository()
    const customStatistics = {
      ...baseRepository.getStatistics(),
      totalInsights: 99,
    }
    const getStatisticsSpy = vi.fn(() => customStatistics)

    const repository: InsightRepository = {
      ...baseRepository,
      getStatistics: getStatisticsSpy,
    }

    const runtime = createInsightRuntime({ repository })
    const result = runtime.query({ kind: 'statistics' } as InsightRuntimeQuery)

    expect(result.kind).toBe('statistics')
    if (result.kind === 'statistics') {
      expect(result.statistics.totalInsights).toBe(99)
    }
    expect(getStatisticsSpy).toHaveBeenCalledTimes(1)
  })

  it('runtime no ejecuta Builder o Validator directamente', () => {
    const source = readFileSync(
      new URL('../src/insight/insightRuntime.ts', import.meta.url),
      'utf8',
    )

    expect(source.includes('buildInsightCollection')).toBe(false)
    expect(source.includes('validateInsightCollection')).toBe(false)
  })
})
