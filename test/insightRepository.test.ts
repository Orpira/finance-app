import { describe, expect, it } from 'vitest'

import { createInsightRepository } from '../src/insight/insightRepository'
import type {
  Insight,
  InsightCollection,
  InsightRuleExecutionTrace,
} from '../src/insight/types'
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

const BASE_COLLECTION_ID =
  brand<KnowledgeCollectionId>('knowledge-collection:repo-fixture')
const ALT_COLLECTION_ID =
  brand<KnowledgeCollectionId>('knowledge-collection:repo-alt')

const BASE_SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
)
const ALT_SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
)

const BASE_SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')
const ALT_SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-08')

const FACT_A = brand<KnowledgeFactId>('knowledge-fact:cashflow.stable')
const FACT_B = brand<KnowledgeFactId>('knowledge-fact:spending.high')
const FACT_C = brand<KnowledgeFactId>('knowledge-fact:saving.strong')

function createInsight(index: number, input: {
  readonly insightId: string
  readonly ruleId: string
  readonly category: Insight['category']
  readonly severity: Insight['severity']
  readonly score: number
  readonly collectionId?: KnowledgeCollectionId
  readonly snapshotId?: SealedSnapshotId
  readonly snapshotKey?: SnapshotKey
  readonly snapshotRevision?: number
  readonly factId: KnowledgeFactId
}): Insight {
  const collectionId = input.collectionId ?? BASE_COLLECTION_ID
  const snapshotId = input.snapshotId ?? BASE_SNAPSHOT_ID
  const snapshotKey = input.snapshotKey ?? BASE_SNAPSHOT_KEY
  const snapshotRevision = input.snapshotRevision ?? 3
  const ruleVersion = brand<InsightRuleVersion>('1.0.0')

  return {
    insightId: brand(input.insightId),
    rule: {
      ruleId: brand<InsightRuleId>(input.ruleId),
      ruleVersion,
      protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    },
    outputKind: 'observation',
    category: input.category,
    severity: input.severity,
    titleCode: brand<InsightRuleTitleCode>(`insight.title.${index}`),
    messageCode: brand<InsightRuleMessageCode>(`insight.message.${index}`),
    confidence: {
      mode: 'fixed-score',
      scoreUnit: 'percent-0-100',
      score: input.score,
    },
    evidence: {
      evidenceType: 'knowledge-fact-set',
      summaryCode: brand<InsightRuleSummaryCode>(`insight.evidence.${index}`),
      source: 'knowledge',
      traceabilityRequired: true,
      requiredFacts: [input.factId],
      matchedFacts: [
        {
          factId: input.factId,
          factType: 'cashflow.stable',
          category: 'cashflow',
          severity: 'info',
          sourceSnapshotId: snapshotId,
          sourceSnapshotKey: snapshotKey,
          sourceSnapshotRevision: snapshotRevision,
          sourceFingerprintValue:
            'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        },
      ],
      missingFacts: [],
    },
    traceability: {
      knowledgeCollectionId: collectionId,
      sourceSnapshotId: snapshotId,
      sourceSnapshotKey: snapshotKey,
      sourceSnapshotRevision: snapshotRevision,
      rule: {
        ruleId: brand<InsightRuleId>(input.ruleId),
        ruleVersion,
        protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
      },
      factIds: [input.factId],
    },
  }
}

function executionForInsight(insight: Insight): InsightRuleExecutionTrace {
  return {
    rule: insight.rule,
    enabled: true,
    status: 'generated',
    compatibilityChecks: [
      {
        code: 'rule-protocol-compatible',
        passed: true,
      },
    ],
    generatedInsightId: insight.insightId,
  }
}

function scopeKey(input: {
  readonly collectionId: KnowledgeCollectionId
  readonly snapshotId: SealedSnapshotId
  readonly snapshotKey: SnapshotKey
  readonly snapshotRevision: number
}): string {
  return `${input.collectionId}|${input.snapshotId}|${input.snapshotKey}|${input.snapshotRevision}`
}

function createCollectionA(): InsightCollection {
  const insightA = createInsight(1, {
    insightId: 'insight:a',
    ruleId: 'insight-rule.a',
    category: 'cash-flow',
    severity: 'notice',
    score: 85,
    factId: FACT_A,
  })
  const insightB = createInsight(2, {
    insightId: 'insight:b',
    ruleId: 'insight-rule.b',
    category: 'spending',
    severity: 'warning',
    score: 40,
    factId: FACT_B,
    snapshotId: ALT_SNAPSHOT_ID,
    snapshotKey: ALT_SNAPSHOT_KEY,
    snapshotRevision: 4,
  })
  const insightC = createInsight(3, {
    insightId: 'insight:c',
    ruleId: 'insight-rule.c',
    category: 'savings',
    severity: 'critical',
    score: 93,
    factId: FACT_C,
  })

  return {
    protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    sourceKnowledgeCollectionId: BASE_COLLECTION_ID,
    sourceSnapshotId: BASE_SNAPSHOT_ID,
    sourceSnapshotKey: BASE_SNAPSHOT_KEY,
    sourceSnapshotRevision: 3,
    deterministicOutput: true,
    failClosed: true,
    insights: [insightA, insightB, insightC],
    executions: [
      executionForInsight(insightA),
      executionForInsight(insightB),
      executionForInsight(insightC),
      {
        rule: {
          ruleId: brand<InsightRuleId>('insight-rule.skipped'),
          ruleVersion: brand<InsightRuleVersion>('1.0.0'),
          protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
        },
        enabled: false,
        status: 'skipped',
        compatibilityChecks: [],
        skipReason: 'rule-disabled',
      },
    ],
  }
}

function createCollectionB(): InsightCollection {
  const insight = createInsight(4, {
    insightId: 'insight:replacement',
    ruleId: 'insight-rule.replacement',
    category: 'income',
    severity: 'info',
    score: 70,
    factId: FACT_A,
    collectionId: ALT_COLLECTION_ID,
  })

  return {
    protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
    sourceKnowledgeCollectionId: ALT_COLLECTION_ID,
    sourceSnapshotId: ALT_SNAPSHOT_ID,
    sourceSnapshotKey: ALT_SNAPSHOT_KEY,
    sourceSnapshotRevision: 9,
    deterministicOutput: true,
    failClosed: true,
    insights: [insight],
    executions: [executionForInsight(insight)],
  }
}

describe('InsightRepository in-memory deterministic domain repository (Milestone 6E)', () => {
  it('coleccion vacia', () => {
    const repository = createInsightRepository()

    expect(repository.count()).toBe(0)
    expect(repository.getAll()).toEqual([])
    expect(repository.getStatistics().totalInsights).toBe(0)
  })

  it('replace(collection)', () => {
    const repository = createInsightRepository(createCollectionA())
    const replaced = repository.replace(createCollectionB())

    expect(repository.count()).toBe(3)
    expect(replaced.count()).toBe(1)
    expect(replaced.exists(brand('insight:replacement'))).toBe(true)
    expect(replaced.exists(brand('insight:a'))).toBe(false)
  })

  it('clear()', () => {
    const repository = createInsightRepository(createCollectionA())
    const cleared = repository.clear()

    expect(repository.count()).toBe(3)
    expect(cleared.count()).toBe(0)
    expect(cleared.getAll()).toEqual([])
  })

  it('getAll()', () => {
    const repository = createInsightRepository(createCollectionA())

    const all = repository.getAll()

    expect(all.map((insight) => insight.insightId)).toEqual([
      'insight:a',
      'insight:b',
      'insight:c',
    ])
  })

  it('getById()', () => {
    const repository = createInsightRepository(createCollectionA())

    const found = repository.getById(brand('insight:b'))
    const notFound = repository.getById(brand('insight:unknown'))

    expect(found?.insightId).toBe('insight:b')
    expect(notFound).toBeNull()
  })

  it('exists()', () => {
    const repository = createInsightRepository(createCollectionA())

    expect(repository.exists(brand('insight:a'))).toBe(true)
    expect(repository.exists(brand('insight:missing'))).toBe(false)
  })

  it('count()', () => {
    const repository = createInsightRepository(createCollectionA())
    expect(repository.count()).toBe(3)
  })

  it('getByCategory()', () => {
    const repository = createInsightRepository(createCollectionA())

    const insights = repository.getByCategory('spending')

    expect(insights.map((insight) => insight.insightId)).toEqual(['insight:b'])
  })

  it('getBySeverity()', () => {
    const repository = createInsightRepository(createCollectionA())

    const insights = repository.getBySeverity('critical')

    expect(insights.map((insight) => insight.insightId)).toEqual(['insight:c'])
  })

  it('getByStatus()', () => {
    const repository = createInsightRepository(createCollectionA())

    const generated = repository.getByStatus('generated')
    const skipped = repository.getByStatus('skipped')

    expect(generated.map((insight) => insight.insightId)).toEqual([
      'insight:a',
      'insight:b',
      'insight:c',
    ])
    expect(skipped).toEqual([])
  })

  it('getByScope()', () => {
    const repository = createInsightRepository(createCollectionA())

    const byAltScope = repository.getByScope({
      sourceSnapshotId: ALT_SNAPSHOT_ID,
      sourceSnapshotKey: ALT_SNAPSHOT_KEY,
      sourceSnapshotRevision: 4,
    })

    expect(byAltScope.map((insight) => insight.insightId)).toEqual(['insight:b'])
  })

  it('getByRule()', () => {
    const repository = createInsightRepository(createCollectionA())

    const insights = repository.getByRule(brand<InsightRuleId>('insight-rule.b'))

    expect(insights.map((insight) => insight.insightId)).toEqual(['insight:b'])
  })

  it('filterByConfidence()', () => {
    const repository = createInsightRepository(createCollectionA())

    const filtered = repository.filterByConfidence({
      minimumScore: 80,
      maximumScore: 100,
    })

    expect(filtered.map((insight) => insight.insightId)).toEqual([
      'insight:a',
      'insight:c',
    ])
  })

  it('statistics', () => {
    const repository = createInsightRepository(createCollectionA())
    const statistics = repository.getStatistics()

    const defaultScope = scopeKey({
      collectionId: BASE_COLLECTION_ID,
      snapshotId: BASE_SNAPSHOT_ID,
      snapshotKey: BASE_SNAPSHOT_KEY,
      snapshotRevision: 3,
    })
    const alternativeScope = scopeKey({
      collectionId: BASE_COLLECTION_ID,
      snapshotId: ALT_SNAPSHOT_ID,
      snapshotKey: ALT_SNAPSHOT_KEY,
      snapshotRevision: 4,
    })

    expect(statistics.totalInsights).toBe(3)
    expect(statistics.totalByCategory['cash-flow']).toBe(1)
    expect(statistics.totalByCategory.spending).toBe(1)
    expect(statistics.totalByCategory.savings).toBe(1)
    expect(statistics.totalBySeverity.notice).toBe(1)
    expect(statistics.totalBySeverity.warning).toBe(1)
    expect(statistics.totalBySeverity.critical).toBe(1)
    expect(statistics.totalByStatus.generated).toBe(3)
    expect(statistics.totalByStatus.skipped).toBe(1)
    expect(statistics.totalByScope[defaultScope]).toBe(2)
    expect(statistics.totalByScope[alternativeScope]).toBe(1)
    expect(statistics.confidenceAverage).toBeCloseTo(72.6666666667, 8)
    expect(statistics.confidenceMinimum).toBe(40)
    expect(statistics.confidenceMaximum).toBe(93)
  })

  it('determinismo', () => {
    const repository = createInsightRepository(createCollectionA())

    const first = repository.filterByConfidence({
      minimumScore: 40,
      maximumScore: 90,
    })
    const second = repository.filterByConfidence({
      minimumScore: 40,
      maximumScore: 90,
    })

    expect(second).toEqual(first)
    expect(second).not.toBe(first)

    const firstStatistics = repository.getStatistics()
    const secondStatistics = repository.getStatistics()
    expect(secondStatistics).toEqual(firstStatistics)

    const mutableCopy = repository.getAll() as Insight[]
    mutableCopy.pop()
    expect(repository.count()).toBe(3)
  })

  it('fail-closed', () => {
    const invalidCollection = {
      ...createCollectionA(),
      failClosed: false,
    } as unknown as InsightCollection
    const repository = createInsightRepository(invalidCollection)

    expect(repository.count()).toBe(0)
    expect(repository.getAll()).toEqual([])
    expect(repository.getByStatus('generated')).toEqual([])
    expect(repository.getStatistics().totalInsights).toBe(0)

    const validRepository = createInsightRepository(createCollectionA())
    expect(
      validRepository.filterByConfidence({
        minimumScore: 90,
        maximumScore: 10,
      }),
    ).toEqual([])
  })
})
