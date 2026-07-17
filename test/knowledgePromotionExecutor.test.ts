import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import { canonicalizeValidatedKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import { fingerprintCanonicalKnowledgeDocument } from '../src/intelligence/knowledge-layer/knowledgeFingerprint'
import { validateKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import {
  deriveKnowledgeSnapshotKey,
  sealCanonicalKnowledgeDocument,
} from '../src/intelligence/knowledge-layer/knowledgeSealer'
import {
  executeKnowledgePromotion,
  isKnowledgePromotionEnabled,
  type KnowledgePromotionExecutionInput,
  type KnowledgePromotionExecutionResult,
  type KnowledgePromotionRepositoryPort,
  type KnowledgePromotionSupportedVersions,
} from '../src/services/knowledgePromotionExecutor'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SealedFinancialSnapshot,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'
import type {
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeCanonicalizationVersion,
  KnowledgeProjectionVersion,
  KnowledgeRevisionReasonCode,
  KnowledgeRulesVersion,
  KnowledgeSnapshotId,
  KnowledgeSnapshotKey,
  KnowledgeVersion,
  SealedKnowledgeSnapshot,
} from '../src/types/knowledgeLayer'
import type { PersistedKnowledgeSnapshot } from '../src/types/persistedKnowledgeSnapshot'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const servicePath = resolve(__dirname, '../src/services/knowledgePromotionExecutor.ts')
const serviceSource = readFileSync(servicePath, 'utf8')

const at = '2026-07-16T00:00:00.000Z' as UtcInstant
const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const BUILDER_VERSION = 'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const PROJECTION_VERSION = 'knowledge-projection/1.0.0' as KnowledgeProjectionVersion
const REVISION_REASON = 'revision.source_changed' as KnowledgeRevisionReasonCode
const DEFAULT_SCOPE = {
  kind: 'monthly' as const,
  periodStart: '2026-07-01' as CivilDate,
  periodEndExclusive: '2026-08-01' as CivilDate,
  periodBoundary: '[start,end)' as const,
  asOf: at,
  timezone: 'Europe/Madrid' as IanaTimeZone,
  usageMode: 'basic' as const,
  currency: 'EUR' as const,
}

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

function clone<T>(value: T): T {
  return structuredClone(value)
}

function baseEngineResult(overrides: Partial<EngineResultFixture> = {}): EngineResultFixture {
  return {
    balanceReport: {
      hasData: true,
      generalBalance: 200,
      netProfit: 120,
    },
    incomeCount: overrides.incomeCount ?? 2,
    expenseCount: overrides.expenseCount ?? 1,
    adjustmentCount: overrides.adjustmentCount ?? 0,
    ...overrides,
    balanceReport: {
      hasData: true,
      generalBalance: overrides.balanceReport?.generalBalance ?? 200,
      netProfit: overrides.balanceReport?.netProfit ?? 120,
    },
  }
}

function baseSnapshot(
  engineResult: EngineResultFixture,
  scopeOverrides: Partial<ValidatedSnapshotCandidate<EngineResultFixture>['scope']> = {},
): SealedFinancialSnapshot<EngineResultFixture> {
  const candidate: ValidatedSnapshotCandidate<EngineResultFixture> = {
    status: 'validated',
    identity: { candidateId: 'knowledge-promotion-fixture' as SnapshotCandidateId },
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
      ...scopeOverrides,
    },
    engineResult,
    evidence: {
      strategy: 'embedded-v1',
      records: [],
      context: [{ kind: 'settings-context' }],
      candidateRecordCount: 0,
      includedRecordCount: 0,
      excludedRecordCount: 0,
      coverageCodes: ['coverage.empty_dataset'],
      warningCodes: [],
    },
    appliedRules: [],
    metadata: {
      generatedAt: at,
      generationReasonCode: 'generation.shadow_evaluation' as SnapshotNormativeCode,
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion: 'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
  }

  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)

  return {
    identity: {
      snapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/2.0.0:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      snapshotKey: 'snapshot-key:monthly:2026-07',
    },
    revision: {
      revision: 1,
      reasonCode: 'revision.source_changed' as SnapshotNormativeCode,
    },
    status: 'sealed',
    canonicalDocument,
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
    canonicalizationVersion: 'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
    scope: candidate.scope,
    evidence: candidate.evidence,
    appliedRules: candidate.appliedRules,
    metadata: candidate.metadata,
  } as SealedFinancialSnapshot<EngineResultFixture>
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

async function buildKnowledgeSnapshot(
  overrides: Partial<{
    readonly engineResult: EngineResultFixture
    readonly usageMode: 'basic' | 'professional'
    readonly earningPeriodId: number
    readonly revision: number
    readonly supersedesKnowledgeSnapshotId: KnowledgeSnapshotId
    readonly knowledgeVersion: KnowledgeVersion
    readonly builderVersion: KnowledgeBuilderVersion
    readonly rulesVersion: KnowledgeRulesVersion
    readonly projectionVersion: KnowledgeProjectionVersion
    readonly canonicalizationVersion: KnowledgeCanonicalizationVersion
    readonly identitySuffix: string
    readonly scopeOverrides: Partial<ValidatedSnapshotCandidate<EngineResultFixture>['scope']>
  }> = {},
): Promise<SealedKnowledgeSnapshot> {
  const scopeOverrides = {
    usageMode: overrides.usageMode ?? 'basic',
    ...(overrides.earningPeriodId === undefined ? {} : { earningPeriodId: overrides.earningPeriodId }),
    ...(overrides.scopeOverrides ?? {}),
  }
  const snapshot = baseSnapshot(overrides.engineResult ?? baseEngineResult(), scopeOverrides)
  const draft = buildKnowledgeCollectionFromSnapshot({
    ...builderInput(snapshot),
    knowledgeVersion: overrides.knowledgeVersion ?? KNOWLEDGE_VERSION,
    builderVersion: overrides.builderVersion ?? BUILDER_VERSION,
    rulesVersion: overrides.rulesVersion ?? RULES_VERSION,
    projectionVersion: overrides.projectionVersion ?? PROJECTION_VERSION,
  })
  const validated = validateKnowledgeCollection(draft)
  const canonicalDocument = canonicalizeValidatedKnowledgeCollection(validated)
  if ((overrides.revision ?? 1) > 1) {
    ;(canonicalDocument.payload.identity as { knowledgeCollectionId: string }).knowledgeCollectionId =
      `${canonicalDocument.payload.identity.knowledgeCollectionId}:${overrides.identitySuffix ?? `rev-${overrides.revision}`}`
  }
  const fingerprint = await fingerprintCanonicalKnowledgeDocument(canonicalDocument)
  const knowledgeSnapshotKey = deriveKnowledgeSnapshotKey(canonicalDocument)

  return sealCanonicalKnowledgeDocument({
    canonicalDocument,
    fingerprint,
    knowledgeSnapshotKey,
    revision: overrides.revision ?? 1,
    revisionReasonCode: REVISION_REASON,
    sealedAt: at,
    ...(overrides.supersedesKnowledgeSnapshotId === undefined
      ? {}
      : { supersedesKnowledgeSnapshotId: overrides.supersedesKnowledgeSnapshotId }),
  })
}

function toPersistedRecord(snapshot: SealedKnowledgeSnapshot): PersistedKnowledgeSnapshot {
  return {
    knowledgeSnapshotId: snapshot.knowledgeSnapshotId,
    knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
    revision: snapshot.revision,
    status: snapshot.status,
    canonicalDocument: snapshot.canonicalDocument,
    fingerprint: snapshot.fingerprint,
    sealedAt: snapshot.sealedAt,
    ...(snapshot.supersedesKnowledgeSnapshotId === undefined
      ? {}
      : { supersedesKnowledgeSnapshotId: snapshot.supersedesKnowledgeSnapshotId }),
    persistedAt: at,
    localSchemaVersion: 1,
    knowledgeVersion: snapshot.knowledgeVersion,
    builderVersion: snapshot.knowledgeBuilderVersion,
    rulesVersion: snapshot.knowledgeRulesVersion,
    projectionVersion: snapshot.knowledgeProjectionVersion,
    canonicalizationVersion: snapshot.knowledgeCanonicalizationVersion,
    sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
    sourceSnapshotKey: snapshot.sourceSnapshotReferences.snapshotKey,
    fingerprintValue: snapshot.fingerprint.value,
  }
}

function repositoryPort(
  records: readonly PersistedKnowledgeSnapshot[],
  overrides: Partial<KnowledgePromotionRepositoryPort> = {},
): KnowledgePromotionRepositoryPort & { readonly persist: ReturnType<typeof vi.fn> } {
  const cloned = records.map((record) => clone(record))
  const latest = cloned.slice().sort((left, right) => left.revision - right.revision).at(-1)
  const persist = vi.fn()
  const getLatestByKnowledgeSnapshotKey = vi.fn(
    overrides.getLatestByKnowledgeSnapshotKey ?? (async () => {
      if (latest === undefined) {
        throw Object.assign(new Error('not found'), { code: 'KNOWLEDGE_PERSISTENCE_NOT_FOUND' })
      }
      return clone(latest)
    }),
  )
  const listByKnowledgeSnapshotKey = vi.fn(
    overrides.listByKnowledgeSnapshotKey ?? (async () => cloned.map((record) => clone(record))),
  )

  return {
    persist,
    getLatestByKnowledgeSnapshotKey,
    listByKnowledgeSnapshotKey,
  }
}

function buildInput(
  record: PersistedKnowledgeSnapshot,
  overrides: Partial<Omit<KnowledgePromotionExecutionInput, 'knowledgeSnapshotKey' | 'supportedVersions'>> = {},
  expectations: Partial<{
    readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
    readonly sourceSnapshotId: string
    readonly expectedScope: KnowledgePromotionExecutionInput['expectedScope']
    readonly supportedVersions: KnowledgePromotionSupportedVersions
  }> = {},
): KnowledgePromotionExecutionInput {
  const supportedVersions = expectations.supportedVersions ?? {
    knowledgeVersion: record.knowledgeVersion,
    builderVersion: record.builderVersion,
    rulesVersion: record.rulesVersion,
    projectionVersion: record.projectionVersion,
    canonicalizationVersion: record.canonicalizationVersion,
  }

  return {
    knowledgeSnapshotKey: expectations.knowledgeSnapshotKey ?? record.knowledgeSnapshotKey,
    expectedScope: expectations.expectedScope ?? record.canonicalDocument.payload.facts[0]?.scope ?? DEFAULT_SCOPE,
    supportedVersions,
    featureEnabled: true,
    repository: repositoryPort([record]),
    sourceSnapshotId: expectations.sourceSnapshotId ?? record.sourceSnapshotId,
    consumer: 'home.balance.current-month',
    diagnosticScope: '2026-07',
    ...overrides,
  }
}

function buildDecision(
  snapshot: SealedKnowledgeSnapshot,
  overrides: Partial<Omit<KnowledgePromotionExecutionInput, 'knowledgeSnapshotKey' | 'supportedVersions'>> = {},
  expectations: Partial<{
    readonly knowledgeSnapshotKey: KnowledgeSnapshotKey
    readonly sourceSnapshotId: string
    readonly expectedScope: KnowledgePromotionExecutionInput['expectedScope']
    readonly supportedVersions: KnowledgePromotionSupportedVersions
  }> = {},
): Promise<KnowledgePromotionExecutionResult> {
  const record = toPersistedRecord(snapshot)
  return executeKnowledgePromotion(buildInput(record, overrides, expectations))
}

function mutateRecord(
  snapshot: SealedKnowledgeSnapshot,
  mutator: (record: Record<string, unknown>) => void,
): PersistedKnowledgeSnapshot {
  const record = toPersistedRecord(snapshot) as unknown as Record<string, unknown>
  mutator(record)
  return record as unknown as PersistedKnowledgeSnapshot
}

function mutateSnapshot(
  snapshot: SealedKnowledgeSnapshot,
  mutator: (record: Record<string, unknown>) => void,
): SealedKnowledgeSnapshot {
  const record = clone(snapshot) as unknown as Record<string, unknown>
  mutator(record)
  return record as unknown as SealedKnowledgeSnapshot
}

function chainRepository(records: readonly PersistedKnowledgeSnapshot[], latestId?: KnowledgeSnapshotId) {
  const list = records.map((record) => clone(record))
  const latest =
    latestId === undefined
      ? list.slice().sort((left, right) => left.revision - right.revision).at(-1)
      : list.find((record) => record.knowledgeSnapshotId === latestId)

  return repositoryPort(list, {
    getLatestByKnowledgeSnapshotKey: async () => {
      if (latest === undefined) {
        throw Object.assign(new Error('not found'), { code: 'KNOWLEDGE_PERSISTENCE_NOT_FOUND' })
      }
      return clone(latest)
    },
    listByKnowledgeSnapshotKey: async () => list.map((record) => clone(record)),
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('isKnowledgePromotionEnabled', () => {
  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
    ['TRUE', false],
    ['1', false],
    ['yes', false],
    ['invalid', false],
  ])('accepts only exact true for %j', (value, expected) => {
    vi.stubEnv('VITE_KNOWLEDGE_PROMOTION_ENABLED', value)
    expect(isKnowledgePromotionEnabled()).toBe(expected)
  })
})

describe('executeKnowledgePromotion', () => {
  it('does not read the repository when disabled', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([record])
    const decision = await executeKnowledgePromotion({
      ...buildInput(record, { repository }),
      featureEnabled: false,
    })

    expect(decision).toMatchObject({ source: 'none', fallbackReason: 'feature_disabled' })
    expect(repository.persist).not.toHaveBeenCalled()
  })

  it('consults the repository only when enabled', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([record])
    const input = buildInput(record, { repository })
    await executeKnowledgePromotion(input)
    expect(repository.getLatestByKnowledgeSnapshotKey).toHaveBeenCalledOnce()
    expect(repository.listByKnowledgeSnapshotKey).toHaveBeenCalledOnce()
  })

  it('falls back when the repository is empty', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([], {
      getLatestByKnowledgeSnapshotKey: async () => {
        throw Object.assign(new Error('not found'), { code: 'KNOWLEDGE_PERSISTENCE_NOT_FOUND' })
      },
      listByKnowledgeSnapshotKey: async () => [],
    })

    const decision = await executeKnowledgePromotion({
      ...buildInput(record, { repository }),
      featureEnabled: true,
    })

    expect(decision).toMatchObject({ source: 'none', fallbackReason: 'not_found' })
  })

  it('promotes a valid eligible snapshot', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const decision = await buildDecision(snapshot)

    expect(decision.source).toBe('knowledge')
    expect(decision.revision).toBe(snapshot.revision)
    expect(decision.assessment?.eligible).toBe(true)
    expect(decision.snapshot?.knowledgeSnapshotId).toBe(snapshot.knowledgeSnapshotId)
  })

  it('rejects a policy-negative snapshot', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const mutated = mutateSnapshot(snapshot, (record) => {
      const payload = record.canonicalDocument as Record<string, unknown>
      ;(payload.payload as Record<string, unknown>).facts = []
      ;(payload.payload as Record<string, unknown>).evidenceReferences = []
      ;(payload.payload as Record<string, unknown>).factCount = 0
      ;(record as Record<string, unknown>).facts = []
      ;(record as Record<string, unknown>).evidenceReferences = []
    })

    const decision = await buildDecision(mutated, {}, {
      expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
    })
    expect(decision).toMatchObject({ source: 'none', fallbackReason: 'invalid_contract' })
    expect(decision.assessment).toBeUndefined()
  })

  it('rejects a repository result that is not the latest revision', async () => {
    const first = await buildKnowledgeSnapshot({ revision: 1 })
    const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
    const records = [toPersistedRecord(first), toPersistedRecord(second)]
    const repository = chainRepository(records, first.knowledgeSnapshotId)
    const decision = await executeKnowledgePromotion(buildInput(records[0], { repository }))

    expect(decision).toMatchObject({ source: 'none', fallbackReason: 'not_latest' })
  })

  it('rejects a revision chain with a gap', async () => {
    const first = await buildKnowledgeSnapshot({ revision: 1 })
    const third = await buildKnowledgeSnapshot({ revision: 3, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
    const records = [toPersistedRecord(first), toPersistedRecord(third)]
    const repository = chainRepository(records)
    const decision = await executeKnowledgePromotion(buildInput(records[0], { repository }))

    expect(decision).toMatchObject({ source: 'none', fallbackReason: 'invalid_chain' })
  })

  it('accepts a valid supersedes chain', async () => {
    const first = await buildKnowledgeSnapshot({ revision: 1 })
    const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
    const records = [toPersistedRecord(first), toPersistedRecord(second)]
    const repository = chainRepository(records)
    const decision = await executeKnowledgePromotion(buildInput(records[1], { repository }))

    expect(decision.source).toBe('knowledge')
    expect(decision.revision).toBe(2)
  })

  it.each([
    ['missing supersedes', async () => {
      const first = await buildKnowledgeSnapshot({ revision: 1 })
      const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
      const record = toPersistedRecord(second)
      delete (record as { supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId }).supersedesKnowledgeSnapshotId
      return [record]
    }, 'invalid_chain'],
    ['supersedes another key', async () => {
      const first = await buildKnowledgeSnapshot({ revision: 1 })
      const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
      const record = toPersistedRecord(second)
      record.supersedesKnowledgeSnapshotId = 'knowledge-snapshot:knowledge-fingerprint/1.0.0:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as KnowledgeSnapshotId
      return [record]
    }, 'invalid_chain'],
    ['cycle', async () => {
      const first = await buildKnowledgeSnapshot({ revision: 1 })
      const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
      const a = toPersistedRecord(first)
      const b = toPersistedRecord(second)
      b.supersedesKnowledgeSnapshotId = b.knowledgeSnapshotId
      return [a, b]
    }, 'invalid_chain'],
    ['parallel conflict', async () => {
      const first = await buildKnowledgeSnapshot({ revision: 1 })
      const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
      const duplicate = toPersistedRecord(second)
      duplicate.knowledgeSnapshotId = `${duplicate.knowledgeSnapshotId}:duplicate` as KnowledgeSnapshotId
      return [toPersistedRecord(first), toPersistedRecord(second), duplicate]
    }, 'revision_conflict'],
  ])('rejects %s', async (_label, buildRecords, expectedFallbackReason) => {
    const records = await buildRecords()
    const repository = chainRepository(records)
    const reference = records.at(-1)!
    const decision = await executeKnowledgePromotion(buildInput(reference, { repository }, {
      knowledgeSnapshotKey: reference.knowledgeSnapshotKey,
      sourceSnapshotId: reference.sourceSnapshotId,
      expectedScope: reference.canonicalDocument.payload.facts[0]?.scope ?? DEFAULT_SCOPE,
    }))
    expect(decision).toMatchObject({ source: 'none', fallbackReason: expectedFallbackReason })
  })

  it.each([
    ['fingerprint altered', (record: Record<string, unknown>) => {
      const fingerprint = record.fingerprint as Record<string, unknown>
      fingerprint.value = '0'.repeat(64)
    }, 'fingerprint_mismatch'],
    ['document altered', (record: Record<string, unknown>) => {
      const canonicalDocument = record.canonicalDocument as Record<string, unknown>
      const payload = canonicalDocument.payload as Record<string, unknown>
      const sourceSnapshotReferences = payload.sourceSnapshotReferences as Record<string, unknown>
      record.canonicalDocument = {
        ...canonicalDocument,
        payload: {
          ...payload,
          sourceSnapshotReferences: {
            ...sourceSnapshotReferences,
            sourceFingerprintValue: '0'.repeat(64),
          },
        },
      }
    }, 'fingerprint_mismatch'],
    ['algorithm altered', (record: Record<string, unknown>) => {
      const fingerprint = record.fingerprint as Record<string, unknown>
      fingerprint.algorithm = 'MD5'
    }, 'fingerprint_mismatch'],
    ['encoding altered', (record: Record<string, unknown>) => {
      const fingerprint = record.fingerprint as Record<string, unknown>
      fingerprint.encoding = 'base64'
    }, 'fingerprint_mismatch'],
    ['domain altered', (record: Record<string, unknown>) => {
      const fingerprint = record.fingerprint as Record<string, unknown>
      fingerprint.domain = 'other'
    }, 'fingerprint_mismatch'],
    ['fingerprint version altered', (record: Record<string, unknown>) => {
      const fingerprint = record.fingerprint as Record<string, unknown>
      fingerprint.fingerprintVersion = 'knowledge-fingerprint/9.9.9'
    }, 'fingerprint_mismatch'],
    ['canonicalization version altered', (record: Record<string, unknown>) => { record.canonicalizationVersion = 'knowledge-c14n/9.9.9' }, 'incompatible_version'],
    ['knowledge version altered', (record: Record<string, unknown>) => { record.knowledgeVersion = 'knowledge/9.9.9' }, 'incompatible_version'],
    ['builder version altered', (record: Record<string, unknown>) => { record.builderVersion = 'knowledge-builder/9.9.9' }, 'incompatible_version'],
    ['rules version altered', (record: Record<string, unknown>) => { record.rulesVersion = 'knowledge-rules/9.9.9' }, 'incompatible_version'],
    ['projection version altered', (record: Record<string, unknown>) => { record.projectionVersion = 'knowledge-projection/9.9.9' }, 'incompatible_version'],
    ['knowledgeSnapshotId inconsistent', (record: Record<string, unknown>) => { record.knowledgeSnapshotId = `${record.knowledgeSnapshotId}:broken` }, 'identity_mismatch'],
    ['knowledgeSnapshotKey incorrect', (record: Record<string, unknown>) => {
      const canonicalDocument = record.canonicalDocument as Record<string, unknown>
      const payload = canonicalDocument.payload as Record<string, unknown>
      const metadata = payload.metadata as Record<string, unknown>
      record.canonicalDocument = {
        ...canonicalDocument,
        payload: {
          ...payload,
          metadata: {
            ...metadata,
            knowledgeVersion: 'knowledge/9.9.9',
          },
        },
      }
    }, 'key_mismatch'],
    ['sourceSnapshotId incorrect', (record: Record<string, unknown>) => { record.sourceSnapshotId = 'financial-snapshot:broken' }, 'source_mismatch'],
    ['sourceSnapshotKey incoherent', (record: Record<string, unknown>) => { record.sourceSnapshotKey = 'snapshot-key:broken' }, 'source_mismatch'],
    ['sourceSnapshotRevision invalid', (record: Record<string, unknown>) => {
      const canonicalDocument = record.canonicalDocument as Record<string, unknown>
      const payload = canonicalDocument.payload as Record<string, unknown>
      const sourceSnapshotReferences = payload.sourceSnapshotReferences as Record<string, unknown>
      sourceSnapshotReferences.snapshotRevision = 0
    }, 'invalid_contract'],
    ['status invalid', (record: Record<string, unknown>) => { record.status = 'projected' }, 'invalid_contract'],
  ])('rejects %s', async (_label, mutateRecordValue, expectedFallbackReason) => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = mutateRecord(snapshot, mutateRecordValue)
    const repository = chainRepository([record])
    const decision = await executeKnowledgePromotion(buildInput(record, { repository }, {
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
      expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
      supportedVersions: {
        knowledgeVersion: snapshot.knowledgeVersion,
        builderVersion: snapshot.knowledgeBuilderVersion,
        rulesVersion: snapshot.knowledgeRulesVersion,
        projectionVersion: snapshot.knowledgeProjectionVersion,
        canonicalizationVersion: snapshot.knowledgeCanonicalizationVersion,
      },
    }))

    expect(decision).toMatchObject({ source: 'none', fallbackReason: expectedFallbackReason })
  })

  it.each([
    ['repository error', {
      getLatestByKnowledgeSnapshotKey: async () => {
        throw Object.assign(new Error('db'), { code: 'KNOWLEDGE_PERSISTENCE_SCHEMA_ERROR' })
      },
      listByKnowledgeSnapshotKey: async () => {
        throw Object.assign(new Error('db'), { code: 'KNOWLEDGE_PERSISTENCE_SCHEMA_ERROR' })
      },
    }, 'repository_error'],
    ['internal exception', {
      getLatestByKnowledgeSnapshotKey: async () => { throw new Error('boom') },
      listByKnowledgeSnapshotKey: async () => { throw new Error('boom') },
    }, 'internal_error'],
  ])('falls back for %s', async (_label, repository, expectedFallbackReason) => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const decision = await executeKnowledgePromotion({
      ...buildInput(record, { repository: repository as KnowledgePromotionRepositoryPort }, {
        expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
        knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
        sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
      }),
      featureEnabled: true,
    })

    expect(decision).toMatchObject({ source: 'none', fallbackReason: expectedFallbackReason })
  })

  it('does not mutate the input object or the repository snapshot', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([record])
    const input = buildInput(record, { repository })
    const beforeInput = clone({ ...input, repository: undefined })
    const beforeRecord = clone(record)

    await executeKnowledgePromotion(input)

    expect({ ...input, repository: undefined }).toEqual(beforeInput)
    expect(record).toEqual(beforeRecord)
  })

  it('is deterministic across repeated executions', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const first = await buildDecision(snapshot)
    const second = await buildDecision(snapshot)

    expect(first).toEqual(second)
  })

  it('logs nothing in production mode', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const logger = vi.fn()
    await executeKnowledgePromotion({
      ...buildInput(toPersistedRecord(snapshot), { logger, dev: false }, {
        expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
        knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
        sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
      }),
      featureEnabled: true,
    })

    expect(logger).not.toHaveBeenCalled()
  })

  it('logs safe metadata only in development mode', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const logger = vi.fn()
    await executeKnowledgePromotion({
      ...buildInput(toPersistedRecord(snapshot), { logger, dev: true }, {
        expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
        knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
        sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
      }),
      featureEnabled: true,
    })

    expect(logger).toHaveBeenCalled()
    const [, payload] = logger.mock.calls[0]
    expect(JSON.stringify(payload)).not.toContain('facts')
    expect(JSON.stringify(payload)).not.toContain('evidence')
    expect(JSON.stringify(payload)).not.toContain('canonicalDocument')
    expect(JSON.stringify(payload)).not.toContain('fingerprint.value')
  })

  it('does not persist any promotion decision', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([record])
    await executeKnowledgePromotion(buildInput(record, { repository }, {
      expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
    }))
    expect(repository.persist).not.toHaveBeenCalled()
  })

  it.each([
    'buildKnowledgeCollectionFromSnapshot',
    'validateKnowledgeCollection',
    'canonicalizeValidatedKnowledgeCollection',
    'runKnowledgeShadowMode',
    'resolveHomeBalanceSummaryPromotion',
    'executeSnapshotPromotion',
    'runFinancialEngine',
  ])('does not reference %s', (forbidden) => {
    expect(serviceSource).not.toContain(forbidden)
  })

  it.each([
    'Home',
    'Reports',
    'Insight Engine',
    'LLM',
    'AI',
    'Neon',
    'n8n',
    'WhatsApp',
  ])('does not reference external surface %s', (forbidden) => {
    expect(serviceSource).not.toContain(forbidden)
  })

  it('supports basic mode', async () => {
    const snapshot = await buildKnowledgeSnapshot({ usageMode: 'basic' })
    expect((await buildDecision(snapshot)).source).toBe('knowledge')
  })

  it('supports professional mode with a seasonal context', async () => {
    const snapshot = await buildKnowledgeSnapshot({ usageMode: 'professional', earningPeriodId: 42 })
    expect((await buildDecision(snapshot)).source).toBe('knowledge')
  })

  it('rejects an empty dataset when the policy is negative', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const mutated = mutateSnapshot(snapshot, (record) => {
      ;(record.canonicalDocument.payload as Record<string, unknown>).facts = []
      ;(record.canonicalDocument.payload as Record<string, unknown>).factCount = 0
      ;(record.canonicalDocument.payload as Record<string, unknown>).evidenceReferences = []
    })
    const decision = await buildDecision(mutated, {}, {
      expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
    })
    expect(decision.fallbackReason).toBe('invalid_contract')
  })

  it('keeps the same decision after reopening the repository view', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([record])
    const first = await executeKnowledgePromotion(buildInput(record, { repository }, {
      expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
    }))
    const second = await executeKnowledgePromotion(buildInput(record, { repository }, {
      expectedScope: snapshot.canonicalDocument.payload.facts[0].scope,
      knowledgeSnapshotKey: snapshot.knowledgeSnapshotKey,
      sourceSnapshotId: snapshot.sourceSnapshotReferences.snapshotId,
    }))

    expect(second).toEqual(first)
  })

  it('prefers the latest revision after a new materialization', async () => {
    const first = await buildKnowledgeSnapshot({ revision: 1 })
    const second = await buildKnowledgeSnapshot({ revision: 2, supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId })
    const records = [toPersistedRecord(first), toPersistedRecord(second)]
    const repository = chainRepository(records)
    const decision = await executeKnowledgePromotion(buildInput(records[1], { repository }, {
      expectedScope: second.canonicalDocument.payload.facts[0].scope,
      knowledgeSnapshotKey: second.knowledgeSnapshotKey,
      sourceSnapshotId: second.sourceSnapshotReferences.snapshotId,
    }))

    expect(decision).toMatchObject({ source: 'knowledge', revision: 2 })
  })

  it('rolls back to none when the flag is disabled again', async () => {
    const snapshot = await buildKnowledgeSnapshot()
    const record = toPersistedRecord(snapshot)
    const repository = repositoryPort([record])
    const enabled = await executeKnowledgePromotion(buildInput(record, { repository, featureEnabled: true }))
    const disabled = await executeKnowledgePromotion(buildInput(record, { repository, featureEnabled: false }))

    expect(enabled.source).toBe('knowledge')
    expect(disabled).toMatchObject({ source: 'none', fallbackReason: 'feature_disabled' })
  })
})
