import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  runSnapshotShadowMode,
  type SnapshotShadowModeInput,
} from '../src/services/snapshotShadowModeService'
import { FinancialSnapshotRepository, type FinancialSnapshotDatabase } from '../src/intelligence/financial-snapshot/financialSnapshotRepository'
import type { PersistedFinancialSnapshot } from '../src/types/persistedFinancialSnapshot'
import type {
  CivilDate,
  IanaTimeZone,
  SealedSnapshotId,
  SnapshotCandidateId,
  SnapshotKey,
  SnapshotNormativeCode,
  UtcInstant,
} from '../src/types/financialSnapshot'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import { runFinancialEngine } from '../src/services/financialEngineAdapter'

const at = '2026-07-14T10:00:00.000Z' as UtcInstant

class MemorySnapshotTable {
  readonly records = new Map<string, PersistedFinancialSnapshot>()
  async get(id: SealedSnapshotId) { return this.records.get(id) }
  async add(record: PersistedFinancialSnapshot) { this.records.set(record.snapshotId, structuredClone(record)) }
  where() {
    return {
      between: (lower: readonly [SnapshotKey, unknown]) => {
        const values = () => [...this.records.values()]
          .filter((item) => item.snapshotKey === lower[0])
          .sort((a, b) => a.revision - b.revision)
        return { last: async () => values().at(-1), toArray: async () => values() }
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

function income(partial: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1, date: '2026-07-10', duration: 60, totalAmount: 100,
    currency: 'EUR', percentage: 50, realGain: 50, eurValue: 50,
    copValue: 220000, exchangeRateUsed: 4400, usageMode: 'basic',
    notes: 'PRIVATE PERSON 600000000', ...partial,
  }
}

function expense(partial: Partial<Expense> = {}): Expense {
  return {
    id: 2, type: 'gasto', date: '2026-07-11', category: 'General',
    amount: 20, currency: 'EUR', eurValue: 20, copValue: 88000,
    usageMode: 'basic', notes: 'PRIVATE ADDRESS',
    createdAt: '2026-07-11T00:00:00.000Z', ...partial,
  }
}

function fixture(overrides: Partial<SnapshotShadowModeInput> = {}): SnapshotShadowModeInput {
  const incomes = overrides.incomes ?? [income()]
  const expenses = overrides.expenses ?? [expense()]
  const base = {
    consumer: 'home.balance.current-month' as const,
    scope: {
      periodStart: '2026-07-01' as CivilDate,
      periodEndExclusive: '2026-08-01' as CivilDate,
      asOf: at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic' as const,
      currency: 'EUR' as const,
    },
    incomes,
    expenses,
    financialEngineResult: runFinancialEngine({ incomes, expenses, currency: 'EUR', usageMode: 'basic' }),
    candidateId: 'home:2026-07' as SnapshotCandidateId,
    generatedAt: at,
    sealedAt: at,
    persistedAt: at,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
  }
  return { ...base, ...overrides }
}

function repositoryFixture() {
  const database = new MemorySnapshotDatabase()
  const repository = new FinancialSnapshotRepository(database as unknown as FinancialSnapshotDatabase)
  return { database, repository }
}

describe('Snapshot shadow mode observational pipeline', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    [undefined, false], ['false', false], ['TRUE', false], ['1', false], ['yes', false], ['true', true],
  ])('enables only exact true for flag %j', async (value, expected) => {
    vi.stubEnv('VITE_FINANCIAL_SNAPSHOT_SHADOW_ENABLED', value)
    const { database, repository } = repositoryFixture()
    await runSnapshotShadowMode(fixture(), { repository, dev: false })
    expect(database.financialSnapshots.records.size).toBe(expected ? 1 : 0)
  })

  it('runs the complete pipeline and persists a readable first revision', async () => {
    const { repository } = repositoryFixture()
    const result = await runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false })
    expect(result).toMatchObject({ revision: 1, idempotent: false, fingerprintChanged: false })
    const stored = await repository.getLatestBySnapshotKey(result!.snapshotKey)
    expect(stored.snapshotId).toMatch(/^financial-snapshot:/)
    expect(stored.canonicalizationVersion).toBe('financial-snapshot-c14n/2.0.0')
    expect(stored.fingerprint.fingerprintVersion).toBe('financial-snapshot-fingerprint/2.0.0')
    expect(stored.fingerprint.domain).toBe('private-balance:financial-snapshot:fingerprint:v2:')
    expect(stored.canonicalDocument.payload.engineResult).toEqual(fixture().financialEngineResult)
    expect(stored.canonicalDocument.payload.scope.kind).toBe('monthly')
  })

  it('keeps one material revision across five equivalent executions with varying operational times', async () => {
    const { repository } = repositoryFixture()
    const base = fixture()
    const variants = [
      base,
      fixture({
        candidateId: 'home:2026-07:2' as SnapshotCandidateId,
        generatedAt: '2026-07-14T10:00:01.000Z' as UtcInstant,
        sealedAt: '2026-07-14T10:00:02.000Z' as UtcInstant,
        persistedAt: '2026-07-14T10:00:03.000Z' as UtcInstant,
        scope: { ...base.scope, asOf: '2026-07-14T10:00:04.000Z' as UtcInstant },
      }),
      fixture({
        candidateId: 'home:2026-07:3' as SnapshotCandidateId,
        generatedAt: '2026-07-14T11:00:00.000Z' as UtcInstant,
        sealedAt: '2026-07-14T11:00:01.000Z' as UtcInstant,
        persistedAt: '2026-07-14T11:00:02.000Z' as UtcInstant,
        scope: { ...base.scope, asOf: '2026-07-14T11:00:03.000Z' as UtcInstant },
      }),
      fixture({
        candidateId: 'home:2026-07:4' as SnapshotCandidateId,
        generatedAt: '2026-07-15T00:00:00.000Z' as UtcInstant,
        sealedAt: '2026-07-15T00:00:01.000Z' as UtcInstant,
        persistedAt: '2026-07-15T00:00:02.000Z' as UtcInstant,
        scope: { ...base.scope, asOf: '2026-07-15T00:00:03.000Z' as UtcInstant },
      }),
      fixture({
        candidateId: 'home:2026-07:5' as SnapshotCandidateId,
        generatedAt: '2026-07-16T09:30:00.000Z' as UtcInstant,
        sealedAt: '2026-07-16T09:30:01.000Z' as UtcInstant,
        persistedAt: '2026-07-16T09:30:02.000Z' as UtcInstant,
        scope: { ...base.scope, asOf: '2026-07-16T09:30:03.000Z' as UtcInstant },
      }),
    ]

    const observations = []
    for (const input of variants) {
      observations.push(await runSnapshotShadowMode(input, { enabled: true, repository, dev: false }))
    }

    expect(observations[0]).toMatchObject({ revision: 1, idempotent: false })
    for (const observation of observations.slice(1)) {
      expect(observation).toMatchObject({
        revision: 1,
        idempotent: true,
        fingerprintChanged: false,
        divergentFields: [],
      })
    }

    const records = await repository.listBySnapshotKey(observations[0]!.snapshotKey)
    expect(records).toHaveLength(1)
    expect(new Set(records.map((record) => record.snapshotId)).size).toBe(1)
    expect(new Set(records.map((record) => record.fingerprintValue)).size).toBe(1)
  })

  it('is idempotent across repeated executions and creates a linked material revision', async () => {
    const { repository } = repositoryFixture()
    const first = await runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false })
    const duplicate = await runSnapshotShadowMode(fixture({ candidateId: 'other' as SnapshotCandidateId }), { enabled: true, repository, dev: false })
    expect(duplicate).toMatchObject({ revision: 1, idempotent: true, fingerprintChanged: false })

    const changedIncome = income({ eurValue: 75 })
    const changed = fixture({
      incomes: [changedIncome],
      financialEngineResult: runFinancialEngine({ incomes: [changedIncome], expenses: [expense()], currency: 'EUR', usageMode: 'basic' }),
    })
    const second = await runSnapshotShadowMode(changed, { enabled: true, repository, dev: false })
    const records = await repository.listBySnapshotKey(first!.snapshotKey)
    expect(second).toMatchObject({ revision: 2, fingerprintChanged: true })
    expect(records[1].supersedesSnapshotId).toBe(records[0].snapshotId)
  })

  it('deduplicates two simultaneous equivalent executions', async () => {
    const { database, repository } = repositoryFixture()
    const [first, second] = await Promise.all([
      runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false }),
      runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false }),
    ])
    expect(first).toBe(second)
    expect(database.financialSnapshots.records.size).toBe(1)
  })

  it.each([
    ['income', fixture({ incomes: [income({ eurValue: 75 })], financialEngineResult: runFinancialEngine({ incomes: [income({ eurValue: 75 })], expenses: [expense()], currency: 'EUR', usageMode: 'basic' }) })],
    ['expense', fixture({ expenses: [expense({ eurValue: 25 })], financialEngineResult: runFinancialEngine({ incomes: [income()], expenses: [expense({ eurValue: 25 })], currency: 'EUR', usageMode: 'basic' }) })],
    ['adjustment', fixture({ incomes: [income({ type: 'ajuste', eurValue: 5 })], financialEngineResult: runFinancialEngine({ incomes: [income({ type: 'ajuste', eurValue: 5 })], expenses: [expense()], currency: 'EUR', usageMode: 'basic' }) })],
  ])('creates a new revision for material %s changes', async (_label, changedInput) => {
    const { repository } = repositoryFixture()
    const first = await runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false })
    const second = await runSnapshotShadowMode(changedInput, { enabled: true, repository, dev: false })
    const records = await repository.listBySnapshotKey(first!.snapshotKey)

    expect(second).toMatchObject({ revision: 2, idempotent: false, fingerprintChanged: true })
    expect(records).toHaveLength(2)
    expect(records[1].snapshotId).not.toBe(records[0].snapshotId)
    expect(records[1].supersedesSnapshotId).toBe(records[0].snapshotId)
  })

  it.each([
    ['currency', fixture({
      scope: { ...fixture().scope, currency: 'USD' as const },
      incomes: [income({ currency: 'USD' })],
      expenses: [expense({ currency: 'USD' })],
      financialEngineResult: runFinancialEngine({ incomes: [income({ currency: 'USD' })], expenses: [expense({ currency: 'USD' })], currency: 'USD', usageMode: 'basic' }),
    })],
    ['usageMode', fixture({
      scope: { ...fixture().scope, usageMode: 'professional' as const, earningPeriodId: 9 },
      incomes: [income({ usageMode: 'professional', earningPeriodId: 9 })],
      expenses: [expense({ usageMode: 'professional', earningPeriodId: 9 })],
      financialEngineResult: runFinancialEngine({ incomes: [income({ usageMode: 'professional', earningPeriodId: 9 })], expenses: [expense({ usageMode: 'professional', earningPeriodId: 9 })], currency: 'EUR', usageMode: 'professional', earningPeriodId: 9 }),
    })],
    ['period', fixture({
      scope: { ...fixture().scope, periodStart: '2026-06-01' as CivilDate, periodEndExclusive: '2026-07-01' as CivilDate },
    })],
  ])('changes snapshotKey for material scope %s changes', async (_label, changedInput) => {
    const { repository } = repositoryFixture()
    const first = await runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false })
    const second = await runSnapshotShadowMode(changedInput, { enabled: true, repository, dev: false })

    expect(second!.snapshotKey).not.toBe(first!.snapshotKey)
    expect((await repository.listBySnapshotKey(first!.snapshotKey))).toHaveLength(1)
    expect((await repository.listBySnapshotKey(second!.snapshotKey))).toHaveLength(1)
  })

  it.each(['build', 'validate', 'canonicalize', 'fingerprint', 'seal'] as const)(
    'isolates a %s failure', async (stage) => {
      const logger = vi.fn()
      const pipeline = { [stage]: () => { throw new Error(`failed ${stage}`) } }
      await expect(runSnapshotShadowMode(fixture(), {
        enabled: true, dev: true, logger, pipeline,
        repository: repositoryFixture().repository,
      })).resolves.toBeUndefined()
      expect(logger).toHaveBeenCalledWith(
        '[financial-snapshot] Shadow execution failed',
        expect.not.objectContaining({ evidence: expect.anything() }),
      )
    },
  )

  it('isolates comparison failure after persistence', async () => {
    const { repository } = repositoryFixture()
    await runSnapshotShadowMode(fixture(), { enabled: true, repository, dev: false })
    const changedIncome = income({ eurValue: 77 })
    const changed = fixture({
      incomes: [changedIncome],
      financialEngineResult: runFinancialEngine({ incomes: [changedIncome], expenses: [expense()], currency: 'EUR', usageMode: 'basic' }),
    })
    await expect(runSnapshotShadowMode(changed, {
      enabled: true, repository, dev: false,
      pipeline: { compare: () => { throw new Error('compare') } },
    })).resolves.toBeUndefined()
  })

  it('isolates repository failure and never logs in production', async () => {
    const logger = vi.fn()
    const repository = {
      getLatestBySnapshotKey: async () => { throw new Error('not found') },
      persist: async () => { throw new Error('storage failed') },
    }
    await expect(runSnapshotShadowMode(fixture(), { enabled: true, dev: false, logger, repository })).resolves.toBeUndefined()
    expect(logger).not.toHaveBeenCalled()
  })

  it('logs only safe observational metadata in development', async () => {
    const logger = vi.fn()
    await runSnapshotShadowMode(fixture(), { enabled: true, dev: true, logger, repository: repositoryFixture().repository })
    const serialized = JSON.stringify(logger.mock.calls)
    expect(serialized).toContain('Shadow observation')
    expect(serialized).not.toContain('PRIVATE PERSON')
    expect(serialized).not.toContain('PRIVATE ADDRESS')
    expect(logger.mock.calls[0][1]).not.toHaveProperty('evidence')
    expect(logger.mock.calls[0][1]).not.toHaveProperty('canonicalDocument')
    expect(serialized).not.toMatch(/[0-9a-f]{64}/)
  })

  it('runs material diff audit only in development and logs safe summary', async () => {
    const logger = vi.fn()
    const { repository } = repositoryFixture()
    const first = await runSnapshotShadowMode(fixture(), {
      enabled: true,
      repository,
      dev: false,
    })
    expect(first).toBeDefined()

    const audit = vi.fn().mockReturnValue({
      equivalent: true,
      previousCanonicalizationVersion: 'financial-snapshot-c14n/2.0.0',
      currentCanonicalizationVersion: 'financial-snapshot-c14n/2.0.0',
      changedPaths: [],
      summaryCodes: ['diff.none'],
    })

    const second = await runSnapshotShadowMode(
      fixture({ candidateId: 'home:2026-07:dev-audit' as SnapshotCandidateId }),
      {
        enabled: true,
        repository,
        dev: true,
        logger,
        pipeline: { audit },
      },
    )

    expect(second).toMatchObject({ idempotent: true, revision: 1 })
    expect(audit).toHaveBeenCalledTimes(1)
    expect(logger).toHaveBeenCalledWith(
      '[financial-snapshot] Material diff audit',
      expect.objectContaining({
        equivalent: true,
        previousRevision: 1,
        summaryCodes: ['diff.none'],
      }),
    )
    const serialized = JSON.stringify(logger.mock.calls)
    expect(serialized).not.toContain('PRIVATE PERSON')
    expect(serialized).not.toContain('PRIVATE ADDRESS')
    expect(serialized).not.toMatch(/[0-9a-f]{64}/)
  })

  it('does not run material diff audit in production', async () => {
    const logger = vi.fn()
    const { repository } = repositoryFixture()
    await runSnapshotShadowMode(fixture(), {
      enabled: true,
      repository,
      dev: false,
    })

    const audit = vi.fn().mockReturnValue({
      equivalent: true,
      previousCanonicalizationVersion: 'financial-snapshot-c14n/2.0.0',
      currentCanonicalizationVersion: 'financial-snapshot-c14n/2.0.0',
      changedPaths: [],
      summaryCodes: ['diff.none'],
    })

    await runSnapshotShadowMode(
      fixture({ candidateId: 'home:2026-07:prod-no-audit' as SnapshotCandidateId }),
      {
        enabled: true,
        repository,
        dev: false,
        logger,
        pipeline: { audit },
      },
    )

    expect(audit).not.toHaveBeenCalled()
    expect(logger).not.toHaveBeenCalledWith(
      '[financial-snapshot] Material diff audit',
      expect.anything(),
    )
  })

  it.each([
    ['empty', [], [], 'basic' as const, undefined],
    ['professional season', [income({ usageMode: 'professional', earningPeriodId: 9 })], [expense({ usageMode: 'professional', earningPeriodId: 9 })], 'professional' as const, 9],
    ['adjustments', [income({ type: 'ajuste', eurValue: 10 })], [expense({ type: 'ajuste', eurValue: -5 })], 'basic' as const, undefined],
    ['legacy IDs', [income({ id: undefined })], [expense({ id: undefined })], 'basic' as const, undefined],
    ['negative zero', [income({ eurValue: -0 })], [], 'basic' as const, undefined],
  ])('supports %s dataset without mutating inputs', async (_label, incomes, expenses, usageMode, earningPeriodId) => {
    const frozenIncomes = Object.freeze(incomes.map((item) => Object.freeze(item)))
    const frozenExpenses = Object.freeze(expenses.map((item) => Object.freeze(item)))
    const input = fixture({
      incomes: frozenIncomes,
      expenses: frozenExpenses,
      scope: { ...fixture().scope, usageMode, ...(earningPeriodId === undefined ? {} : { earningPeriodId }) },
      financialEngineResult: runFinancialEngine({ incomes: frozenIncomes, expenses: frozenExpenses, currency: 'EUR', usageMode, earningPeriodId }),
    })
    const before = JSON.stringify(input)
    await expect(runSnapshotShadowMode(input, { enabled: true, dev: false, repository: repositoryFixture().repository })).resolves.toBeDefined()
    expect(JSON.stringify(input)).toBe(before)
  })
})
