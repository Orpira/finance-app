import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { FinanceDB } from '../src/database/db'
import {
  FinancialSnapshotRepository,
  type FinancialSnapshotDatabase,
} from '../src/intelligence/financial-snapshot/financialSnapshotRepository'
import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../src/intelligence/financial-snapshot/snapshotSealer'
import { buildKnowledgeCollectionFromSnapshot } from '../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import { canonicalizeValidatedKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import { validateKnowledgeCollection } from '../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import { fingerprintCanonicalKnowledgeDocument } from '../src/intelligence/knowledge-layer/knowledgeFingerprint'
import {
  KnowledgePersistenceError,
  KnowledgeSnapshotRepository,
  type KnowledgeSnapshotDatabase,
} from '../src/intelligence/knowledge-layer/knowledgeSnapshotRepository'
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
  SealedSnapshotId,
  SnapshotCandidateId,
  SnapshotKey,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'
import type {
  KnowledgeBuilderInput,
  KnowledgeBuilderVersion,
  KnowledgeProjectionVersion,
  KnowledgeRevisionReasonCode,
  KnowledgeRulesVersion,
  KnowledgeSnapshotId,
  KnowledgeVersion,
  SealedKnowledgeSnapshot,
} from '../src/types/knowledgeLayer'
import type { PersistedFinancialSnapshot } from '../src/types/persistedFinancialSnapshot'
import type { PersistedKnowledgeSnapshot } from '../src/types/persistedKnowledgeSnapshot'

const __filename = fileURLToPath(import.meta.url)
const __dirname = resolve(__filename, '..')
const repositoryPath = resolve(
  __dirname,
  '../src/intelligence/knowledge-layer/knowledgeSnapshotRepository.ts',
)

const at = '2026-07-16T00:00:00.000Z' as UtcInstant
const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const BUILDER_VERSION = 'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const PROJECTION_VERSION = 'knowledge-projection/1.0.0' as KnowledgeProjectionVersion
const REVISION_REASON = 'revision.source_changed' as KnowledgeRevisionReasonCode

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
    return this.records.get(id)
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
      between: (lower: readonly [SnapshotKey, unknown]) => {
        const values = () =>
          [...this.records.values()]
            .filter((item) => item.knowledgeSnapshotKey === lower[0])
            .sort((a, b) => a.revision - b.revision)
        return {
          last: async () => values().at(-1),
          toArray: async () => values(),
        }
      },
    }
  }
}

class MemoryFinancialSnapshotTable {
  readonly records = new Map<string, PersistedFinancialSnapshot>()

  async get(id: SealedSnapshotId): Promise<PersistedFinancialSnapshot | undefined> {
    return this.records.get(id)
  }

  async add(record: PersistedFinancialSnapshot): Promise<void> {
    if (this.records.has(record.snapshotId)) {
      throw Object.assign(new Error(), { name: 'ConstraintError' })
    }
    if (
      [...this.records.values()].some(
        (item) =>
          item.snapshotKey === record.snapshotKey &&
          item.revision === record.revision,
      )
    ) {
      throw Object.assign(new Error(), { name: 'ConstraintError' })
    }
    this.records.set(record.snapshotId, structuredClone(record))
  }

  where() {
    return {
      between: (lower: readonly [SnapshotKey, unknown]) => {
        const values = () =>
          [...this.records.values()]
            .filter((item) => item.snapshotKey === lower[0])
            .sort((a, b) => a.revision - b.revision)
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
  readonly financialSnapshots = new MemoryFinancialSnapshotTable()

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

function baseEngineResult(overrides: Partial<EngineResultFixture> = {}): EngineResultFixture {
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
    ...overrides,
    balanceReport: {
      ...base.balanceReport,
      ...(overrides.balanceReport ?? {}),
    },
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
        generatedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
        sourceScopeAsOf: '2026-07-15T10:00:00.000Z' as UtcInstant,
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
    sealedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
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
      asOf: '2026-07-15T10:00:00.000Z' as UtcInstant,
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
      generatedAt: '2026-07-15T10:00:00.000Z' as UtcInstant,
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

function builderInput(snapshot: SealedFinancialSnapshot<EngineResultFixture>):
  KnowledgeBuilderInput<EngineResultFixture> {
  return {
    snapshot,
    knowledgeVersion: KNOWLEDGE_VERSION,
    builderVersion: BUILDER_VERSION,
    rulesVersion: RULES_VERSION,
    projectionVersion: PROJECTION_VERSION,
  }
}

async function sealKnowledge(
  engineResult: EngineResultFixture = baseEngineResult(),
  options: {
    readonly usageMode?: 'basic' | 'professional'
    readonly earningPeriodId?: number
    readonly revision?: number
    readonly supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId
    readonly identitySuffix?: string
    readonly snapshotOverrides?: Record<string, unknown>
  } = {},
): Promise<SealedKnowledgeSnapshot> {
  const snapshot = baseSnapshot(engineResult, {
    ...(options.snapshotOverrides ?? {}),
    scope: {
      ...baseSnapshot(engineResult).scope,
      usageMode: options.usageMode ?? 'basic',
      ...(options.earningPeriodId === undefined
        ? {}
        : { earningPeriodId: options.earningPeriodId }),
      ...((options.snapshotOverrides?.scope as Record<string, unknown> | undefined) ?? {}),
    },
  })

  const draft = buildKnowledgeCollectionFromSnapshot(builderInput(snapshot))
  const validated = validateKnowledgeCollection(draft)
  const canonicalDocument = canonicalizeValidatedKnowledgeCollection(validated)

  if (options.identitySuffix !== undefined) {
    ;(canonicalDocument.payload.identity as { knowledgeCollectionId: string }).knowledgeCollectionId =
      `${canonicalDocument.payload.identity.knowledgeCollectionId}:${options.identitySuffix}`
  }

  const fingerprint = await fingerprintCanonicalKnowledgeDocument(canonicalDocument)
  const knowledgeSnapshotKey = deriveKnowledgeSnapshotKey(canonicalDocument)

  return sealCanonicalKnowledgeDocument({
    canonicalDocument,
    fingerprint,
    knowledgeSnapshotKey,
    revision: options.revision ?? 1,
    revisionReasonCode: REVISION_REASON,
    sealedAt: at,
    ...(options.supersedesKnowledgeSnapshotId === undefined
      ? {}
      : {
          supersedesKnowledgeSnapshotId:
            options.supersedesKnowledgeSnapshotId,
        }),
  })
}

async function sealFinancial(
  balance: number,
  revision = 1,
  supersedesSnapshotId?: SealedSnapshotId,
): Promise<SealedFinancialSnapshot<{ readonly balance: number }>> {
  const candidate: ValidatedSnapshotCandidate<{ readonly balance: number }> = {
    status: 'validated',
    identity: { candidateId: `candidate:${balance}` as SnapshotCandidateId },
    scope: {
      kind: 'monthly',
      periodStart: '2026-01-01' as CivilDate,
      periodEndExclusive: '2026-02-01' as CivilDate,
      periodBoundary: '[start,end)',
      asOf: at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic',
      currency: 'EUR',
      filters: {},
    },
    engineResult: { balance },
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
      generatedAt: at,
      generationReasonCode: 'test' as SnapshotNormativeCode,
      provenance: 'local',
      qualityCodes: [],
      warningCodes: [],
      limitationCodes: [],
    },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    engineVersion: 'engine/1' as EngineVersion,
    rulesetVersion: 'rules/1' as RulesetVersion,
  }

  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)
  return sealCanonicalSnapshot({
    canonicalDocument,
    fingerprint: await fingerprintCanonicalSnapshotDocument(canonicalDocument),
    snapshotKey: deriveSnapshotKey(canonicalDocument),
    revision,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
    sealedAt: at,
    ...(supersedesSnapshotId === undefined ? {} : { supersedesSnapshotId }),
  })
}

async function expectKnowledgeError(
  action: () => Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await action()
    throw new Error('Expected KnowledgePersistenceError')
  } catch (error) {
    expect(error).toBeInstanceOf(KnowledgePersistenceError)
    expect((error as KnowledgePersistenceError).code).toBe(code)
  }
}

describe('KnowledgeSnapshotRepository', () => {
  it('1. Persistir primera revision.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const result = await repository.persist(source, at)
    expect(result.idempotent).toBe(false)
  })

  it('2. Revision asignada = 1.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const result = await repository.persist(source, at)
    expect(result.revision).toBe(1)
  })

  it('3. Leer por ID.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const persisted = await repository.persist(source, at)
    const found = await repository.getByKnowledgeSnapshotId(source.knowledgeSnapshotId)
    expect(found).toEqual(persisted.record)
  })

  it('4. Listar por key.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'rev2',
    })
    await repository.persist(second, at)
    const list = await repository.listByKnowledgeSnapshotKey(first.knowledgeSnapshotKey)
    expect(list).toHaveLength(2)
  })

  it('5. Obtener latest.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'rev2',
    })
    const persisted = await repository.persist(second, at)
    const latest = await repository.getLatestByKnowledgeSnapshotKey(first.knowledgeSnapshotKey)
    expect(latest.knowledgeSnapshotId).toBe(persisted.record.knowledgeSnapshotId)
  })

  it('6. exists true/false.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    expect(await repository.exists(source.knowledgeSnapshotId)).toBe(false)
    await repository.persist(source, at)
    expect(await repository.exists(source.knowledgeSnapshotId)).toBe(true)
  })

  it('7. Idempotencia mismo ID.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    await repository.persist(source, at)
    const second = await repository.persist(source, '2026-07-17T00:00:00.000Z' as UtcInstant)
    expect(second.idempotent).toBe(true)
  })

  it('8. No duplicar mismo ID.', async () => {
    const { memory, repository } = repositoryFixture()
    const source = await sealKnowledge()
    await repository.persist(source, at)
    await repository.persist(source, at)
    expect(memory.knowledgeSnapshots.records.size).toBe(1)
  })

  it('9. Segunda revision material.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'material-change',
    })
    const result = await repository.persist(second, at)
    expect(result.idempotent).toBe(false)
  })

  it('10. Revision = 2.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'rev2',
    })
    const result = await repository.persist(second, at)
    expect(result.revision).toBe(2)
  })

  it('11. Supersedes correcto.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    const firstPersisted = await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: firstPersisted.record.knowledgeSnapshotId,
      identitySuffix: 'rev2',
    })
    const persisted = await repository.persist(second, at)
    expect(persisted.record.supersedesKnowledgeSnapshotId).toBe(
      firstPersisted.record.knowledgeSnapshotId,
    )
  })

  it('12. Supersedes inexistente rechazado.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)
    const invalid = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId:
        'knowledge-snapshot:knowledge-fingerprint/1.0.0:missing' as KnowledgeSnapshotId,
      identitySuffix: 'invalid-supersedes',
    })
    await expectKnowledgeError(
      () => repository.persist(invalid, at),
      'KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES',
    )
  })

  it('13. Supersedes de otro key rechazado.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    const secondChainRoot = await sealKnowledge(baseEngineResult({ balanceReport: { generalBalance: -50 } }), {
      identitySuffix: 'other-key',
    })

    await repository.persist(first, at)
    await repository.persist(secondChainRoot, at)

    const invalid = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: secondChainRoot.knowledgeSnapshotId,
      identitySuffix: 'wrong-chain',
    })

    await expectKnowledgeError(
      () => repository.persist(invalid, at),
      'KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES',
    )
  })

  it('14. Supersedes no latest rechazado.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    const firstPersisted = await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: firstPersisted.record.knowledgeSnapshotId,
      identitySuffix: 'rev2',
    })
    const secondPersisted = await repository.persist(second, at)

    const thirdInvalid = await sealKnowledge(baseEngineResult(), {
      revision: 3,
      supersedesKnowledgeSnapshotId: firstPersisted.record.knowledgeSnapshotId,
      identitySuffix: 'rev3-invalid',
    })

    expect(secondPersisted.record.revision).toBe(2)
    await expectKnowledgeError(
      () => repository.persist(thirdInvalid, at),
      'KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES',
    )
  })

  it('15. Conflicto mismo key/revision.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)

    const a = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'concurrent-a',
    })
    const b = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'concurrent-b',
    })

    const results = await Promise.allSettled([
      repository.persist(a, at),
      repository.persist(b, at),
    ])

    const rejected = results.find((item) => item.status === 'rejected')
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1)
    if (rejected !== undefined && rejected.status === 'rejected') {
      const code = (rejected.reason as KnowledgePersistenceError).code
      expect(
        code === 'KNOWLEDGE_PERSISTENCE_INVALID_SUPERSEDES' ||
          code === 'KNOWLEDGE_PERSISTENCE_REVISION_CONFLICT',
      ).toBe(true)
    }
  })

  it('16. Integridad fingerprint verificada.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const result = await repository.persist(source, at)
    expect(result.record.fingerprintValue).toBe(source.fingerprint.value)
  })

  it('17. Fingerprint alterado rechazado.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const altered = {
      ...source,
      fingerprint: { ...source.fingerprint, value: '0'.repeat(64) },
    } as SealedKnowledgeSnapshot

    await expectKnowledgeError(
      () => repository.persist(altered, at),
      'KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE',
    )
  })

  it('18. Documento alterado rechazado.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const altered = structuredClone(source)
    ;(altered.canonicalDocument.payload.identity as { knowledgeCollectionId: string }).knowledgeCollectionId =
      `${altered.canonicalDocument.payload.identity.knowledgeCollectionId}:altered`

    await expectKnowledgeError(
      () => repository.persist(altered, at),
      'KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE',
    )
  })

  it('19. knowledgeSnapshotId inconsistente rechazado.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const invalid = {
      ...source,
      knowledgeSnapshotId:
        'knowledge-snapshot:knowledge-fingerprint/1.0.0:inconsistent' as KnowledgeSnapshotId,
      identity: {
        ...source.identity,
        knowledgeSnapshotId:
          'knowledge-snapshot:knowledge-fingerprint/1.0.0:inconsistent' as KnowledgeSnapshotId,
      },
    } as SealedKnowledgeSnapshot

    await expectKnowledgeError(
      () => repository.persist(invalid, at),
      'KNOWLEDGE_PERSISTENCE_INTEGRITY_FAILURE',
    )
  })

  it('20. status no sealed rechazado.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const invalid = {
      ...source,
      status: 'persisted',
    } as unknown as SealedKnowledgeSnapshot

    await expectKnowledgeError(
      () => repository.persist(invalid, at),
      'KNOWLEDGE_PERSISTENCE_INVALID_VALUE',
    )
  })

  it('21. persistedAt explicito.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const persistedAt = '2026-07-18T01:02:03.004Z' as UtcInstant
    const result = await repository.persist(source, persistedAt)
    expect(result.record.persistedAt).toBe(persistedAt)
  })

  it('22. persistedAt vacio rechazado.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    await expectKnowledgeError(
      () => repository.persist(source, '' as UtcInstant),
      'KNOWLEDGE_PERSISTENCE_INVALID_VALUE',
    )
  })

  it('23. No Date.now.', () => {
    const source = readFileSync(repositoryPath, 'utf8')
    expect(source).not.toContain('Date.now(')
  })

  it('24. No Math.random.', () => {
    const source = readFileSync(repositoryPath, 'utf8')
    expect(source).not.toContain('Math.random(')
  })

  it('25. No red.', () => {
    const source = readFileSync(repositoryPath, 'utf8')
    expect(source).not.toContain('fetch(')
    expect(source).not.toContain('http://')
    expect(source).not.toContain('https://')
  })

  it('26. No Neon.', () => {
    const source = readFileSync(repositoryPath, 'utf8')
    expect(source).not.toContain('neon')
    expect(source).not.toContain('Neon')
  })

  it('27. No n8n.', () => {
    const source = readFileSync(repositoryPath, 'utf8')
    expect(source).not.toContain('n8n')
  })

  it('28. No WhatsApp.', () => {
    const source = readFileSync(repositoryPath, 'utf8')
    expect(source).not.toContain('WhatsApp')
    expect(source).not.toContain('whatsapp')
  })

  it('29. Snapshot no mutado.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const before = structuredClone(source)
    void (await repository.persist(source, at))
    expect(source).toEqual(before)
  })

  it('30. Lectura independiente.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    await repository.persist(source, at)
    const read = await repository.getByKnowledgeSnapshotId(source.knowledgeSnapshotId)
    ;(read.canonicalDocument.payload.metadata as { knowledgeVersion: string }).knowledgeVersion = 'knowledge/9.9.9'

    const again = await repository.getByKnowledgeSnapshotId(source.knowledgeSnapshotId)
    expect(again.knowledgeVersion).toBe(source.knowledgeVersion)
  })

  it('31. Listado ordenado por revision.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)
    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'ordered-2',
    })
    await repository.persist(second, at)
    const list = await repository.listByKnowledgeSnapshotKey(first.knowledgeSnapshotKey)
    expect(list.map((item) => item.revision)).toEqual([1, 2])
  })

  it('32. Retencion total.', async () => {
    const { repository } = repositoryFixture()
    const first = await sealKnowledge()
    await repository.persist(first, at)

    const second = await sealKnowledge(baseEngineResult(), {
      revision: 2,
      supersedesKnowledgeSnapshotId: first.knowledgeSnapshotId,
      identitySuffix: 'ret-2',
    })
    const secondPersisted = await repository.persist(second, at)

    const third = await sealKnowledge(baseEngineResult(), {
      revision: 3,
      supersedesKnowledgeSnapshotId: secondPersisted.record.knowledgeSnapshotId,
      identitySuffix: 'ret-3',
    })
    await repository.persist(third, at)

    const records = await repository.listByKnowledgeSnapshotKey(first.knowledgeSnapshotKey)
    expect(records).toHaveLength(3)
  })

  it('33. No update publico.', () => {
    const { repository } = repositoryFixture()
    expect('update' in repository).toBe(false)
  })

  it('34. No delete publico.', () => {
    const { repository } = repositoryFixture()
    expect('delete' in repository).toBe(false)
  })

  it('35. Error sin contenido sensible.', async () => {
    const { repository } = repositoryFixture()
    const source = await sealKnowledge()
    const sensitive = source.fingerprint.value

    try {
      await repository.persist(
        {
          ...source,
          fingerprint: { ...source.fingerprint, value: '0'.repeat(64) },
        },
        at,
      )
      throw new Error('Expected KnowledgePersistenceError')
    } catch (error) {
      expect((error as Error).message).not.toContain(sensitive)
    }
  })

  it('36. Dataset vacio.', async () => {
    const { repository } = repositoryFixture()
    const empty = await sealKnowledge(
      baseEngineResult({
        incomeCount: 0,
        expenseCount: 0,
        adjustmentCount: 0,
        balanceReport: {
          hasData: false,
          generalBalance: 0,
          netProfit: 0,
        },
      }),
      {
        snapshotOverrides: {
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
        },
      },
    )
    const result = await repository.persist(empty, at)
    expect(result.record.canonicalDocument.payload.facts.length).toBeGreaterThan(0)
  })

  it('37. Modo Basico.', async () => {
    const { repository } = repositoryFixture()
    const basic = await sealKnowledge(baseEngineResult(), { usageMode: 'basic' })
    const result = await repository.persist(basic, at)
    expect(result.record.canonicalDocument.payload.facts.every((fact) => fact.scope.usageMode === 'basic')).toBe(true)
  })

  it('38. Modo Profesional.', async () => {
    const { repository } = repositoryFixture()
    const professional = await sealKnowledge(baseEngineResult(), {
      usageMode: 'professional',
    })
    const result = await repository.persist(professional, at)
    expect(result.record.canonicalDocument.payload.facts.every((fact) => fact.scope.usageMode === 'professional')).toBe(true)
  })

  it('39. Temporada activa.', async () => {
    const { repository } = repositoryFixture()
    const season = await sealKnowledge(baseEngineResult(), {
      usageMode: 'professional',
      earningPeriodId: 9,
    })
    const result = await repository.persist(season, at)
    expect(result.record.canonicalDocument.payload.facts.every((fact) => fact.scope.earningPeriodId === 9)).toBe(true)
  })

  it('40. Coexistencia con Financial Snapshot Repository.', async () => {
    const shared = new SharedMemoryDatabase()
    const knowledgeRepository = new KnowledgeSnapshotRepository(
      shared as unknown as KnowledgeSnapshotDatabase,
    )
    const financialRepository = new FinancialSnapshotRepository(
      shared as unknown as FinancialSnapshotDatabase,
    )

    const knowledge = await sealKnowledge()
    const knowledgeResult = await knowledgeRepository.persist(knowledge, at)

    const financial = await sealFinancial(10)
    const financialResult = await financialRepository.persist(financial, at)

    expect(knowledgeResult.record.knowledgeSnapshotId).toBe(knowledge.knowledgeSnapshotId)
    expect(financialResult.snapshotId).toBe(financial.identity.snapshotId)
  })

  it('declara FinanceDB v26 y tabla knowledgeSnapshots.', () => {
    const database = new FinanceDB()
    expect(database.verno).toBe(26)
    expect(database.tables.some((table) => table.name === 'knowledgeSnapshots')).toBe(true)
    expect(database.knowledgeSnapshots.schema.primKey.name).toBe('knowledgeSnapshotId')
    expect(
      database.knowledgeSnapshots.schema.indexes.map((index) => index.name),
    ).toEqual([
      'knowledgeSnapshotKey',
      '[knowledgeSnapshotKey+revision]',
      'sealedAt',
      'status',
      'sourceSnapshotId',
      'sourceSnapshotKey',
      'fingerprintValue',
      'knowledgeVersion',
      'projectionVersion',
    ])
    database.close()
  })
})
