import { describe, expect, it } from 'vitest'

import { buildInsightCollection } from '../src/insight/insightBuilder'
import type { InsightBuilderDependencies } from '../src/insight/interfaces'
import type {
  Insight,
  InsightRuleSkipReasonCode,
} from '../src/insight/types'
import type {
  CanonicalizationVersion,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedSnapshotId,
  SnapshotKey,
  SnapshotVersion,
} from '../src/types/financialSnapshot'
import type {
  InsightRuleConfidencePolicy,
  InsightRuleDescriptor,
  InsightRuleEvidenceType,
  InsightRuleId,
  InsightRuleMessageCode,
  InsightRuleSummaryCode,
  InsightRuleTitleCode,
  InsightRuleVersion,
} from '../src/types/insightRule'
import type {
  KnowledgeBuilderVersion,
  KnowledgeFact,
  KnowledgeFactId,
  KnowledgeProjectionVersion,
  KnowledgeRevision,
  KnowledgeRulesVersion,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
  ValidatedKnowledgeCollection,
} from '../src/types/knowledgeLayer'
import type { CurrencyCode } from '../src/types/settings'

function brand<T>(value: string | number): T {
  return value as T
}

const SOURCE_SNAPSHOT_ID =
  brand<SealedSnapshotId>(
    'financial-snapshot:financial-snapshot-fingerprint/2.0.0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  )
const SOURCE_SNAPSHOT_KEY =
  brand<SnapshotKey>('snapshot-key:monthly:2026-07')
const KNOWLEDGE_SNAPSHOT_KEY =
  brand<KnowledgeSnapshotKey>('snapshot-key:monthly:2026-07')
const KNOWLEDGE_VERSION = brand<KnowledgeVersion>('knowledge/1.0.0')
const BUILDER_VERSION =
  brand<KnowledgeBuilderVersion>('knowledge-builder/1.0.0')
const RULES_VERSION = brand<KnowledgeRulesVersion>('knowledge-rules/1.0.0')
const PROJECTION_VERSION =
  brand<KnowledgeProjectionVersion>('knowledge-projection/1.0.0')
const CURRENCY = 'EUR' as CurrencyCode
const TIMEZONE = brand<IanaTimeZone>('Europe/Madrid')
const MINIMUM_REVISION = brand<KnowledgeRevision>(1)

const FACT_CASHFLOW_STABLE =
  brand<KnowledgeFactId>('knowledge-fact:cashflow.stable')
const FACT_INCOME_PRESENT =
  brand<KnowledgeFactId>('knowledge-fact:income.present')
const FACT_MISSING = brand<KnowledgeFactId>('knowledge-fact:missing')

function createKnowledgeFact(input: {
  factId: KnowledgeFactId
  factType: KnowledgeFact['factType']
  category: KnowledgeFact['category']
}): KnowledgeFact {
  return {
    factId: input.factId,
    factType: input.factType,
    category: input.category,
    severity: 'info',
    confidence: 'certain',
    source: 'financial-snapshot',
    status: 'projected',
    scope: {
      kind: 'monthly',
      periodStart: '2026-07-01',
      periodEndExclusive: '2026-08-01',
      periodBoundary: '[start,end)',
      timezone: TIMEZONE,
      usageMode: 'basic',
      currency: CURRENCY,
    },
    context: {
      usageMode: 'basic',
      currency: CURRENCY,
      timezone: TIMEZONE,
      periodStart: '2026-07-01',
      periodEndExclusive: '2026-08-01',
    },
    origin: {
      source: 'financial-snapshot',
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 3,
      sourceSnapshotVersion:
        'financial-snapshot/1.0.0' as SnapshotVersion,
      sourceCanonicalizationVersion:
        'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
      sourceEngineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
      sourceRulesetVersion:
        'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
    },
    evidence: {
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 3,
      sourceFingerprintValue:
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      sourceAppliedRuleIds: ['balance.report.current'],
      sourceRecordIds: [1001],
      sourceContextKinds: ['settings-context'],
      coverageCodes: ['coverage.complete'],
      warningCodes: [],
      sourcePaths: ['canonicalDocument.payload.engineResult'],
    },
    relationships: [],
  }
}

const FACTS: readonly KnowledgeFact[] = [
  createKnowledgeFact({
    factId: FACT_CASHFLOW_STABLE,
    factType: 'cashflow.stable',
    category: 'cashflow',
  }),
  createKnowledgeFact({
    factId: FACT_INCOME_PRESENT,
    factType: 'income.present',
    category: 'income',
  }),
]

function createValidatedKnowledgeCollection(
  facts: readonly KnowledgeFact[] = FACTS,
  knowledgeVersion: KnowledgeVersion = KNOWLEDGE_VERSION,
): ValidatedKnowledgeCollection {
  return {
    state: 'validated',
    identity: {
      knowledgeCollectionId: brand('knowledge-collection:test-2026-07'),
      sourceSnapshotId: SOURCE_SNAPSHOT_ID,
      sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
      sourceSnapshotRevision: 3,
      sourceFingerprintValue:
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    versions: {
      knowledgeVersion,
      builderVersion: BUILDER_VERSION,
      rulesVersion: RULES_VERSION,
      projectionVersion: PROJECTION_VERSION,
    },
    facts,
    relationships: [],
    factCount: facts.length,
    validation: {
      status: 'valid',
      checks: [{ code: 'fixture.valid', passed: true }],
      failedChecks: 0,
    },
  }
}

function createRule(input: {
  ruleId: string
  ruleVersion?: string
  status?: InsightRuleDescriptor['lifecycle']['status']
  requiredFacts?: readonly [KnowledgeFactId, ...KnowledgeFactId[]]
  factMatchPolicy?: InsightRuleDescriptor['input']['dependency']['knowledge']['factMatchPolicy']
  confidencePolicy?: InsightRuleConfidencePolicy
  outputCategory?: InsightRuleDescriptor['output']['category']
  compatibleInsightCategories?: readonly InsightRuleDescriptor['output']['category'][]
  supportedKnowledgeVersion?: readonly KnowledgeVersion[]
  requiredKnowledgeVersion?: readonly KnowledgeVersion[]
  snapshotKeyMode?: InsightRuleDescriptor['input']['dependency']['knowledge']['snapshotKeyMode']
  snapshotKeys?: readonly KnowledgeSnapshotKey[]
  evidenceType?: InsightRuleEvidenceType
}): InsightRuleDescriptor {
  const requiredFacts = input.requiredFacts ?? [FACT_CASHFLOW_STABLE]
  const outputCategory = input.outputCategory ?? 'cash-flow'
  const evidenceType = input.evidenceType ?? 'knowledge-fact-set'

  return {
    reference: {
      ruleId: brand<InsightRuleId>(input.ruleId),
      ruleVersion: brand<InsightRuleVersion>(input.ruleVersion ?? '1.0.0'),
      protocolVersion: 1,
    },
    input: {
      dependency: {
        dependencyId: brand('dependency.knowledge.fixture'),
        knowledge: {
          sourceLayer: 'knowledge-layer',
          snapshotTypes: ['knowledge'],
          requiredKnowledgeVersions:
            input.requiredKnowledgeVersion ?? [KNOWLEDGE_VERSION],
          minimumKnowledgeRevision: MINIMUM_REVISION,
          snapshotKeyMode: input.snapshotKeyMode ?? 'whitelist',
          snapshotKeys: input.snapshotKeys ?? [KNOWLEDGE_SNAPSHOT_KEY],
          requiredFacts,
          factMatchPolicy: input.factMatchPolicy ?? 'all-required',
          requiredScope: {
            scopeKinds: ['aggregate'],
            requiresAsOf: true,
            currencyRequirement: { mode: 'input-currency' },
            timezoneRequirement: { mode: 'any-iana' },
          },
          compatibleInsightCategories:
            input.compatibleInsightCategories ?? [outputCategory],
        },
      },
      parameters: [],
    },
    output: {
      outputKind: 'observation',
      titleCode: brand<InsightRuleTitleCode>('insight.title.fixture'),
      messageCode: brand<InsightRuleMessageCode>('insight.message.fixture'),
      category: outputCategory,
      severity: 'notice',
      confidencePolicy: input.confidencePolicy ?? {
        mode: 'fixed-score',
        scoreUnit: 'percent-0-100',
        score: 88,
      },
      evidenceType,
    },
    evidence: {
      evidenceType,
      summaryCode: brand<InsightRuleSummaryCode>('insight.evidence.fixture'),
      requiredFacts,
      traceabilityRequired: true,
      source: 'knowledge',
    },
    metadata: {
      domain: 'insight-engine',
      ownerTeam: 'private-balance-insight',
      tags: ['builder', 'deterministic'],
      deterministicIdentity: true,
      deterministicOutput: true,
      localFirst: true,
      failClosed: true,
    },
    compatibility: {
      minimumProtocol: 1,
      maximumProtocol: 1,
      deprecated: false,
      replacementRule: null,
      breakingChanges: [],
      supportedKnowledgeVersion:
        input.supportedKnowledgeVersion ?? [KNOWLEDGE_VERSION],
    },
    lifecycle: {
      status: input.status ?? 'active',
      introducedInProtocol: 1,
      deprecatedInProtocol: null,
      retiredInProtocol: null,
    },
  }
}

function firstExecutionSkipReason(result: ReturnType<typeof buildInsightCollection>):
  | InsightRuleSkipReasonCode
  | undefined {
  return result.collection.executions[0]?.skipReason
}

function firstInsight(result: ReturnType<typeof buildInsightCollection>): Insight {
  const insight = result.collection.insights[0]
  if (insight === undefined) {
    throw new Error('expected one insight')
  }
  return insight
}

describe('InsightBuilder deterministic runtime (Milestone 6C)', () => {
  it('executes one enabled compatible rule', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [createRule({ ruleId: 'insight-rule.cashflow.stable' })],
    })

    expect(result.assessment.status).toBe('ok')
    expect(result.collection.insights).toHaveLength(1)
    expect(result.collection.executions).toHaveLength(1)
    expect(result.collection.executions[0].status).toBe('generated')
  })

  it('executes multiple enabled compatible rules', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [
        createRule({
          ruleId: 'insight-rule.b.income',
          requiredFacts: [FACT_INCOME_PRESENT],
          outputCategory: 'income',
          compatibleInsightCategories: ['income'],
        }),
        createRule({ ruleId: 'insight-rule.a.cashflow' }),
      ],
    })

    expect(result.assessment.status).toBe('ok')
    expect(result.collection.insights).toHaveLength(2)
    expect(result.collection.insights.map((insight) => insight.rule.ruleId)).toEqual([
      'insight-rule.a.cashflow',
      'insight-rule.b.income',
    ])
  })

  it('skips disabled rules', () => {
    const result = buildInsightCollection(
      {
        knowledgeCollection: createValidatedKnowledgeCollection(),
        rules: [createRule({ ruleId: 'insight-rule.disabled' })],
      },
      {
        ruleEnablement: {
          isRuleEnabled: () => false,
        },
      },
    )

    expect(result.collection.insights).toHaveLength(0)
    expect(firstExecutionSkipReason(result)).toBe('rule-disabled')
  })

  it('enforces input compatibility before producing insights', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [
        createRule({
          ruleId: 'insight-rule.incompatible',
          requiredFacts: [FACT_MISSING],
        }),
      ],
    })

    expect(result.collection.insights).toHaveLength(0)
    expect(firstExecutionSkipReason(result)).toBe('incompatible-input')
    expect(result.collection.executions[0].compatibilityChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'facts-match-policy',
          passed: false,
        }),
      ]),
    )
  })

  it('generates deterministic evidence with full traceability', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [createRule({ ruleId: 'insight-rule.evidence' })],
    })

    const insight = firstInsight(result)

    expect(insight.evidence.requiredFacts).toEqual([FACT_CASHFLOW_STABLE])
    expect(insight.evidence.matchedFacts).toHaveLength(1)
    expect(insight.evidence.matchedFacts[0].factId).toBe(FACT_CASHFLOW_STABLE)
    expect(insight.traceability.knowledgeCollectionId).toBe(
      result.collection.sourceKnowledgeCollectionId,
    )
    expect(insight.traceability.rule.ruleId).toBe('insight-rule.evidence')
    expect(insight.traceability.factIds).toEqual([FACT_CASHFLOW_STABLE])
  })

  it('calculates confidence from fixed, bounded and evidence-derived policies', () => {
    const dependencies: InsightBuilderDependencies = {
      confidencePolicyResolver: {
        evaluateEvidenceDerivedConfidence: () => 73,
      },
    }

    const result = buildInsightCollection(
      {
        knowledgeCollection: createValidatedKnowledgeCollection(),
        rules: [
          createRule({ ruleId: 'insight-rule.conf.fixed' }),
          createRule({
            ruleId: 'insight-rule.conf.bounded',
            confidencePolicy: {
              mode: 'bounded-score',
              scoreUnit: 'percent-0-100',
              minimumScore: 40,
              maximumScore: 80,
            },
          }),
          createRule({
            ruleId: 'insight-rule.conf.derived',
            confidencePolicy: {
              mode: 'evidence-derived',
              scoreUnit: 'percent-0-100',
              policyCode: brand('policy.confidence.evidence.v1'),
            },
          }),
        ],
      },
      dependencies,
    )

    const byRuleId = new Map(
      result.collection.insights.map((insight) => [insight.rule.ruleId, insight]),
    )

    expect(byRuleId.get('insight-rule.conf.fixed')?.confidence.score).toBe(88)
    expect(byRuleId.get('insight-rule.conf.bounded')?.confidence.score).toBe(60)
    expect(byRuleId.get('insight-rule.conf.derived')?.confidence.score).toBe(73)
  })

  it('is deterministic for same input and same dependencies', () => {
    const dependencies: InsightBuilderDependencies = {
      confidencePolicyResolver: {
        evaluateEvidenceDerivedConfidence: () => 66,
      },
    }

    const input = {
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [
        createRule({ ruleId: 'insight-rule.det.a' }),
        createRule({
          ruleId: 'insight-rule.det.b',
          confidencePolicy: {
            mode: 'evidence-derived',
            scoreUnit: 'percent-0-100',
            policyCode: brand('policy.confidence.det.v1'),
          },
        }),
      ],
    }

    const first = buildInsightCollection(input, dependencies)
    const second = buildInsightCollection(input, dependencies)

    expect(second).toEqual(first)
  })

  it('handles empty knowledge collection fail-closed', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection([]),
      rules: [createRule({ ruleId: 'insight-rule.empty-collection' })],
    })

    expect(result.assessment.status).toBe('ok')
    expect(result.collection.insights).toHaveLength(0)
    expect(firstExecutionSkipReason(result)).toBe('incompatible-input')
  })

  it('handles empty rules collection', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [],
    })

    expect(result.assessment.status).toBe('ok')
    expect(result.collection.insights).toEqual([])
    expect(result.collection.executions).toEqual([])
  })

  it('fails closed when confidence cannot be resolved', () => {
    const result = buildInsightCollection({
      knowledgeCollection: createValidatedKnowledgeCollection(),
      rules: [
        createRule({
          ruleId: 'insight-rule.fail-closed',
          confidencePolicy: {
            mode: 'evidence-derived',
            scoreUnit: 'percent-0-100',
            policyCode: brand('policy.confidence.missing-resolver.v1'),
          },
        }),
      ],
    })

    expect(result.assessment.status).toBe('blocked')
    expect(result.assessment.failures).toEqual([
      expect.objectContaining({
        code: 'RULE_EXECUTION_BLOCKED',
        message: 'confidence-not-resolved',
      }),
    ])
    expect(result.collection.insights).toHaveLength(0)
    expect(firstExecutionSkipReason(result)).toBe('confidence-not-resolved')
  })
})
