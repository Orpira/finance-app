import { describe, expect, it } from 'vitest'

import { FinanceDB } from '../src/database/db'
import {
  FinancialSnapshotPersistenceError,
  FinancialSnapshotRepository,
  type FinancialSnapshotDatabase,
} from '../src/intelligence/financial-snapshot/financialSnapshotRepository'
import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../src/intelligence/financial-snapshot/snapshotSealer'
import type { PersistedFinancialSnapshot } from '../src/types/persistedFinancialSnapshot'
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

const at = '2026-02-01T00:00:00.000Z' as UtcInstant
const code = (value: string) => value as SnapshotNormativeCode

class MemorySnapshotTable {
  readonly records = new Map<string, PersistedFinancialSnapshot>()

  async get(id: SealedSnapshotId) { return this.records.get(id) }
  async add(record: PersistedFinancialSnapshot) {
    if (this.records.has(record.snapshotId)) throw Object.assign(new Error(), { name: 'ConstraintError' })
    if ([...this.records.values()].some((item) => item.snapshotKey === record.snapshotKey && item.revision === record.revision)) {
      throw Object.assign(new Error(), { name: 'ConstraintError' })
    }
    this.records.set(record.snapshotId, structuredClone(record))
  }
  where() {
    return {
      between: (lower: readonly [SnapshotKey, unknown]) => {
        const values = () => [...this.records.values()]
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

class MemorySnapshotDatabase {
  readonly financialSnapshots = new MemorySnapshotTable()
  private tail = Promise.resolve()

  transaction<T>(_mode: 'rw', _table: unknown, scope: () => Promise<T>): Promise<T> {
    const result = this.tail.then(scope, scope)
    this.tail = result.then(() => undefined, () => undefined)
    return result
  }
}

function repositoryFixture() {
  const memory = new MemorySnapshotDatabase()
  const repository = new FinancialSnapshotRepository(
    memory as unknown as FinancialSnapshotDatabase,
  )
  return { memory, repository }
}

async function sealed(
  balance: number,
  revision = 1,
  supersedesSnapshotId?: SealedSnapshotId,
  canonicalizationVersion: CanonicalizationVersion = 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
): Promise<SealedFinancialSnapshot<{ readonly balance: number }>> {
  const engineVersion = 'engine/1' as EngineVersion
  const rulesetVersion = 'rules/1' as RulesetVersion
  const candidate: ValidatedSnapshotCandidate<{ readonly balance: number }> = {
    status: 'validated',
    identity: { candidateId: `candidate:${balance}` as SnapshotCandidateId },
    scope: {
      kind: 'monthly', periodStart: '2026-01-01' as CivilDate,
      periodEndExclusive: '2026-02-01' as CivilDate, periodBoundary: '[start,end)',
      asOf: at, timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic', currency: 'EUR', filters: {},
    },
    engineResult: { balance },
    evidence: { strategy: 'embedded-v1', records: [], context: [], candidateRecordCount: 0, includedRecordCount: 0, excludedRecordCount: 0, coverageCodes: [], warningCodes: [] },
    appliedRules: [],
    metadata: { generatedAt: at, generationReasonCode: code('test'), provenance: 'local', qualityCodes: [], warningCodes: [], limitationCodes: [] },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion,
    engineVersion, rulesetVersion,
  }
  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)
  return sealCanonicalSnapshot({
    canonicalDocument,
    fingerprint: await fingerprintCanonicalSnapshotDocument(canonicalDocument),
    snapshotKey: deriveSnapshotKey(canonicalDocument),
    revision,
    revisionReasonCode: code('revision.source_changed'),
    sealedAt: at,
    ...(supersedesSnapshotId === undefined ? {} : { supersedesSnapshotId }),
  })
}

async function expectCode(action: () => Promise<unknown>, codeValue: FinancialSnapshotPersistenceError['code']) {
  await expect(action()).rejects.toMatchObject({ code: codeValue, message: codeValue })
}

describe('FinancialSnapshotRepository', () => {
  it('declara FinanceDB v24 y los índices normativos', () => {
    const database = new FinanceDB()
    expect(database.verno).toBe(24)
    expect(database.financialSnapshots.schema.primKey.name).toBe('snapshotId')
    expect(database.financialSnapshots.schema.indexes.map((index) => index.name)).toEqual([
      'snapshotKey', '[snapshotKey+revision]', 'sealedAt', 'status', 'scopeKind',
      'scopePeriodStart', 'fingerprintValue',
    ])
    expect(database.financialSnapshots.schema.idxByName['[snapshotKey+revision]'].unique).toBe(true)
    database.close()
  })

  it('persiste y lee la primera revisión con persistedAt explícito', async () => {
    const { repository } = repositoryFixture()
    const source = await sealed(10)
    const record = await repository.persist(source, at)
    expect(record).toMatchObject({ revision: 1, persistedAt: at, status: 'persisted', localSchemaVersion: 1 })
    expect(await repository.getBySnapshotId(source.identity.snapshotId)).toEqual(record)
    expect(await repository.exists(source.identity.snapshotId)).toBe(true)
  })

  it('lista por key y obtiene latest en orden de revisión', async () => {
    const { repository } = repositoryFixture()
    const first = await sealed(10)
    await repository.persist(first, at)
    const second = await sealed(20, 2, first.identity.snapshotId)
    await repository.persist(second, at)
    expect((await repository.listBySnapshotKey(first.identity.snapshotKey)).map((item) => item.revision)).toEqual([1, 2])
    expect((await repository.getLatestBySnapshotKey(first.identity.snapshotKey)).snapshotId).toBe(second.identity.snapshotId)
  })

  it('preserva coexistencia V1 y V2 sin reescribir V1', async () => {
    const { repository } = repositoryFixture()
    const legacy = await sealed(10, 1, undefined, 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion)
    const legacyRecord = await repository.persist(legacy, at)
    const v2 = await sealed(10, 2, legacy.identity.snapshotId, 'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion)
    await repository.persist(v2, at)

    const records = await repository.listBySnapshotKey(legacy.identity.snapshotKey)
    expect(records).toHaveLength(2)
    expect(records[0]).toEqual(legacyRecord)
    expect(records[1].canonicalizationVersion).toBe('financial-snapshot-c14n/2.0.0')
    expect(records[1].fingerprint.fingerprintVersion).toBe('financial-snapshot-fingerprint/2.0.0')
    expect(records[1].snapshotId).not.toBe(records[0].snapshotId)
    expect(records[1].supersedesSnapshotId).toBe(records[0].snapshotId)
  })

  it('es idempotente para el mismo snapshotId y no duplica', async () => {
    const { memory, repository } = repositoryFixture()
    const source = await sealed(10)
    const first = await repository.persist(source, at)
    const second = await repository.persist(source, '2026-02-02T00:00:00.000Z' as UtcInstant)
    expect(second).toEqual(first)
    expect(memory.financialSnapshots.records.size).toBe(1)
  })

  it('valida supersedes existente, misma key y revisión consecutiva', async () => {
    const { repository } = repositoryFixture()
    const first = await sealed(10)
    await repository.persist(first, at)
    for (const invalid of [
      await sealed(20, 2, 'financial-snapshot:missing' as SealedSnapshotId),
      await sealed(20, 3, first.identity.snapshotId),
    ]) {
      await expectCode(() => repository.persist(invalid, at), 'SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES')
    }
  })

  it('rechaza fingerprint o documento alterado sin exponer contenido', async () => {
    const { repository } = repositoryFixture()
    const source = await sealed(10)
    const sensitive = '99999999'
    const altered = {
      ...source,
      canonicalDocument: {
        ...source.canonicalDocument,
        payload: { ...source.canonicalDocument.payload, engineResult: { balance: sensitive } },
      },
    } as unknown as SealedFinancialSnapshot
    await expectCode(() => repository.persist(altered, at), 'SNAPSHOT_PERSISTENCE_INTEGRITY_FAILURE')
    try { await repository.persist(altered, at) } catch (error) {
      expect((error as Error).message).not.toContain(sensitive)
    }
  })

  it('no muta entrada y devuelve copias independientes', async () => {
    const { repository } = repositoryFixture()
    const source = await sealed(10)
    const before = structuredClone(source)
    const saved = await repository.persist(source, at)
    ;(saved.canonicalDocument.payload.engineResult as { balance: number }).balance = 999
    expect(source).toEqual(before)
    expect((await repository.getBySnapshotId(source.identity.snapshotId)).canonicalDocument.payload.engineResult).toEqual({ balance: 10 })
  })

  it('serializa dos escrituras concurrentes y asigna una sola revisión siguiente', async () => {
    const { repository } = repositoryFixture()
    const first = await sealed(10)
    await repository.persist(first, at)
    const a = await sealed(20, 2, first.identity.snapshotId)
    const b = await sealed(30, 2, first.identity.snapshotId)
    const results = await Promise.allSettled([repository.persist(a, at), repository.persist(b, at)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
  })

  it('falla not found y persistedAt inválido con códigos deterministas', async () => {
    const { repository } = repositoryFixture()
    await expectCode(() => repository.getBySnapshotId('missing' as SealedSnapshotId), 'SNAPSHOT_PERSISTENCE_NOT_FOUND')
    await expectCode(() => repository.getLatestBySnapshotKey('missing' as SnapshotKey), 'SNAPSHOT_PERSISTENCE_NOT_FOUND')
    await expectCode(() => repository.persist(sealed(10) as never, 'invalid' as UtcInstant), 'SNAPSHOT_PERSISTENCE_SCHEMA_ERROR')
  })

  it('no expone update o delete en la API', () => {
    const { repository } = repositoryFixture()
    expect('update' in repository).toBe(false)
    expect('delete' in repository).toBe(false)
  })
})
