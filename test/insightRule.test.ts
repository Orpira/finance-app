import { describe, expect, it } from 'vitest'

import {
  EMPTY_INSIGHT_RULES_CATALOG,
  INSIGHT_RULE_CATEGORIES,
  INSIGHT_RULE_EVIDENCE_TYPES,
  INSIGHT_RULE_FAIL_CLOSED_INVARIANTS,
  INSIGHT_RULE_FACT_MATCH_POLICIES,
  INSIGHT_RULE_OUTPUT_KINDS,
  INSIGHT_RULE_PARAMETER_KINDS,
  INSIGHT_RULE_PROTOCOL_VERSION,
  INSIGHT_RULE_SCOPE_KINDS,
  INSIGHT_RULE_SEVERITIES,
  INSIGHT_RULE_SNAPSHOT_TYPES,
  INSIGHT_RULE_STATUSES,
  type InsightRuleCatalogVersion,
  type InsightRuleDependencyId,
  type InsightRuleDescriptor,
  type InsightRuleId,
  type InsightRuleMessageCode,
  type InsightRuleParameterId,
  type InsightRulePolicyCode,
  type InsightRuleReference,
  type InsightRuleSummaryCode,
  type InsightRuleTitleCode,
  type InsightRuleVersion,
} from '../src/types/insightRule'
import type { IanaTimeZone } from '../src/types/financialSnapshot'
import type {
  KnowledgeFactId,
  KnowledgeRevision,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
} from '../src/types/knowledgeLayer'
import type { CurrencyCode } from '../src/types/settings'

function brand<T>(value: string | number): T {
  return value as T
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isJsonSafe(value: unknown): boolean {
  if (value === null) {
    return true
  }

  if (typeof value === 'string' || typeof value === 'boolean') {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (
    typeof value === 'undefined' ||
    typeof value === 'bigint' ||
    typeof value === 'symbol' ||
    typeof value === 'function'
  ) {
    return false
  }

  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    return false
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonSafe(entry))
  }

  if (isPlainObject(value)) {
    return Object.values(value).every((entry) => isJsonSafe(entry))
  }

  return false
}

function hasForbiddenKeys(
  value: unknown,
  forbiddenKeys: readonly string[],
): boolean {
  if (Array.isArray(value)) {
    return value.some((entry) => hasForbiddenKeys(entry, forbiddenKeys))
  }

  if (!isPlainObject(value)) {
    return false
  }

  return Object.entries(value).some(([key, entry]) => {
    if (forbiddenKeys.includes(key)) {
      return true
    }
    return hasForbiddenKeys(entry, forbiddenKeys)
  })
}

const KNOWLEDGE_VERSION = brand<KnowledgeVersion>('knowledge/1.0.0')
const KNOWLEDGE_REVISION = brand<KnowledgeRevision>(1)
const KNOWLEDGE_FACT_ID = brand<KnowledgeFactId>('knowledge-fact:cashflow.stable')
const KNOWLEDGE_SNAPSHOT_KEY =
  brand<KnowledgeSnapshotKey>('knowledge-key:monthly:2026-07')
const FIXED_CURRENCY = 'EUR' as CurrencyCode
const FIXED_TIMEZONE = brand<IanaTimeZone>('Europe/Madrid')

const sampleRuleReference: InsightRuleReference = {
  ruleId: brand<InsightRuleId>('insight-rule.cash-flow.stable'),
  ruleVersion: brand<InsightRuleVersion>('1.0.0'),
  protocolVersion: INSIGHT_RULE_PROTOCOL_VERSION,
}

const sampleRuleDescriptor: InsightRuleDescriptor = {
  reference: sampleRuleReference,
  input: {
    dependency: {
      dependencyId: brand<InsightRuleDependencyId>('dependency.knowledge.cash-flow'),
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
        compatibleInsightCategories: ['cash-flow', 'trend'],
      },
    },
    parameters: [
      {
        parameterId: brand<InsightRuleParameterId>('parameter.window-days'),
        name: 'windowDays',
        kind: 'integer',
        required: true,
        defaultValue: 30,
        constraint: {
          kind: 'integer-range',
          minimum: 1,
          maximum: 365,
        },
      },
    ],
  },
  output: {
    outputKind: 'observation',
    titleCode: brand<InsightRuleTitleCode>('insight.title.cash-flow.stable'),
    messageCode: brand<InsightRuleMessageCode>('insight.message.cash-flow.stable'),
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
    requiredFacts: [KNOWLEDGE_FACT_ID],
    traceabilityRequired: true,
    source: 'knowledge',
  },
  metadata: {
    domain: 'insight-engine',
    ownerTeam: 'private-balance-insight',
    tags: ['cash-flow', 'foundation'],
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

describe('insightRule constants', () => {
  it('declares protocol version 1', () => {
    expect(INSIGHT_RULE_PROTOCOL_VERSION).toBe(1)
  })

  it('declares closed categories', () => {
    expect(INSIGHT_RULE_CATEGORIES).toEqual([
      'cash-flow',
      'spending',
      'income',
      'savings',
      'balance',
      'trend',
      'anomaly',
      'recurring',
      'data-quality',
    ])
  })

  it('declares closed severities', () => {
    expect(INSIGHT_RULE_SEVERITIES).toEqual([
      'info',
      'notice',
      'warning',
      'critical',
    ])
  })

  it('declares closed lifecycle statuses', () => {
    expect(INSIGHT_RULE_STATUSES).toEqual([
      'draft',
      'active',
      'deprecated',
      'retired',
    ])
  })

  it('declares closed snapshot types', () => {
    expect(INSIGHT_RULE_SNAPSHOT_TYPES).toEqual(['knowledge'])
  })

  it('declares closed scope kinds', () => {
    expect(INSIGHT_RULE_SCOPE_KINDS).toEqual(['aggregate', 'account'])
  })

  it('declares closed fact matching policies', () => {
    expect(INSIGHT_RULE_FACT_MATCH_POLICIES).toEqual([
      'all-required',
      'any-required',
      'at-least-one',
    ])
  })

  it('declares closed evidence types', () => {
    expect(INSIGHT_RULE_EVIDENCE_TYPES).toEqual([
      'knowledge-fact-set',
      'knowledge-fact-link',
      'knowledge-snapshot-derivation',
    ])
  })

  it('declares closed parameter kinds', () => {
    expect(INSIGHT_RULE_PARAMETER_KINDS).toEqual([
      'string',
      'integer',
      'boolean',
      'enum',
      'string-list',
      'integer-list',
      'json-object',
    ])
  })

  it('declares closed output kinds', () => {
    expect(INSIGHT_RULE_OUTPUT_KINDS).toEqual([
      'observation',
      'warning',
      'anomaly',
      'trend',
    ])
  })

  it('declares fail-closed invariants for future validator milestones', () => {
    expect(INSIGHT_RULE_FAIL_CLOSED_INVARIANTS).toEqual([
      'duplicate-rule-identity',
      'incompatible-protocol-version',
      'unknown-rule-category',
      'missing-dependency-contract',
      'missing-message-code',
      'missing-title-code',
      'invalid-confidence-policy',
      'incompatible-facts-contract',
    ])
  })
})

describe('insightRule descriptor contracts', () => {
  it('keeps identity deterministic and serializable', () => {
    const serialized = JSON.stringify(sampleRuleReference)
    const parsed = JSON.parse(serialized)

    expect(parsed.ruleId).toBe('insight-rule.cash-flow.stable')
    expect(parsed.ruleVersion).toBe('1.0.0')
    expect(parsed.protocolVersion).toBe(1)
  })

  it('keeps descriptor serializable', () => {
    const serialized = JSON.stringify(sampleRuleDescriptor)
    const parsed = JSON.parse(serialized)

    expect(parsed.reference.ruleId).toBe('insight-rule.cash-flow.stable')
    expect(parsed.output.category).toBe('cash-flow')
    expect(parsed.output.severity).toBe('notice')
  })

  it('keeps descriptor JSON-safe', () => {
    expect(isJsonSafe(sampleRuleDescriptor)).toBe(true)
  })

  it('does not include forbidden runtime fields in descriptor', () => {
    expect(
      hasForbiddenKeys(sampleRuleDescriptor, [
        'generatedAt',
        'evaluatedAt',
        'persistedAt',
        'uuid',
      ]),
    ).toBe(false)
  })

  it('declares explicit knowledge dependencies', () => {
    expect(sampleRuleDescriptor.input.dependency.knowledge.sourceLayer).toBe(
      'knowledge-layer',
    )
    expect(sampleRuleDescriptor.input.dependency.knowledge.requiredFacts).toHaveLength(1)
    expect(sampleRuleDescriptor.input.dependency.knowledge.factMatchPolicy).toBe(
      'all-required',
    )
  })

  it('declares output by codes instead of localized text', () => {
    expect(sampleRuleDescriptor.output.titleCode).toBe(
      'insight.title.cash-flow.stable',
    )
    expect(sampleRuleDescriptor.output.messageCode).toBe(
      'insight.message.cash-flow.stable',
    )
  })

  it('declares compatibility bounds', () => {
    expect(sampleRuleDescriptor.compatibility.minimumProtocol).toBe(1)
    expect(sampleRuleDescriptor.compatibility.maximumProtocol).toBe(1)
    expect(sampleRuleDescriptor.compatibility.deprecated).toBe(false)
    expect(sampleRuleDescriptor.compatibility.replacementRule).toBeNull()
  })

  it('declares lifecycle without runtime behavior', () => {
    expect(sampleRuleDescriptor.lifecycle.status).toBe('active')
    expect(sampleRuleDescriptor.lifecycle.introducedInProtocol).toBe(1)
    expect(sampleRuleDescriptor.lifecycle.deprecatedInProtocol).toBeNull()
  })

  it('supports readonly shape via structural typing', () => {
    const readonlyDescriptor: Readonly<InsightRuleDescriptor> = sampleRuleDescriptor

    expect(readonlyDescriptor.metadata.failClosed).toBe(true)
  })
})

describe('insightRule catalog contracts', () => {
  it('exposes an empty valid catalog ready for future rules', () => {
    expect(EMPTY_INSIGHT_RULES_CATALOG.protocolVersion).toBe(1)
    expect(EMPTY_INSIGHT_RULES_CATALOG.rules).toEqual([])
  })

  it('keeps catalog fail-closed invariants aligned', () => {
    expect(EMPTY_INSIGHT_RULES_CATALOG.failClosedInvariants).toEqual(
      INSIGHT_RULE_FAIL_CLOSED_INVARIANTS,
    )
  })

  it('keeps catalog serializable', () => {
    const serialized = JSON.stringify(EMPTY_INSIGHT_RULES_CATALOG)
    const parsed = JSON.parse(serialized)

    expect(parsed.protocolVersion).toBe(1)
    expect(parsed.rules).toEqual([])
  })

  it('keeps catalog version deterministic', () => {
    const catalogVersion: InsightRuleCatalogVersion =
      EMPTY_INSIGHT_RULES_CATALOG.catalogVersion

    expect(catalogVersion).toBe('insight-rules-catalog/1.0.0')
  })
})

describe('insightRule confidence policy contracts', () => {
  it('accepts fixed-score confidence policy', () => {
    const fixed = sampleRuleDescriptor.output.confidencePolicy

    expect(fixed.mode).toBe('fixed-score')
  })

  it('accepts bounded-score confidence policy', () => {
    const bounded: InsightRuleDescriptor = {
      ...sampleRuleDescriptor,
      output: {
        ...sampleRuleDescriptor.output,
        confidencePolicy: {
          mode: 'bounded-score',
          scoreUnit: 'percent-0-100',
          minimumScore: 40,
          maximumScore: 90,
        },
      },
    }

    expect(bounded.output.confidencePolicy.mode).toBe('bounded-score')
  })

  it('accepts evidence-derived confidence policy', () => {
    const policyCode = brand<InsightRulePolicyCode>('policy.confidence.evidence.v1')
    const derived: InsightRuleDescriptor = {
      ...sampleRuleDescriptor,
      output: {
        ...sampleRuleDescriptor.output,
        confidencePolicy: {
          mode: 'evidence-derived',
          scoreUnit: 'percent-0-100',
          policyCode,
        },
      },
    }

    expect(derived.output.confidencePolicy.mode).toBe('evidence-derived')
  })
})