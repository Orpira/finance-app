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
    expect(stored.canonicalDocument.payload.engineResult).toEqual(fixture().financialEngineResult)
    expect(stored.canonicalDocument.payload.scope.kind).toBe('monthly')
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
