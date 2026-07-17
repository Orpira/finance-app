import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import { canonicalizeValidatedKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import { validateKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import { fingerprintCanonicalKnowledgeDocument } from '../src/intelligence/knowledge-layer/knowledgeFingerprint'
import {
  assessKnowledgeSnapshotPromotion,
  KnowledgePromotionPolicyError,
} from '../src/intelligence/knowledge-layer/knowledgePromotionPolicy'
import {
  deriveKnowledgeSnapshotKey,
  sealCanonicalKnowledgeDocument,
} from '../src/intelligence/knowledge-layer/knowledgeSealer'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedFinancialSnapshot,
  SnapshotVersion,
  UtcInstant,
} from '../src/types/financialSnapshot'
import type {
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeRevisionReasonCode,
  KnowledgeRulesVersion,
  KnowledgeProjectionVersion,
  KnowledgeVersion,
  SealedKnowledgeSnapshot,
} from '../src/types/knowledgeLayer'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const policyPath = resolve(
  __dirname,
  '../src/intelligence/knowledge-layer/knowledgePromotionPolicy.ts',
)
const policySource = readFileSync(policyPath, 'utf8')

const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const BUILDER_VERSION = 'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const PROJECTION_VERSION = 'knowledge-projection/1.0.0' as KnowledgeProjectionVersion
const REVISION_REASON = 'revision.source_changed' as KnowledgeRevisionReasonCode
const at = '2026-07-16T00:00:00.000Z' as UtcInstant

type EngineResultFixture = {
  readonly balanceReport: {
    readonly hasData: boolean
    readonly generalBalance: number
    readonly netProfit: number
  }
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

function baseEngineResult(
  overrides: Partial<EngineResultFixture> = {},
): EngineResultFixture {
  const base: EngineResultFixture = {
    balanceReport: {
      hasData: true,
      generalBalance: 200,
      netProfit: 120,
    },
    incomeCount: 2,
    expenseCount: 1,
    adjustmentCount: 0,
  }

  return {
    balanceReport: {
      ...base.balanceReport,
      ...(overrides.balanceReport ?? {}),
    },
    incomeCount: overrides.incomeCount ?? base.incomeCount,
    expenseCount: overrides.expenseCount ?? base.expenseCount,
    adjustmentCount: overrides.adjustmentCount ?? base.adjustmentCount,
  }
}

function baseSnapshot(
  engineResult: EngineResultFixture,
  overrides: Record<string, unknown> = {},
): SealedFinancialSnapshot<EngineResultFixture> {
  const snapshot = {
    identity: {
      snapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/2.0.0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      snapshotKey: 'snapshot-key:monthly:2026-07',
    },
    revision: {
      revision: 3,
      reasonCode: 'revision.source_changed',
      supersedesSnapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/2.0.0:1111111111111111111111111111111111111111111111111111111111111111',
    },
    status: 'sealed',
    canonicalDocument: {
      canonicalizationVersion:
        'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
      payload: {
        snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
        engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
        rulesetVersion:
          'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
        scope: {
          kind: 'monthly',
          periodStart: '2026-07-01' as CivilDate,
          periodEndExclusive: '2026-08-01' as CivilDate,
          periodBoundary: '[start,end)',
          timezone: 'Europe/Madrid' as IanaTimeZone,
          usageMode: 'basic',
          currency: 'EUR',
          filters: {},
        },
        engineResult,
        evidence: {
          strategy: 'embedded-v1',
          records: [],
          context: [],
          candidateRecordCount: 0,
          includedRecordCount: 0,
          excludedRecordCount: 0,
          coverageCodes: [],
          warningCodes: [],
        },
        appliedRules: [],
        metadata: {
          generationReasonCode: 'generation.shadow_evaluation',
          provenance: 'local',
          qualityCodes: [],
          warningCodes: [],
          limitationCodes: [],
        },
        asOfPolicy: 'monthly-render-as-of-operational',
      },
      operationalMetadata: {
        generatedAt: at,
        sourceScopeAsOf: at,
      },
    },
    fingerprint: {
      value:
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      algorithm: 'SHA-256',
      encoding: 'hex-lower',
      domain: 'private-balance:financial-snapshot:fingerprint:v2:',
      fingerprintVersion: 'financial-snapshot-fingerprint/2.0.0',
      canonicalizationVersion:
        'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
      hashedComponent: 'material-payload',
    },
    sealedAt: at,
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
    scope: {
      kind: 'monthly',
      periodStart: '2026-07-01' as CivilDate,
      periodEndExclusive: '2026-08-01' as CivilDate,
      periodBoundary: '[start,end)',
      asOf: at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic',
      currency: 'EUR',
      filters: {},
    },
    evidence: {
      strategy: 'embedded-v1',
      records: [{ sourceId: 10, kind: 'income' }],
      context: [{ kind: 'settings-context' }],
      candidateRecordCount: 1,
      includedRecordCount: 1,
      excludedRecordCount: 0,
      coverageCodes: ['coverage.complete'],
      warningCodes: [],
    },
    appliedRules: [{ ruleId: 'balance.report.current' }],
    metadata: {
      generatedAt: at,
      generationReasonCode: 'generation.shadow_evaluation',
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
    ...overrides,
  }

  return snapshot as unknown as SealedFinancialSnapshot<EngineResultFixture>
}

function builderInput(
  snapshot: SealedFinancialSnapshot<EngineResultFixture>,
): KnowledgeBuilderInput<EngineResultFixture> {
  return {
    snapshot,
    knowledgeVersion: KNOWLEDGE_VERSION,
    builderVersion: BUILDER_VERSION,
    rulesVersion: RULES_VERSION,
    projectionVersion: PROJECTION_VERSION,
  }
}

async function validSnapshot(
  engineResult: EngineResultFixture = baseEngineResult(),
): Promise<SealedKnowledgeSnapshot> {
  const draft = buildKnowledgeCollectionFromSnapshot(
    builderInput(baseSnapshot(engineResult)),
  )
  const validated = validateKnowledgeCollection(draft)
  const canonicalDocument = canonicalizeValidatedKnowledgeCollection(validated)
  const fingerprint = await fingerprintCanonicalKnowledgeDocument(canonicalDocument)
  const knowledgeSnapshotKey = deriveKnowledgeSnapshotKey(canonicalDocument)
  return sealCanonicalKnowledgeDocument({
    canonicalDocument,
    fingerprint,
    knowledgeSnapshotKey,
    revision: 3,
    revisionReasonCode: REVISION_REASON,
    sealedAt: at,
    supersedesKnowledgeSnapshotId:
      'knowledge-snapshot:knowledge-fingerprint/1.0.0:1111111111111111111111111111111111111111111111111111111111111111',
  })
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function mutate(
  snapshot: SealedKnowledgeSnapshot,
  action: (value: Record<string, unknown>) => void,
): SealedKnowledgeSnapshot {
  const copy = clone(snapshot) as unknown as Record<string, unknown>
  action(copy)
  return copy as unknown as SealedKnowledgeSnapshot
}

function failed(snapshot: SealedKnowledgeSnapshot, code: string): boolean {
  return assessKnowledgeSnapshotPromotion(snapshot).failedChecks.some(
    (failure) => failure.code === code,
  )
}

describe('Knowledge Promotion Policy', () => {
  it('declares a valid sealed knowledge snapshot eligible', async () => {
    const snapshot = await validSnapshot()
    const assessment = assessKnowledgeSnapshotPromotion(snapshot)

    expect(assessment.eligible).toBe(true)
    expect(assessment.status).toBe('eligible')
    expect(assessment.failedChecks).toEqual([])
    expect(assessment.checks).toHaveLength(32)
    expect(assessment.warnings).toEqual([
      { code: 'policy.external_context_not_evaluated' },
      { code: 'policy.fingerprint_not_recomputed' },
    ])
  })

  it('throws on a completely invalid root contract', () => {
    expect(() => assessKnowledgeSnapshotPromotion(null as never)).toThrow(
      KnowledgePromotionPolicyError,
    )
    expect(() => assessKnowledgeSnapshotPromotion(null as never)).toThrow(
      'KNOWLEDGE_PROMOTION_INVALID_CONTRACT',
    )
  })

  it('is deterministic for the same snapshot', async () => {
    const snapshot = await validSnapshot()
    const first = assessKnowledgeSnapshotPromotion(snapshot)
    const second = assessKnowledgeSnapshotPromotion(snapshot)
    expect(second).toEqual(first)
  })

  it('does not mutate the input snapshot', async () => {
    const snapshot = await validSnapshot()
    const before = clone(snapshot)
    assessKnowledgeSnapshotPromotion(snapshot)
    expect(snapshot).toEqual(before)
  })

  it('rejects a status other than sealed', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.status = 'persisted'
    })
    expect(failed(snapshot, 'snapshot.status_sealed')).toBe(true)
  })

  it('rejects an inconsistent identity object', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.identity as Record<string, unknown>).knowledgeSnapshotKey = 'other-key'
    })
    expect(failed(snapshot, 'snapshot.identity_valid')).toBe(true)
  })

  it('rejects an invalid knowledgeSnapshotId', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeSnapshotId = 'knowledge-snapshot:bad'
    })
    expect(failed(snapshot, 'snapshot.id_valid')).toBe(true)
  })

  it('rejects an invalid knowledgeSnapshotKey', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeSnapshotKey = 'bad-key'
    })
    expect(failed(snapshot, 'snapshot.key_valid')).toBe(true)
  })

  it.each([0, -1])('rejects revision %s', async (revision) => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.revision = revision
    })
    expect(failed(snapshot, 'snapshot.revision_valid')).toBe(true)
  })

  it('rejects incoherent supersedes on first revision', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.revision = 1
      item.supersedesKnowledgeSnapshotId = 'previous'
    })
    expect(failed(snapshot, 'snapshot.supersedes_consistent')).toBe(true)
  })

  it('rejects missing supersedes on later revisions', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete item.supersedesKnowledgeSnapshotId
    })
    expect(failed(snapshot, 'snapshot.supersedes_consistent')).toBe(true)
  })

  it('rejects an absent fingerprint', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete item.fingerprint
    })
    expect(failed(snapshot, 'fingerprint.present')).toBe(true)
  })

  it('rejects an invalid fingerprint value', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.fingerprint as Record<string, unknown>).value = 'bad'
    })
    expect(failed(snapshot, 'fingerprint.present')).toBe(true)
    expect(failed(snapshot, 'snapshot.id_valid')).toBe(true)
  })

  it('rejects an unsupported fingerprint algorithm', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.fingerprint as Record<string, unknown>).algorithm = 'SHA-1'
    })
    expect(failed(snapshot, 'fingerprint.algorithm_supported')).toBe(true)
  })

  it('rejects an unsupported fingerprint encoding', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.fingerprint as Record<string, unknown>).encoding = 'base64'
    })
    expect(failed(snapshot, 'fingerprint.encoding_supported')).toBe(true)
  })

  it('rejects an unsupported fingerprint domain', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.fingerprint as Record<string, unknown>).domain = 'other-domain'
    })
    expect(failed(snapshot, 'fingerprint.domain_supported')).toBe(true)
  })

  it('rejects an unsupported fingerprint version', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.fingerprint as Record<string, unknown>).fingerprintVersion = 'knowledge-fingerprint/9.9.9'
    })
    expect(failed(snapshot, 'fingerprint.version_supported')).toBe(true)
  })

  it('returns a negative assessment for unsupported canonicalization version', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeCanonicalizationVersion = 'knowledge-c14n/9.9.9'
    })
    const assessment = assessKnowledgeSnapshotPromotion(snapshot)
    expect(assessment.eligible).toBe(false)
    expect(failed(snapshot, 'canonicalization.version_supported')).toBe(true)
  })

  it('returns a negative assessment for unsupported knowledge version', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeVersion = 'knowledge/9.9.9'
    })
    expect(failed(snapshot, 'knowledge.version_supported')).toBe(true)
  })

  it('returns a negative assessment for unsupported builder version', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeBuilderVersion = 'knowledge-builder/9.9.9'
    })
    expect(failed(snapshot, 'builder.version_supported')).toBe(true)
  })

  it('returns a negative assessment for unsupported rules version', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeRulesVersion = 'knowledge-rules/9.9.9'
    })
    expect(failed(snapshot, 'rules.version_supported')).toBe(true)
  })

  it('returns a negative assessment for unsupported projection version', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeProjectionVersion = 'knowledge-projection/9.9.9'
    })
    expect(failed(snapshot, 'projection.version_supported')).toBe(true)
  })

  it('rejects a missing canonical document', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete item.canonicalDocument
    })
    expect(failed(snapshot, 'canonical_document.present')).toBe(true)
  })

  it('rejects empty facts', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.facts = []
      ;((item.canonicalDocument as Record<string, unknown>).payload as Record<string, unknown>).facts = []
    })
    expect(failed(snapshot, 'facts.present')).toBe(true)
  })

  it('rejects inconsistent factCount', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;((item.canonicalDocument as Record<string, unknown>).payload as Record<string, unknown>).factCount = 999
    })
    expect(failed(snapshot, 'facts.count_consistent')).toBe(true)
  })

  it('rejects duplicate factIds', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      const facts = item.facts as Array<Record<string, unknown>>
      facts[1].factId = facts[0].factId
    })
    expect(failed(snapshot, 'facts.ids_unique')).toBe(true)
  })

  it('rejects unknown fact types', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.facts as Array<Record<string, unknown>>)[0].factType = 'unknown.type'
    })
    expect(failed(snapshot, 'facts.types_allowed')).toBe(true)
  })

  it('rejects incoherent fact categories', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.facts as Array<Record<string, unknown>>)[0].category = 'saving'
    })
    expect(failed(snapshot, 'facts.categories_consistent')).toBe(true)
  })

  it('rejects invalid relationships', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.relationships = [{
        sourceFactId: 'missing',
        relationshipType: 'derived-from',
        targetFactId: 'missing-too',
      }]
      ;((item.canonicalDocument as Record<string, unknown>).payload as Record<string, unknown>).relationships = item.relationships
    })
    expect(failed(snapshot, 'relationships.valid')).toBe(true)
  })

  it('rejects invalid fact evidence', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete ((item.facts as Array<Record<string, unknown>>)[0].evidence as Record<string, unknown>).sourceSnapshotId
    })
    expect(failed(snapshot, 'evidence.valid')).toBe(true)
  })

  it('rejects invalid evidence references', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.evidenceReferences as Array<Record<string, unknown>>)[0].evidenceType = 'bad-evidence'
    })
    expect(failed(snapshot, 'evidence.valid')).toBe(true)
  })

  it('rejects missing metadata', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete item.metadata
    })
    expect(failed(snapshot, 'metadata.present')).toBe(true)
  })

  it('rejects missing sourceSnapshotId', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete (item.sourceSnapshotReferences as Record<string, unknown>).snapshotId
    })
    expect(failed(snapshot, 'source_snapshot.id_present')).toBe(true)
  })

  it('rejects missing sourceSnapshotKey', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      delete (item.sourceSnapshotReferences as Record<string, unknown>).snapshotKey
    })
    expect(failed(snapshot, 'source_snapshot.key_present')).toBe(true)
  })

  it('rejects invalid sourceSnapshotRevision', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.sourceSnapshotReferences as Record<string, unknown>).snapshotRevision = 0
    })
    expect(failed(snapshot, 'source_snapshot.revision_valid')).toBe(true)
  })

  it('rejects missing source fingerprint value', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.sourceSnapshotReferences as Record<string, unknown>).sourceFingerprintValue = ''
    })
    expect(failed(snapshot, 'source_snapshot.fingerprint_present')).toBe(true)
  })

  it('rejects inconsistent duplicated state against canonical payload', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      item.knowledgeVersion = 'knowledge/1.0.0:mutated'
    })
    expect(failed(snapshot, 'snapshot.state_consistent')).toBe(true)
  })

  it('rejects a non serializable contract with bigint', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.metadata as Record<string, unknown>).bad = BigInt(1)
    })
    expect(failed(snapshot, 'contract.serializable')).toBe(true)
    expect(failed(snapshot, 'values.allowed')).toBe(true)
  })

  it('rejects invalid values such as Date', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.metadata as Record<string, unknown>).bad = new Date()
    })
    expect(failed(snapshot, 'values.allowed')).toBe(true)
  })

  it('rejects invalid values such as NaN', async () => {
    const snapshot = mutate(await validSnapshot(), (item) => {
      ;(item.evidenceReferences as Array<Record<string, unknown>>)[0].evidenceValue = Number.NaN
    })
    expect(failed(snapshot, 'values.allowed')).toBe(true)
  })

  it('stays pure and does not need a repository symbol', () => {
    expect(policySource).not.toContain('KnowledgeSnapshotRepository')
  })

  it('stays pure and does not use Dexie', () => {
    expect(policySource).not.toContain('Dexie')
  })

  it('stays pure and does not use IndexedDB', () => {
    expect(policySource).not.toContain('indexedDB')
  })

  it('stays pure and does not reference Home', () => {
    expect(policySource).not.toContain('homeBalance')
  })

  it('stays pure and does not reference Reports', () => {
    expect(policySource).not.toContain('Reports')
  })

  it('stays pure and does not reference an Insight Engine', () => {
    expect(policySource).not.toContain('InsightEngine')
  })

  it('stays pure and does not reference IA', () => {
    expect(policySource).not.toContain('OpenAI')
    expect(policySource).not.toContain('Anthropic')
  })

  it('stays pure and does not reference LLM', () => {
    expect(policySource).not.toContain('LLM')
  })

  it('returns the same assessment for a cloned equivalent snapshot', async () => {
    const snapshot = await validSnapshot()
    expect(assessKnowledgeSnapshotPromotion(clone(snapshot))).toEqual(
      assessKnowledgeSnapshotPromotion(snapshot),
    )
  })
})