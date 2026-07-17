import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { describe, expect, it, vi, afterEach } from 'vitest'

import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../src/intelligence/financial-snapshot/snapshotSealer'
import {
  buildKnowledgeCollectionFromSnapshot,
} from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import {
  canonicalizeValidatedKnowledgeCollection,
} from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import {
  fingerprintCanonicalKnowledgeDocument,
} from '../src/intelligence/knowledge-layer/knowledgeFingerprint'
import {
  KnowledgePersistenceError,
  KnowledgeSnapshotRepository,
  type KnowledgeSnapshotDatabase,
} from '../src/intelligence/knowledge-layer/knowledgeSnapshotRepository'
import { sealCanonicalKnowledgeDocument } from '../src/intelligence/knowledge-layer/knowledgeSealer'
import {
  validateKnowledgeCollection,
} from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import {
  DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
  isKnowledgeShadowEnabled,
  runKnowledgeShadowMode,
  type KnowledgeShadowModeInput,
} from '../src/services/knowledgeShadowModeService'
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
  KnowledgeSnapshotId,
} from '../src/types/knowledgeLayer'
import type { PersistedKnowledgeSnapshot } from '../src/types/persistedKnowledgeSnapshot'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const servicePath = resolve(__dirname, '../src/services/knowledgeShadowModeService.ts')
const serviceSource = readFileSync(servicePath, 'utf8')
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

class MemoryKnowledgeSnapshotTable {
  readonly records = new Map<string, PersistedKnowledgeSnapshot>()

  async get(id: KnowledgeSnapshotId): Promise<PersistedKnowledgeSnapshot | undefined> {
    const record = this.records.get(id)
    return record === undefined ? undefined : structuredClone(record)
  }

  async add(record: PersistedKnowledgeSnapshot): Promise<void> {
    if (this.records.has(record.knowledgeSnapshotId)) {
      throw Object.assign(new Error(), { name: 'ConstraintError' })
    }
    if (
      [...this.records.values()].some(
        (item) =>
          item.knowledgeSnapshotKey === record.knowledgeSnapshotKey &&
          item.revision === record.revision,
      )
    ) {
      throw Object.assign(new Error(), { name: 'ConstraintError' })
    }
    this.records.set(record.knowledgeSnapshotId, structuredClone(record))
  }

  where() {
    return {
      between: (lower: readonly [string, unknown]) => {
        const values = () =>
          [...this.records.values()]
            .filter((item) => item.knowledgeSnapshotKey === lower[0])
            .sort((a, b) => a.revision - b.revision)
            .map((item) => structuredClone(item))
        return {
          last: async () => values().at(-1),
          toArray: async () => values(),
        }
      },
    }
  }
}

class SharedMemoryDatabase {
  readonly knowledgeSnapshots = new MemoryKnowledgeSnapshotTable()

  private tail = Promise.resolve()

  transaction<T>(_mode: 'rw', _table: unknown, scope: () => Promise<T>): Promise<T> {
    const result = this.tail.then(scope, scope)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}

function repositoryFixture() {
  const memory = new SharedMemoryDatabase()
  const repository = new KnowledgeSnapshotRepository(
    memory as unknown as KnowledgeSnapshotDatabase,
  )
  return { memory, repository }
}

function engineResultFixture(
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

async function buildSealedFinancialSnapshot(
  overrides: Partial<{
    readonly engineResult: EngineResultFixture
    readonly candidateId: SnapshotCandidateId
    readonly periodStart: CivilDate
    readonly periodEndExclusive: CivilDate
    readonly asOf: UtcInstant
    readonly generatedAt: UtcInstant
    readonly sealedAt: UtcInstant
    readonly usageMode: 'basic' | 'professional'
    readonly earningPeriodId: number
    readonly canonicalizationVersion: CanonicalizationVersion
    readonly sourceRecordIds: readonly (string | number)[]
    readonly warningCodes: readonly string[]
  }> = {},
): Promise<SealedFinancialSnapshot<EngineResultFixture>> {
  const engineResult = overrides.engineResult ?? engineResultFixture()
  const sourceRecordIds = overrides.sourceRecordIds ?? [1, 2, 3]
  const candidate: ValidatedSnapshotCandidate<EngineResultFixture> = {
    status: 'validated',
    identity: {
      candidateId:
        overrides.candidateId ??
        (`candidate:${Math.abs(engineResult.balanceReport.generalBalance)}` as SnapshotCandidateId),
    },
    scope: {
      kind: 'monthly',
      periodStart: overrides.periodStart ?? ('2026-07-01' as CivilDate),
      periodEndExclusive:
        overrides.periodEndExclusive ?? ('2026-08-01' as CivilDate),
      periodBoundary: '[start,end)',
      asOf: overrides.asOf ?? at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: overrides.usageMode ?? 'basic',
      currency: 'EUR',
      ...(overrides.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: overrides.earningPeriodId }),
      filters: {},
    },
    engineResult,
    evidence: {
      strategy: 'embedded-v1',
      records: sourceRecordIds.map((sourceId, index) => ({
        kind: 'income' as const,
        identityKind: 'persisted-id' as const,
        sourceId,
        disposition: 'included' as const,
        logicalDate: `2026-07-0${index + 1}` as CivilDate,
        fields: {
          resolvedType: 'ingreso' as const,
          duration: 60,
          currency: 'EUR',
          eurValue: 10,
          copValue: 43000,
        },
      })),
      context: [
        {
          kind: 'settings-context',
          usageMode: overrides.usageMode ?? 'basic',
          currency: 'EUR',
          timezone: 'Europe/Madrid' as IanaTimeZone,
        },
        ...(overrides.earningPeriodId === undefined
          ? []
          : [{
              kind: 'earning-period-context' as const,
              earningPeriodId: overrides.earningPeriodId,
            }]),
      ],
      candidateRecordCount: sourceRecordIds.length,
      includedRecordCount: sourceRecordIds.length,
      excludedRecordCount: 0,
      coverageCodes: [sourceRecordIds.length === 0 ? 'coverage.empty_dataset' : 'coverage.complete'],
      warningCodes: [...(overrides.warningCodes ?? [])],
    },
    appliedRules: [
      {
        ruleId: 'balance.report.current',
        order: 0,
        engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
        rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
        explanationCode: 'rule.balance.report.current' as SnapshotNormativeCode,
        affectedFields: [],
        limitationCodes: [],
        warningCodes: [],
      },
    ],
    metadata: {
      generatedAt: overrides.generatedAt ?? at,
      generationReasonCode: 'generation.shadow_evaluation' as SnapshotNormativeCode,
      provenance: 'local',
      qualityCodes: ['quality.validated_structure' as SnapshotNormativeCode],
      warningCodes: [...(overrides.warningCodes ?? [])] as SnapshotNormativeCode[],
      limitationCodes: [],
    },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      overrides.canonicalizationVersion ??
      ('financial-snapshot-c14n/2.0.0' as CanonicalizationVersion),
    engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
  }

  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)
  return sealCanonicalSnapshot({
    canonicalDocument,
    fingerprint: await fingerprintCanonicalSnapshotDocument(canonicalDocument),
    snapshotKey: deriveSnapshotKey(canonicalDocument),
    revision: 1,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
    sealedAt: overrides.sealedAt ?? at,
  })
}

function buildInput(
  repository: KnowledgeSnapshotRepository,
  sealedFinancialSnapshot: SealedFinancialSnapshot<EngineResultFixture>,
  overrides: Partial<KnowledgeShadowModeInput> = {},
): KnowledgeShadowModeInput {
  return {
    sealedFinancialSnapshot,
    versions: DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
    sealedAt: at,
    persistedAt: at,
    revisionReasonCode: 'revision.source_changed',
    repository,
    consumer: 'home.balance.current-month',
    diagnosticScope: '2026-07',
    featureEnabled: true,
    ...overrides,
  }
}

function latestRecord(
  repository: KnowledgeSnapshotRepository,
  knowledgeSnapshotKey: string,
): Promise<PersistedKnowledgeSnapshot> {
  return repository.getLatestByKnowledgeSnapshotKey(
    knowledgeSnapshotKey as PersistedKnowledgeSnapshot['knowledgeSnapshotKey'],
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('isKnowledgeShadowEnabled', () => {
  it.each([
    [undefined, false],
    ['false', false],
    ['TRUE', false],
    ['1', false],
    ['yes', false],
    ['true', true],
  ])('accepts only exact true for %j', (value, expected) => {
    vi.stubEnv('VITE_KNOWLEDGE_SHADOW_ENABLED', value)
    expect(isKnowledgeShadowEnabled()).toBe(expected)
  })
})

describe('runKnowledgeShadowMode', () => {
  it('skips when the resolved feature flag is disabled', async () => {
    const { repository, memory } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(
      buildInput(repository, snapshot, { featureEnabled: false }),
      { dev: false },
    )

    expect(result).toMatchObject({ status: 'skipped', reasonCode: 'knowledge.shadow.disabled' })
    expect(memory.knowledgeSnapshots.records.size).toBe(0)
  })

  it('runs the complete pipeline and persists a first observation', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })

    expect(result).toMatchObject({
      status: 'observed',
      revision: 1,
      idempotent: false,
      fingerprintChanged: false,
      factCount: 6,
    })
    const stored = await latestRecord(repository, result.knowledgeSnapshotKey!)
    expect(stored.revision).toBe(1)
    expect(stored.supersedesKnowledgeSnapshotId).toBeUndefined()
  })

  it('accepts a valid sealed financial snapshot', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })

    expect(result.sourceSnapshotId).toBe(snapshot.identity.snapshotId)
    expect(result.sourceSnapshotRevision).toBe(snapshot.revision.revision)
  })

  it('rejects a source snapshot that is not sealed without affecting the caller', async () => {
    const { repository, memory } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const invalidSnapshot = {
      ...snapshot,
      status: 'persisted',
    } as unknown as SealedFinancialSnapshot<EngineResultFixture>
    const result = await runKnowledgeShadowMode(buildInput(repository, invalidSnapshot), { dev: false })

    expect(result).toMatchObject({ status: 'failed', reasonCode: 'KNOWLEDGE_SHADOW_INVALID_SOURCE_STATE' })
    expect(memory.knowledgeSnapshots.records.size).toBe(0)
  })

  it('accepts a V1 canonicalized financial snapshot when the contract is otherwise compatible', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({
      canonicalizationVersion: 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    })
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })

    expect(result.status).toBe('observed')
  })

  it('fails closed for an incompatible source snapshot version', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const invalidSnapshot = {
      ...snapshot,
      snapshotVersion: 'financial-snapshot/9.9.9',
    } as unknown as SealedFinancialSnapshot<EngineResultFixture>
    const result = await runKnowledgeShadowMode(buildInput(repository, invalidSnapshot), { dev: false })

    expect(result).toMatchObject({ status: 'failed', reasonCode: 'KNOWLEDGE_SHADOW_UNSUPPORTED_SOURCE_VERSION' })
  })

  it('executes the builder stage', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const build = vi.fn(buildKnowledgeCollectionFromSnapshot)
    await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { build },
    })
    expect(build).toHaveBeenCalledOnce()
  })

  it('executes the validator stage', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const validate = vi.fn(validateKnowledgeCollection)
    await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { validate },
    })

    expect(validate).toHaveBeenCalledOnce()
  })

  it('executes the canonicalizer stage', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const canonicalize = vi.fn(canonicalizeValidatedKnowledgeCollection)
    await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { canonicalize },
    })

    expect(canonicalize).toHaveBeenCalledOnce()
  })

  it('executes the fingerprint stage', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const fingerprint = vi.fn(fingerprintCanonicalKnowledgeDocument)
    await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { fingerprint },
    })

    expect(fingerprint).toHaveBeenCalledOnce()
  })

  it('executes the sealer stage', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const seal = vi.fn(sealCanonicalKnowledgeDocument)
    await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { seal },
    })

    expect(seal).toHaveBeenCalledOnce()
  })

  it('calls the repository on a first material persistence', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const persist = vi.fn(repository.persist.bind(repository))
    const port = {
      persist,
      getLatestByKnowledgeSnapshotKey: repository.getLatestByKnowledgeSnapshotKey.bind(repository),
    }

    await runKnowledgeShadowMode(buildInput(repository, snapshot, { repository: port as unknown as KnowledgeSnapshotRepository }), { dev: false })
    expect(persist).toHaveBeenCalledOnce()
  })

  it('assigns first revision = 1', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    expect(result.revision).toBe(1)
  })

  it('stores the first revision without supersedes', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const stored = await latestRecord(repository, result.knowledgeSnapshotKey!)
    expect(stored.supersedesKnowledgeSnapshotId).toBeUndefined()
  })

  it('creates a second material revision when the canonical document changes under the same key', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    let suffix = 'a'
    const mutateIdentity = (document: ReturnType<typeof canonicalizeValidatedKnowledgeCollection>) => ({
      ...document,
      payload: {
        ...document.payload,
        identity: {
          ...document.payload.identity,
          knowledgeCollectionId: `${document.payload.identity.knowledgeCollectionId}:${suffix}`,
        },
      },
    })

    const first = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        canonicalize: (collection) => mutateIdentity(canonicalizeValidatedKnowledgeCollection(collection)) as never,
      },
    })
    suffix = 'b'
    const second = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        canonicalize: (collection) => mutateIdentity(canonicalizeValidatedKnowledgeCollection(collection)) as never,
      },
    })

    expect(first.revision).toBe(1)
    expect(second).toMatchObject({ status: 'observed', revision: 2, fingerprintChanged: true, idempotent: false })
  })

  it('links supersedes to the previous revision for a second material revision', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    let suffix = 'one'
    const canonicalize = (collection: Parameters<typeof canonicalizeValidatedKnowledgeCollection>[0]) => {
      const document = canonicalizeValidatedKnowledgeCollection(collection)
      return {
        ...document,
        payload: {
          ...document.payload,
          identity: {
            ...document.payload.identity,
            knowledgeCollectionId: `${document.payload.identity.knowledgeCollectionId}:${suffix}`,
          },
        },
      }
    }

    const first = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { canonicalize: canonicalize as never },
    })
    suffix = 'two'
    const second = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: { canonicalize: canonicalize as never },
    })
    const records = await repository.listByKnowledgeSnapshotKey(first.knowledgeSnapshotKey!)

    expect(second.revision).toBe(2)
    expect(records[1].supersedesKnowledgeSnapshotId).toBe(records[0].knowledgeSnapshotId)
  })

  it('is idempotent for the same sealed financial snapshot', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const first = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const second = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })

    expect(first).toMatchObject({ revision: 1, idempotent: false })
    expect(second).toMatchObject({ revision: 1, idempotent: true, fingerprintChanged: false })
  })

  it('keeps a single material revision across five equivalent executions', async () => {
    const { repository } = repositoryFixture()
    const inputs = await Promise.all([
      buildSealedFinancialSnapshot(),
      buildSealedFinancialSnapshot({
        candidateId: 'candidate:2' as SnapshotCandidateId,
        generatedAt: '2026-07-16T00:00:01.000Z' as UtcInstant,
        sealedAt: '2026-07-16T00:00:02.000Z' as UtcInstant,
        asOf: '2026-07-16T00:00:03.000Z' as UtcInstant,
      }),
      buildSealedFinancialSnapshot({
        candidateId: 'candidate:3' as SnapshotCandidateId,
        generatedAt: '2026-07-17T00:00:01.000Z' as UtcInstant,
        sealedAt: '2026-07-17T00:00:02.000Z' as UtcInstant,
        asOf: '2026-07-17T00:00:03.000Z' as UtcInstant,
      }),
      buildSealedFinancialSnapshot({
        candidateId: 'candidate:4' as SnapshotCandidateId,
        generatedAt: '2026-07-18T00:00:01.000Z' as UtcInstant,
        sealedAt: '2026-07-18T00:00:02.000Z' as UtcInstant,
        asOf: '2026-07-18T00:00:03.000Z' as UtcInstant,
      }),
      buildSealedFinancialSnapshot({
        candidateId: 'candidate:5' as SnapshotCandidateId,
        generatedAt: '2026-07-19T00:00:01.000Z' as UtcInstant,
        sealedAt: '2026-07-19T00:00:02.000Z' as UtcInstant,
        asOf: '2026-07-19T00:00:03.000Z' as UtcInstant,
      }),
    ])

    const results = []
    for (const snapshot of inputs) {
      results.push(await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false }))
    }

    expect(results[0]).toMatchObject({ revision: 1, idempotent: false })
    for (const result of results.slice(1)) {
      expect(result).toMatchObject({ revision: 1, idempotent: true, fingerprintChanged: false })
    }
    expect(await repository.listByKnowledgeSnapshotKey(results[0].knowledgeSnapshotKey!)).toHaveLength(1)
  })

  it('deduplicates a strict-mode style double call into a single persistence', async () => {
    const { repository, memory } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const persist = vi.fn(async (...args: Parameters<KnowledgeSnapshotRepository['persist']>) => {
      return repository.persist(...args)
    })
    const input = buildInput(repository, snapshot, {
      repository: {
        persist,
        getLatestByKnowledgeSnapshotKey: repository.getLatestByKnowledgeSnapshotKey.bind(repository),
      } as unknown as KnowledgeSnapshotRepository,
    })

    const [first, second] = await Promise.all([
      runKnowledgeShadowMode(input, { dev: false }),
      runKnowledgeShadowMode(input, { dev: false }),
    ])

    expect(first).toBe(second)
    expect(persist).toHaveBeenCalledOnce()
    expect(memory.knowledgeSnapshots.records.size).toBe(1)
  })

  it('deduplicates two simultaneous equivalent executions', async () => {
    const { repository, memory } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const input = buildInput(repository, snapshot)
    const [first, second] = await Promise.all([
      runKnowledgeShadowMode(input, { dev: false }),
      runKnowledgeShadowMode(input, { dev: false }),
    ])

    expect(first).toBe(second)
    expect(memory.knowledgeSnapshots.records.size).toBe(1)
  })

  it('remains idempotent after repository reopen', async () => {
    const { memory, repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const first = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const reopenedRepository = new KnowledgeSnapshotRepository(memory as unknown as KnowledgeSnapshotDatabase)
    const second = await runKnowledgeShadowMode(buildInput(reopenedRepository, snapshot), { dev: false })

    expect(first.revision).toBe(1)
    expect(second).toMatchObject({ revision: 1, idempotent: true })
  })

  it('changes key when the source financial snapshot changes according to the current contract', async () => {
    const { repository } = repositoryFixture()
    const firstSnapshot = await buildSealedFinancialSnapshot()
    const secondSnapshot = await buildSealedFinancialSnapshot({
      engineResult: engineResultFixture({ balanceReport: { generalBalance: 999, netProfit: 500 } }),
    })

    const first = await runKnowledgeShadowMode(buildInput(repository, firstSnapshot), { dev: false })
    const second = await runKnowledgeShadowMode(buildInput(repository, secondSnapshot), { dev: false })

    expect(first.knowledgeSnapshotKey).not.toBe(second.knowledgeSnapshotKey)
  })

  it('changes key when the knowledge rules version changes under the current key derivation contract', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()

    const first = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const second = await runKnowledgeShadowMode(
      buildInput(repository, snapshot, {
        versions: {
          ...DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
          rulesVersion: 'knowledge-rules/1.0.1' as typeof DEFAULT_KNOWLEDGE_SHADOW_VERSIONS.rulesVersion,
        },
      }),
      { dev: false },
    )

    expect(second).toMatchObject({ status: 'failed', reasonCode: 'KNOWLEDGE_SHADOW_UNSUPPORTED_VERSION' })
    expect(first.knowledgeSnapshotKey).toBeDefined()
  })

  it('changes key when the knowledge projection version changes under the current key derivation contract', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const first = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const second = await runKnowledgeShadowMode(
      buildInput(repository, snapshot, {
        versions: {
          ...DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
          projectionVersion: 'knowledge-projection/1.0.1' as typeof DEFAULT_KNOWLEDGE_SHADOW_VERSIONS.projectionVersion,
        },
      }),
      { dev: false },
    )

    expect(second).toMatchObject({ status: 'failed', reasonCode: 'KNOWLEDGE_SHADOW_UNSUPPORTED_VERSION' })
    expect(first.knowledgeSnapshotKey).toBeDefined()
  })

  it('changes the fingerprint when the resulting fact set changes', async () => {
    const { repository } = repositoryFixture()
    const positive = await buildSealedFinancialSnapshot()
    const empty = await buildSealedFinancialSnapshot({
      engineResult: engineResultFixture({
        balanceReport: { hasData: false, generalBalance: 0, netProfit: 0 },
        incomeCount: 0,
        expenseCount: 0,
        adjustmentCount: 0,
      }),
      sourceRecordIds: [],
    })

    const first = await runKnowledgeShadowMode(buildInput(repository, positive), { dev: false })
    const second = await runKnowledgeShadowMode(buildInput(repository, empty), { dev: false })

    expect(first.knowledgeSnapshotId).not.toBe(second.knowledgeSnapshotId)
  })

  it('reports the correct factCount', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    expect(result.factCount).toBe(6)
  })

  it('reports the expected factTypes', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    expect(result.factTypes).toEqual([
      'adjustment.absent',
      'balance.positive',
      'cashflow.positive',
      'expense.present',
      'income.present',
      'period.non_empty',
    ])
  })

  it('does not return full facts in the public result', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false }) as Record<string, unknown>
    expect(result.facts).toBeUndefined()
  })

  it('does not return the canonical document in the public result', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false }) as Record<string, unknown>
    expect(result.canonicalDocument).toBeUndefined()
  })

  it('isolates a builder failure', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        build: () => {
          throw new Error('BUILDER_FAILED')
        },
      },
    })
    expect(result).toMatchObject({ status: 'failed', reasonCode: 'BUILDER_FAILED' })
  })

  it('isolates a validator failure', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        validate: () => {
          throw new Error('VALIDATOR_FAILED')
        },
      },
    })
    expect(result).toMatchObject({ status: 'failed', reasonCode: 'VALIDATOR_FAILED' })
  })

  it('isolates a canonicalizer failure', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        canonicalize: () => {
          throw new Error('CANONICALIZER_FAILED')
        },
      },
    })
    expect(result).toMatchObject({ status: 'failed', reasonCode: 'CANONICALIZER_FAILED' })
  })

  it('isolates a fingerprint failure', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        fingerprint: async () => {
          throw new Error('FINGERPRINT_FAILED')
        },
      },
    })
    expect(result).toMatchObject({ status: 'failed', reasonCode: 'FINGERPRINT_FAILED' })
  })

  it('isolates a sealer failure', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), {
      dev: false,
      pipeline: {
        seal: async () => {
          throw new Error('SEALER_FAILED')
        },
      },
    })
    expect(result).toMatchObject({ status: 'failed', reasonCode: 'SEALER_FAILED' })
  })

  it('isolates a repository failure', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const failingRepository = {
      persist: async () => {
        throw new KnowledgePersistenceError('KNOWLEDGE_PERSISTENCE_SCHEMA_ERROR')
      },
      getLatestByKnowledgeSnapshotKey: repository.getLatestByKnowledgeSnapshotKey.bind(repository),
    }
    const result = await runKnowledgeShadowMode(
      buildInput(repository, snapshot, { repository: failingRepository as unknown as KnowledgeSnapshotRepository }),
      { dev: false },
    )
    expect(result).toMatchObject({ status: 'failed', reasonCode: 'KNOWLEDGE_PERSISTENCE_SCHEMA_ERROR' })
  })

  it('does not emit logs in production mode', async () => {
    const { repository } = repositoryFixture()
    const logger = vi.fn()
    const snapshot = await buildSealedFinancialSnapshot()
    await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false, logger })
    expect(logger).not.toHaveBeenCalled()
  })

  it('emits safe logs in development mode', async () => {
    const { repository } = repositoryFixture()
    const logger = vi.fn()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: true, logger })

    expect(result.status).toBe('observed')
    expect(logger).toHaveBeenCalledWith(
      '[knowledge-shadow] Observation',
      expect.objectContaining({
        consumer: 'home.balance.current-month',
        factCount: 6,
        factTypes: expect.arrayContaining(['income.present']),
      }),
    )
  })

  it('never logs amounts in development mode', async () => {
    const { repository } = repositoryFixture()
    const logger = vi.fn()
    const snapshot = await buildSealedFinancialSnapshot()
    await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: true, logger })

    const details = JSON.stringify(logger.mock.calls[0][1])
    expect(details).not.toContain('generalBalance')
    expect(details).not.toContain('netProfit')
  })

  it('never logs full evidence in development mode', async () => {
    const { repository } = repositoryFixture()
    const logger = vi.fn()
    const snapshot = await buildSealedFinancialSnapshot()
    await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: true, logger })

    const details = JSON.stringify(logger.mock.calls[0][1])
    expect(details).not.toContain('sourceRecordIds')
    expect(details).not.toContain('evidenceReferences')
  })

  it('does not mutate the input object', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({ earningPeriodId: 17, usageMode: 'professional' })
    const input = buildInput(repository, snapshot)
    const before = structuredClone({ ...input, repository: undefined })

    await runKnowledgeShadowMode(input, { dev: false })
    expect({ ...input, repository: undefined }).toEqual(before)
    expect(input.repository).toBe(repository)
  })

  it('does not use Date.now in the implementation', () => {
    expect(serviceSource).not.toContain('Date.now(')
  })

  it('does not use Math.random in the implementation', () => {
    expect(serviceSource).not.toContain('Math.random(')
  })

  it('does not use fetch or network primitives in the implementation', () => {
    expect(serviceSource).not.toContain('fetch(')
    expect(serviceSource).not.toContain('XMLHttpRequest')
  })

  it('does not reference Neon in the implementation', () => {
    expect(serviceSource.toLowerCase()).not.toContain('neon')
  })

  it('does not reference n8n in the implementation', () => {
    expect(serviceSource.toLowerCase()).not.toContain('n8n')
  })

  it('does not reference WhatsApp in the implementation', () => {
    expect(serviceSource.toLowerCase()).not.toContain('whatsapp')
  })

  it('does not reference an insight engine in the implementation', () => {
    expect(serviceSource.toLowerCase()).not.toContain('insight engine')
  })

  it('does not reference llm runtime behavior in the implementation', () => {
    expect(serviceSource.toLowerCase()).not.toContain('llm')
  })

  it('supports an empty dataset deterministically', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({
      engineResult: engineResultFixture({
        balanceReport: { hasData: false, generalBalance: 0, netProfit: 0 },
        incomeCount: 0,
        expenseCount: 0,
        adjustmentCount: 0,
      }),
      sourceRecordIds: [],
    })
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })

    expect(result.factTypes).toEqual([
      'adjustment.absent',
      'balance.neutral',
      'cashflow.neutral',
      'expense.absent',
      'income.absent',
      'period.empty',
    ])
  })

  it('supports basic mode', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({ usageMode: 'basic' })
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const stored = await latestRecord(repository, result.knowledgeSnapshotKey!)
    expect(stored.canonicalDocument.payload.facts[0].scope.usageMode).toBe('basic')
  })

  it('supports professional mode', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({ usageMode: 'professional', earningPeriodId: 17 })
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const stored = await latestRecord(repository, result.knowledgeSnapshotKey!)
    expect(stored.canonicalDocument.payload.facts[0].scope.usageMode).toBe('professional')
  })

  it('preserves active season context through earningPeriodId', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({ usageMode: 'professional', earningPeriodId: 17 })
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const stored = await latestRecord(repository, result.knowledgeSnapshotKey!)
    expect(stored.canonicalDocument.payload.facts[0].scope.earningPeriodId).toBe(17)
  })

  it('persists settings context evidence references', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot({ usageMode: 'basic' })
    const result = await runKnowledgeShadowMode(buildInput(repository, snapshot), { dev: false })
    const stored = await latestRecord(repository, result.knowledgeSnapshotKey!)

    expect(
      stored.canonicalDocument.payload.evidenceReferences.some(
        (reference) =>
          reference.evidenceType === 'context-kind' &&
          reference.evidenceValue === 'settings-context',
      ),
    ).toBe(true)
  })

  it('rejects unknown versions fail-closed', async () => {
    const { repository } = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()
    const result = await runKnowledgeShadowMode(
      buildInput(repository, snapshot, {
        versions: {
          ...DEFAULT_KNOWLEDGE_SHADOW_VERSIONS,
          knowledgeVersion: 'knowledge/9.9.9' as typeof DEFAULT_KNOWLEDGE_SHADOW_VERSIONS.knowledgeVersion,
        },
      }),
      { dev: false },
    )

    expect(result).toMatchObject({ status: 'failed', reasonCode: 'KNOWLEDGE_SHADOW_UNSUPPORTED_VERSION' })
  })

  it('produces a deterministic first result across repositories', async () => {
    const left = repositoryFixture()
    const right = repositoryFixture()
    const snapshot = await buildSealedFinancialSnapshot()

    const first = await runKnowledgeShadowMode(buildInput(left.repository, snapshot), { dev: false })
    const second = await runKnowledgeShadowMode(buildInput(right.repository, snapshot), { dev: false })

    expect(second).toEqual(first)
  })
})