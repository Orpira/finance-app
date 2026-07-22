import { describe, expect, it } from 'vitest'

import { validateInsightCollection } from '../src/insight/insightValidator'
import type { InsightCollection, InsightRuleExecutionTrace } from '../src/insight/types'
import type { ValidationReport } from '../src/insight/validationReport'
import type { ValidationIssueCode } from '../src/insight/validationIssue'
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
  KnowledgeCollectionId,
  KnowledgeFactId,
  KnowledgeRevision,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'
import type { CurrencyCode } from '../src/types/settings'

function brand<T>(value: string | number): T {
  return value as T
}

function expectIssue(report: ValidationReport, code: ValidationIssueCode): void {
  expect(report.issues.some((issue) => issue.code === code)).toBe(true)
}

const SOURCE_KNOWLEDGE_COLLECTION_ID = brand<KnowledgeCollectionId>(
  'knowledge-collection:validator-fixture',
)
const SOURCE_SNAPSHOT_ID = brand<SealedSnapshotId>(
  'financial-snapshot:financial-snapshot-fingerprint/2.0.0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
)
const SOURCE_SNAPSHOT_KEY = brand<SnapshotKey>('snapshot-key:monthly:2026-07')
const SOURCE_SNAPSHOT_REVISION = 3

const KNOWLEDGE_VERSION = brand<KnowledgeVersion>('knowledge/1.0.0')
const MINIMUM_REVISION = brand<KnowledgeRevision>(1)
const KNOWLEDGE_SNAPSHOT_KEY =
  brand<KnowledgeSnapshotKey>('snapshot-key:monthly:2026-07')
const FACT_ID = brand<KnowledgeFactId>('knowledge-fact:cashflow.stable')

const FIXED_CURRENCY = 'EUR' as CurrencyCode
const FIXED_TIMEZONE = brand<IanaTimeZone>('Europe/Madrid')

const RULE_REFERENCE = {
  ruleId: brand<InsightRuleId>('insight-rule.cash-flow.stable'),
  ruleVersion: brand<InsightRuleVersion>('1.0.0'),
  protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
} as const

const BASE_RULE: InsightRuleDescriptor = {
  reference: RULE_REFERENCE,
  input: {
    dependency: {
      dependencyId: brand('dependency.knowledge.cash-flow'),
      knowledge: {
        sourceLayer: 'knowledge-layer',
        snapshotTypes: ['knowledge'],
        requiredKnowledgeVersions: [KNOWLEDGE_VERSION],
        minimumKnowledgeRevision: MINIMUM_REVISION,
        snapshotKeyMode: 'whitelist',
        snapshotKeys: [KNOWLEDGE_SNAPSHOT_KEY],
        requiredFacts: [FACT_ID],
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
    titleCode: brand<InsightRuleTitleCode>('insight.title.cash-flow.stable'),
    messageCode: brand<InsightRuleMessageCode>(
      'insight.message.cash-flow.stable',
    ),
    category: 'cash-flow',
    severity: 'notice',
    confidencePolicy: {
      mode: 'fixed-score',
      scoreUnit: 'percent-0-100',
      score: 85,
    },
    evidenceType: 'knowledge-fact-set',
  },
  evidence: {
    evidenceType: 'knowledge-fact-set',
    summaryCode: brand<InsightRuleSummaryCode>('insight.evidence.cash-flow.stable'),
    requiredFacts: [FACT_ID],
    traceabilityRequired: true,
    source: 'knowledge',
  },
  metadata: {
    domain: 'insight-engine',
    ownerTeam: 'private-balance-insight',
    tags: ['validator', 'deterministic'],
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
    supportedKnowledgeVersion: [KNOWLEDGE_VERSION],
  },
  lifecycle: {
    status: 'active',
    introducedInProtocol: 1,
    deprecatedInProtocol: null,
    retiredInProtocol: null,
  },
}

const BASE_COLLECTION: InsightCollection = {
  protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
  sourceKnowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
  sourceSnapshotId: SOURCE_SNAPSHOT_ID,
  sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
  sourceSnapshotRevision: SOURCE_SNAPSHOT_REVISION,
  deterministicOutput: true,
  failClosed: true,
  insights: [
    {
      insightId: brand('insight:insight-rule.cash-flow.stable:1.0.0:knowledge-collection:validator-fixture'),
      rule: RULE_REFERENCE,
      outputKind: 'observation',
      category: 'cash-flow',
      severity: 'notice',
      titleCode: brand<InsightRuleTitleCode>('insight.title.cash-flow.stable'),
      messageCode: brand<InsightRuleMessageCode>('insight.message.cash-flow.stable'),
      confidence: {
        mode: 'fixed-score',
        scoreUnit: 'percent-0-100',
        score: 85,
      },
      evidence: {
        evidenceType: 'knowledge-fact-set',
        summaryCode: brand<InsightRuleSummaryCode>('insight.evidence.cash-flow.stable'),
        source: 'knowledge',
        traceabilityRequired: true,
        requiredFacts: [FACT_ID],
        matchedFacts: [
          {
            factId: FACT_ID,
            factType: 'cashflow.stable',
            category: 'cashflow',
            severity: 'info',
            sourceSnapshotId: SOURCE_SNAPSHOT_ID,
            sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
            sourceSnapshotRevision: SOURCE_SNAPSHOT_REVISION,
            sourceFingerprintValue:
              'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          },
        ],
        missingFacts: [],
      },
      traceability: {
        knowledgeCollectionId: SOURCE_KNOWLEDGE_COLLECTION_ID,
        sourceSnapshotId: SOURCE_SNAPSHOT_ID,
        sourceSnapshotKey: SOURCE_SNAPSHOT_KEY,
        sourceSnapshotRevision: SOURCE_SNAPSHOT_REVISION,
        rule: RULE_REFERENCE,
        factIds: [FACT_ID],
      },
    },
  ],
  executions: [
    {
      rule: RULE_REFERENCE,
      enabled: true,
      status: 'generated',
      compatibilityChecks: [
        {
          code: 'rule-protocol-compatible',
          passed: true,
        },
      ],
      generatedInsightId:
        brand('insight:insight-rule.cash-flow.stable:1.0.0:knowledge-collection:validator-fixture'),
    },
  ],
}

function createRuleCatalog(): readonly InsightRuleDescriptor[] {
  return [structuredClone(BASE_RULE)]
}

function createCollection(): InsightCollection {
  return structuredClone(BASE_COLLECTION)
}

describe('InsightValidator deterministic certification (Milestone 6D)', () => {
  it('valida una coleccion correcta', () => {
    const report = validateInsightCollection({
      collection: createCollection(),
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('valid')
    expect(report.issueCount).toBe(0)
    expect(report.issues).toEqual([])
  })

  it('acepta coleccion vacia', () => {
    const base = createCollection()
    const emptyCollection: InsightCollection = {
      ...base,
      insights: [],
      executions: [],
    }

    const report = validateInsightCollection({
      collection: emptyCollection,
      rules: [],
    })

    expect(report.status).toBe('valid')
    expect(report.issueCount).toBe(0)
  })

  it('rechaza insight ids duplicados', () => {
    const base = createCollection()
    const duplicateCollection: InsightCollection = {
      ...base,
      insights: [
        ...base.insights,
        {
          ...base.insights[0],
        },
      ],
    }

    const report = validateInsightCollection({
      collection: duplicateCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_DUPLICATE_ID')
  })

  it('rechaza evidence invalida', () => {
    const base = createCollection()
    const invalidCollection: InsightCollection = {
      ...base,
      insights: [
        {
          ...base.insights[0],
          evidence: {
            ...base.insights[0].evidence,
            matchedFacts: [],
          },
        },
      ],
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_INVALID_EVIDENCE')
  })

  it('rechaza confidence fuera de rango', () => {
    const base = createCollection()
    const invalidCollection: InsightCollection = {
      ...base,
      insights: [
        {
          ...base.insights[0],
          confidence: {
            ...base.insights[0].confidence,
            score: 101,
          },
        },
      ],
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_INVALID_CONFIDENCE')
  })

  it('rechaza referencia a regla inexistente', () => {
    const report = validateInsightCollection({
      collection: createCollection(),
      rules: [],
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_RULE_REFERENCE_NOT_FOUND')
  })

  it('rechaza incompatibilidad de version', () => {
    const base = createCollection()
    const invalidCollection: InsightCollection = {
      ...base,
      protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION + 1,
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_INCOMPATIBLE_VERSION')
  })

  it('rechaza status invalido', () => {
    const base = createCollection()
    const invalidExecution: InsightRuleExecutionTrace = {
      ...base.executions[0],
      status: 'unknown' as unknown as InsightRuleExecutionTrace['status'],
    }
    const invalidCollection: InsightCollection = {
      ...base,
      executions: [invalidExecution],
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_INVALID_STATUS')
  })

  it('rechaza severity invalida', () => {
    const base = createCollection()
    const invalidCollection: InsightCollection = {
      ...base,
      insights: [
        {
          ...base.insights[0],
          severity: 'fatal' as unknown as InsightCollection['insights'][number]['severity'],
        },
      ],
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_INVALID_SEVERITY')
  })

  it('rechaza categoria invalida', () => {
    const base = createCollection()
    const invalidCollection: InsightCollection = {
      ...base,
      insights: [
        {
          ...base.insights[0],
          category: 'portfolio' as unknown as InsightCollection['insights'][number]['category'],
        },
      ],
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expectIssue(report, 'INSIGHT_VALIDATION_INVALID_CATEGORY')
  })

  it('aplica fail-closed sin excepciones', () => {
    const base = createCollection()
    const invalidCollection: InsightCollection = {
      ...base,
      executions: [
        {
          ...base.executions[0],
          status: 'unknown' as unknown as InsightRuleExecutionTrace['status'],
        },
      ],
    }

    const report = validateInsightCollection({
      collection: invalidCollection,
      rules: createRuleCatalog(),
    })

    expect(report.status).toBe('invalid')
    expect(report.failClosed).toBe(true)
    expectIssue(report, 'INSIGHT_VALIDATION_FAIL_CLOSED')
  })

  it('es determinista para la misma entrada', () => {
    const base = createCollection()
    const deterministicInput: InsightCollection = {
      ...base,
      insights: [
        {
          ...base.insights[0],
          confidence: {
            ...base.insights[0].confidence,
            score: 111,
          },
        },
      ],
    }

    const first = validateInsightCollection({
      collection: deterministicInput,
      rules: createRuleCatalog(),
    })
    const second = validateInsightCollection({
      collection: deterministicInput,
      rules: createRuleCatalog(),
    })

    expect(second).toEqual(first)
  })
})