import { describe, expect, it } from 'vitest'

import {
  INSIGHT_AGGREGATE_SCOPES,
  INSIGHT_CATEGORIES,
  INSIGHT_CONFIDENCE_MAX,
  INSIGHT_CONFIDENCE_MIN,
  INSIGHT_EVIDENCE_TYPES,
  INSIGHT_IDENTITY_PREIMAGE_FIELDS,
  INSIGHT_NON_DETERMINISTIC_FIELDS,
  INSIGHT_PROTOCOL_VERSION,
  INSIGHT_SEVERITIES,
  INSIGHT_SOURCES,
  INSIGHT_STATUSES,
  INSIGHT_TIMEZONE_POLICIES,
  type Insight,
  type InsightBuildDiagnosticCode,
  type InsightBuildResult,
  type InsightCollection,
  type InsightCollectionId,
  type InsightConfidenceScore,
  type InsightId,
  type InsightMessageCode,
  type InsightRuleId,
  type InsightRuleVersion,
  type InsightSummaryCode,
  type InsightTitleCode,
  type InsightValidationCheckCode,
  type InsightValidationResult,
} from '../src/types/insightLayer'
import type {
  IanaTimeZone,
  UtcInstant,
} from '../src/types/financialSnapshot'
import type {
  KnowledgeFactId,
  KnowledgeRevision,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
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

const SAMPLE_AS_OF = brand<UtcInstant>('2026-07-18T00:00:00.000Z')
const SAMPLE_TIMEZONE = brand<IanaTimeZone>('Europe/Madrid')
const SAMPLE_CURRENCY = 'EUR' as CurrencyCode
const SAMPLE_KNOWLEDGE_SNAPSHOT_ID =
  brand<KnowledgeSnapshotId>(
    'knowledge-snapshot:knowledge-fingerprint/1.0.0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  )
const SAMPLE_KNOWLEDGE_SNAPSHOT_KEY =
  brand<KnowledgeSnapshotKey>('knowledge-key:monthly:2026-07')
const SAMPLE_KNOWLEDGE_REVISION = brand<KnowledgeRevision>(4)
const SAMPLE_FACT_ID = brand<KnowledgeFactId>('knowledge-fact:cashflow.stable')

const sampleInsight: Insight = {
  insightId: brand<InsightId>('insight:cash-flow:stable:2026-07'),
  protocolVersion: INSIGHT_PROTOCOL_VERSION,
  category: 'cash-flow',
  severity: 'notice',
  confidence: brand<InsightConfidenceScore>(84),
  status: 'candidate',
  titleCode: brand<InsightTitleCode>('insight.title.cash-flow.stable'),
  messageCode: brand<InsightMessageCode>('insight.message.cash-flow.stable'),
  rule: {
    ruleId: brand<InsightRuleId>('insight-rule.cash-flow.stable'),
    ruleVersion: brand<InsightRuleVersion>('1.0.0'),
  },
  source: 'knowledge',
  scope: {
    scopeKind: 'aggregate',
    aggregateScope: 'all-accounts',
    asOf: SAMPLE_AS_OF,
    currency: SAMPLE_CURRENCY,
    timezone: SAMPLE_TIMEZONE,
    timezonePolicy: 'snapshot-timezone',
  },
  evidence: [
    {
      source: 'knowledge',
      knowledgeSnapshotId: SAMPLE_KNOWLEDGE_SNAPSHOT_ID,
      knowledgeSnapshotKey: SAMPLE_KNOWLEDGE_SNAPSHOT_KEY,
      knowledgeRevision: SAMPLE_KNOWLEDGE_REVISION,
      factIds: [SAMPLE_FACT_ID],
      evidenceType: 'knowledge-fact-set',
      summaryCode: brand<InsightSummaryCode>('insight.evidence.cash-flow.stable'),
    },
  ],
  parameters: {
    normalizedWindowDays: 30,
    accountCount: 3,
    tags: ['cash-flow', 'stable'],
    metadata: {
      deterministic: true,
      source: 'knowledge',
    },
  },
  supersedesInsightIds: [],
  traceability: {
    deterministicIdentity: true,
    appendOnly: true,
    canonicalizationRequired: true,
    identityPreimageFields: [...INSIGHT_IDENTITY_PREIMAGE_FIELDS],
  },
}

const sampleCollection: InsightCollection = {
  collectionId: brand<InsightCollectionId>('insight-collection:2026-07:1'),
  protocolVersion: INSIGHT_PROTOCOL_VERSION,
  source: 'knowledge',
  sourceKnowledgeSnapshotId: SAMPLE_KNOWLEDGE_SNAPSHOT_ID,
  sourceKnowledgeSnapshotKey: SAMPLE_KNOWLEDGE_SNAPSHOT_KEY,
  sourceKnowledgeRevision: SAMPLE_KNOWLEDGE_REVISION,
  scope: sampleInsight.scope,
  collectionRevision: 1,
  insights: [sampleInsight],
  supersedesCollectionId: null,
  traceability: sampleInsight.traceability,
  compatibility: {
    sourceLayer: 'knowledge-layer',
    acceptedSources: [...INSIGHT_SOURCES],
    requiresKnowledgeEvidence: true,
  },
}

describe('insightLayer constants', () => {
  it('uses protocol version 1 as initial contract version', () => {
    expect(INSIGHT_PROTOCOL_VERSION).toBe(1)
  })

  it('defines normalized confidence bounds', () => {
    expect(INSIGHT_CONFIDENCE_MIN).toBe(0)
    expect(INSIGHT_CONFIDENCE_MAX).toBe(100)
  })

  it('defines the initial closed category catalog', () => {
    expect(INSIGHT_CATEGORIES).toEqual([
      'cash-flow',
      'spending',
      'income',
      'savings',
      'balance',
      'recurring',
      'anomaly',
      'trend',
      'data-quality',
    ])
  })

  it('does not include out-of-scope categories', () => {
    expect(INSIGHT_CATEGORIES).not.toContain('investment')
    expect(INSIGHT_CATEGORIES).not.toContain('taxes')
    expect(INSIGHT_CATEGORIES).not.toContain('credit')
    expect(INSIGHT_CATEGORIES).not.toContain('prediction')
  })

  it('defines the initial closed severity catalog', () => {
    expect(INSIGHT_SEVERITIES).toEqual([
      'info',
      'notice',
      'warning',
      'critical',
    ])
  })

  it('defines the initial closed status catalog', () => {
    expect(INSIGHT_STATUSES).toEqual([
      'candidate',
      'validated',
      'rejected',
      'superseded',
    ])
  })

  it('limits source catalog to knowledge and none', () => {
    expect(INSIGHT_SOURCES).toEqual(['knowledge', 'none'])
  })

  it('defines closed evidence type catalog', () => {
    expect(INSIGHT_EVIDENCE_TYPES).toEqual([
      'knowledge-fact-set',
      'knowledge-fact-link',
      'knowledge-snapshot-derivation',
    ])
  })

  it('defines closed timezone policies', () => {
    expect(INSIGHT_TIMEZONE_POLICIES).toEqual([
      'snapshot-timezone',
      'fixed-timezone',
    ])
  })

  it('defines closed aggregate scopes', () => {
    expect(INSIGHT_AGGREGATE_SCOPES).toEqual([
      'all-accounts',
      'included-accounts',
    ])
  })

  it('declares deterministic preimage fields for future identity derivation', () => {
    expect(INSIGHT_IDENTITY_PREIMAGE_FIELDS).toEqual([
      'protocolVersion',
      'ruleId',
      'ruleVersion',
      'category',
      'scope',
      'evidence',
      'parameters',
    ])
  })

  it('tracks disallowed non-deterministic fields', () => {
    expect(INSIGHT_NON_DETERMINISTIC_FIELDS).toEqual([
      'generatedAt',
      'evaluatedAt',
      'sealedAt',
      'persistedAt',
      'arrayPosition',
      'uuid',
      'randomSeed',
    ])
  })
})

describe('insightLayer contract fixtures', () => {
  it('creates a serializable Insight example', () => {
    const serialized = JSON.stringify(sampleInsight)
    const parsed = JSON.parse(serialized)

    expect(parsed.protocolVersion).toBe(1)
    expect(parsed.category).toBe('cash-flow')
    expect(parsed.source).toBe('knowledge')
  })

  it('creates a serializable InsightCollection example', () => {
    const serialized = JSON.stringify(sampleCollection)
    const parsed = JSON.parse(serialized)

    expect(parsed.protocolVersion).toBe(1)
    expect(parsed.collectionRevision).toBe(1)
    expect(parsed.insights).toHaveLength(1)
  })

  it('keeps confidence sample inside declared bounds', () => {
    const score = sampleInsight.confidence as unknown as number

    expect(Number.isInteger(score)).toBe(true)
    expect(score).toBeGreaterThanOrEqual(INSIGHT_CONFIDENCE_MIN)
    expect(score).toBeLessThanOrEqual(INSIGHT_CONFIDENCE_MAX)
  })

  it('keeps scope aligned with required temporal fields', () => {
    expect(sampleInsight.scope.asOf).toBe(SAMPLE_AS_OF)
    expect(sampleInsight.scope.currency).toBe(SAMPLE_CURRENCY)
    expect(sampleInsight.scope.timezone).toBe(SAMPLE_TIMEZONE)
  })

  it('supports account scope contract shape', () => {
    const accountScoped: Insight = {
      ...sampleInsight,
      scope: {
        scopeKind: 'account',
        accountScope: ['account:1', 'account:2'],
        asOf: SAMPLE_AS_OF,
        currency: SAMPLE_CURRENCY,
        timezone: SAMPLE_TIMEZONE,
        timezonePolicy: 'fixed-timezone',
      },
    }

    expect(accountScoped.scope.scopeKind).toBe('account')
  })

  it('keeps evidence non-empty and linked to fact ids', () => {
    expect(sampleInsight.evidence).toHaveLength(1)
    expect(sampleInsight.evidence[0].factIds.length).toBeGreaterThan(0)
  })

  it('reuses Knowledge identity types in evidence and collection references', () => {
    const evidence = sampleInsight.evidence[0]
    const typedSnapshotId: KnowledgeSnapshotId = evidence.knowledgeSnapshotId
    const typedSnapshotKey: KnowledgeSnapshotKey = evidence.knowledgeSnapshotKey
    const typedRevision: KnowledgeRevision = evidence.knowledgeRevision
    const typedFactId: KnowledgeFactId = evidence.factIds[0]
    const typedCollectionSnapshotId: KnowledgeSnapshotId | null =
      sampleCollection.sourceKnowledgeSnapshotId

    expect([
      typedSnapshotId,
      typedSnapshotKey,
      String(typedRevision),
      typedFactId,
      typedCollectionSnapshotId,
    ].every(Boolean)).toBe(true)
  })

  it('keeps source aligned with the closed source catalog', () => {
    expect(INSIGHT_SOURCES).toContain(sampleInsight.source)
    expect(INSIGHT_SOURCES).toContain(sampleCollection.source)
  })

  it('keeps severity aligned with the closed severity catalog', () => {
    expect(INSIGHT_SEVERITIES).toContain(sampleInsight.severity)
  })

  it('keeps category aligned with the closed category catalog', () => {
    expect(INSIGHT_CATEGORIES).toContain(sampleInsight.category)
  })

  it('keeps status aligned with the closed status catalog', () => {
    expect(INSIGHT_STATUSES).toContain(sampleInsight.status)
  })

  it('keeps parameters JSON-safe', () => {
    expect(isJsonSafe(sampleInsight.parameters)).toBe(true)
  })

  it('keeps traceability metadata JSON-safe', () => {
    expect(isJsonSafe(sampleInsight.traceability)).toBe(true)
  })

  it('keeps collection and insight free from disallowed non-deterministic fields', () => {
    expect(
      hasForbiddenKeys(sampleInsight, INSIGHT_NON_DETERMINISTIC_FIELDS),
    ).toBe(false)
    expect(
      hasForbiddenKeys(sampleCollection, INSIGHT_NON_DETERMINISTIC_FIELDS),
    ).toBe(false)
  })

  it('supports source none with explicit null knowledge references', () => {
    const noneCollection: InsightCollection = {
      ...sampleCollection,
      source: 'none',
      sourceKnowledgeSnapshotId: null,
      sourceKnowledgeSnapshotKey: null,
      sourceKnowledgeRevision: null,
      insights: [],
    }

    expect(noneCollection.source).toBe('none')
    expect(noneCollection.sourceKnowledgeSnapshotId).toBeNull()
    expect(noneCollection.sourceKnowledgeSnapshotKey).toBeNull()
    expect(noneCollection.sourceKnowledgeRevision).toBeNull()
  })

  it('keeps compatibility metadata aligned to Knowledge Layer', () => {
    expect(sampleCollection.compatibility.sourceLayer).toBe('knowledge-layer')
    expect(sampleCollection.compatibility.acceptedSources).toEqual([
      'knowledge',
      'none',
    ])
    expect(sampleCollection.compatibility.requiresKnowledgeEvidence).toBe(true)
  })

  it('accepts readonly compatibility through TypeScript structural typing', () => {
    const readonlyCollection: Readonly<InsightCollection> = sampleCollection

    expect(readonlyCollection.protocolVersion).toBe(INSIGHT_PROTOCOL_VERSION)
  })
})

describe('insightLayer future result placeholders', () => {
  it('defines a serializable valid validation result contract', () => {
    const validResult: InsightValidationResult = {
      status: 'valid',
      checks: [
        {
          code: brand<InsightValidationCheckCode>('insight.validation.protocol'),
          passed: true,
          errorCode: null,
        },
      ],
      failedChecks: 0,
      failures: [],
    }

    expect(isJsonSafe(validResult)).toBe(true)
    expect(validResult.failedChecks).toBe(0)
  })

  it('defines a serializable invalid validation result contract', () => {
    const invalidResult: InsightValidationResult = {
      status: 'invalid',
      checks: [
        {
          code: brand<InsightValidationCheckCode>('insight.validation.source'),
          passed: false,
          errorCode: 'INSIGHT_VALIDATION_UNKNOWN_SOURCE',
        },
      ],
      failedChecks: 1,
      failures: [
        {
          code: brand<InsightValidationCheckCode>('insight.validation.source'),
          errorCode: 'INSIGHT_VALIDATION_UNKNOWN_SOURCE',
        },
      ],
    }

    expect(isJsonSafe(invalidResult)).toBe(true)
    expect(invalidResult.failedChecks).toBe(1)
  })

  it('defines a serializable built result contract', () => {
    const builtResult: InsightBuildResult = {
      status: 'built',
      protocolVersion: INSIGHT_PROTOCOL_VERSION,
      collection: sampleCollection,
      diagnostics: [],
    }

    expect(isJsonSafe(builtResult)).toBe(true)
    expect(builtResult.status).toBe('built')
  })

  it('defines serializable skipped and failed build result contracts', () => {
    const skippedResult: InsightBuildResult = {
      status: 'skipped',
      protocolVersion: INSIGHT_PROTOCOL_VERSION,
      collection: null,
      diagnostics: [
        {
          code: brand<InsightBuildDiagnosticCode>('insight.build.feature-disabled'),
          messageCode: brand<InsightMessageCode>('insight.build.message.skipped'),
        },
      ],
    }

    const failedResult: InsightBuildResult = {
      status: 'failed',
      protocolVersion: INSIGHT_PROTOCOL_VERSION,
      collection: null,
      diagnostics: [
        {
          code: brand<InsightBuildDiagnosticCode>('insight.build.contract-invalid'),
          messageCode: brand<InsightMessageCode>('insight.build.message.failed'),
        },
      ],
    }

    expect(isJsonSafe(skippedResult)).toBe(true)
    expect(isJsonSafe(failedResult)).toBe(true)
    expect(skippedResult.status).toBe('skipped')
    expect(failedResult.status).toBe('failed')
  })
})