import Dexie from 'dexie'

import { FinanceDB } from '../../src/database/db'
import {
  FinancialSnapshotRepository,
  type FinancialSnapshotPersistenceError,
} from '../../src/intelligence/financial-snapshot/financialSnapshotRepository'
import { canonicalizeValidatedSnapshotCandidate } from '../../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../../src/intelligence/financial-snapshot/snapshotSealer'
import { runSnapshotShadowMode } from '../../src/services/snapshotShadowModeService'
import { runFinancialEngine } from '../../src/services/financialEngineAdapter'
import { executeSnapshotPromotion } from '../../src/services/snapshotPromotionExecutor'
import type { Expense } from '../../src/types/expense'
import type { ServiceIncome } from '../../src/types/service'
import type {
  CanonicalizationVersion, CivilDate, EngineVersion, IanaTimeZone, RulesetVersion,
  SealedSnapshotId, SnapshotCandidateId, SnapshotNormativeCode,
  SnapshotVersion, UtcInstant, ValidatedSnapshotCandidate,
} from '../../src/types/financialSnapshot'

const databaseName = 'finance-app'
const at = '2026-02-01T00:00:00.000Z' as UtcInstant
const result = document.querySelector<HTMLPreElement>('#result')!
const checks: string[] = []

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
  checks.push(message)
}

function deepEqual(actual: unknown, expected: unknown, message: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message)
}

async function expectReject(action: () => Promise<unknown>, message: string, code?: string) {
  try {
    await action()
  } catch (error) {
    if (code !== undefined) assert((error as FinancialSnapshotPersistenceError).code === code, message)
    else checks.push(message)
    return
  }
  throw new Error(`Expected rejection: ${message}`)
}

async function sealed(balance: number, revision = 1, supersedesSnapshotId?: SealedSnapshotId) {
  const candidate: ValidatedSnapshotCandidate<{ readonly balance: number }> = {
    status: 'validated',
    identity: { candidateId: `browser-candidate:${balance}` as SnapshotCandidateId },
    scope: {
      kind: 'monthly', periodStart: '2026-01-01' as CivilDate,
      periodEndExclusive: '2026-02-01' as CivilDate, periodBoundary: '[start,end)',
      asOf: at, timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic', currency: 'EUR', filters: {},
    },
    engineResult: { balance },
    evidence: { strategy: 'embedded-v1', records: [], context: [], candidateRecordCount: 0, includedRecordCount: 0, excludedRecordCount: 0, coverageCodes: [], warningCodes: [] },
    appliedRules: [],
    metadata: { generatedAt: at, generationReasonCode: 'test' as SnapshotNormativeCode, provenance: 'local', qualityCodes: [], warningCodes: [], limitationCodes: [] },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    engineVersion: 'engine/1' as EngineVersion,
    rulesetVersion: 'rules/1' as RulesetVersion,
  }
  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)
  return sealCanonicalSnapshot({
    canonicalDocument,
    fingerprint: await fingerprintCanonicalSnapshotDocument(canonicalDocument),
    snapshotKey: deriveSnapshotKey(canonicalDocument), revision,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode, sealedAt: at,
    ...(supersedesSnapshotId === undefined ? {} : { supersedesSnapshotId }),
  })
}

async function run() {
  await Dexie.delete(databaseName)

  const legacy = new Dexie(databaseName)
  legacy.version(22).stores({
    services: '++id,date,currency,country,status,earningPeriodId,seasonPeriodId,reportStatusCode,timerStatus,timerEndsAt',
    settings: 'id',
  })
  await legacy.open()
  const legacyService = { id: 7, date: '2026-01-15', amount: 125, status: 'PENDIENTE' }
  const legacySettings = { id: 'app', businessName: 'Migration sentinel' }
  await legacy.table('services').add(legacyService)
  await legacy.table('settings').add(legacySettings)
  legacy.close()

  let database = new FinanceDB()
  await database.open()
  assert(database.verno === 23, 'physical migration opens schema v23')
  assert(database.tables.some((table) => table.name === 'financialSnapshots'), 'migration creates financialSnapshots')
  deepEqual(await database.services.get(7), legacyService, 'migration preserves legacy service data')
  deepEqual(await database.settings.get('app'), legacySettings, 'migration preserves legacy settings data')

  let repository = new FinancialSnapshotRepository(database)
  const source = await sealed(10)
  const persisted = await repository.persist(source, at)
  database.close()

  database = new FinanceDB()
  await database.open()
  repository = new FinancialSnapshotRepository(database)
  deepEqual(await repository.getBySnapshotId(source.identity.snapshotId), persisted, 'snapshot survives full close and reopen')

  const table = database.financialSnapshots
  deepEqual(await table.where('snapshotKey').equals(persisted.snapshotKey).toArray(), [persisted], 'snapshotKey index returns record')
  deepEqual(await table.where('[snapshotKey+revision]').equals([persisted.snapshotKey, 1]).toArray(), [persisted], 'compound revision index returns record')
  deepEqual(await table.where('sealedAt').equals(persisted.sealedAt).toArray(), [persisted], 'sealedAt index returns record')
  deepEqual(await table.where('fingerprintValue').equals(persisted.fingerprintValue).toArray(), [persisted], 'fingerprintValue index returns record')

  const duplicateRevision = { ...structuredClone(persisted), snapshotId: `${persisted.snapshotId}:other` as SealedSnapshotId }
  await expectReject(() => table.add(duplicateRevision), 'unique [snapshotKey+revision] index rejects duplicate')

  deepEqual(await repository.persist(source, '2026-02-02T00:00:00.000Z' as UtcInstant), persisted, 'same snapshotId is idempotent')
  assert(await table.count() === 1, 'idempotent persistence does not duplicate')
  assert(!('update' in repository) && !('delete' in repository), 'repository exposes no update/delete API')
  await expectReject(() => table.update(persisted.snapshotId, { persistedAt: '2026-02-03T00:00:00.000Z' as UtcInstant }), 'Dexie updating hook blocks physical mutation')
  await expectReject(() => table.delete(persisted.snapshotId), 'Dexie deleting hook blocks physical deletion')
  assert(await table.count() === 1, 'append-only hooks leave stored record intact')

  const shadowIncome: ServiceIncome = {
    id: 101, date: '2026-03-10', duration: 60, totalAmount: 100,
    currency: 'EUR', percentage: 50, realGain: 50, eurValue: 50,
    copValue: 220000, exchangeRateUsed: 4400, usageMode: 'basic',
  }
  const shadowExpense: Expense = {
    id: 102, type: 'gasto', date: '2026-03-11', category: 'General',
    amount: 20, currency: 'EUR', eurValue: 20, copValue: 88000,
    usageMode: 'basic', createdAt: '2026-03-11T00:00:00.000Z',
  }
  const shadowInput = (income: ServiceIncome) => ({
    consumer: 'home.balance.current-month' as const,
    scope: {
      periodStart: '2026-03-01' as CivilDate,
      periodEndExclusive: '2026-04-01' as CivilDate,
      asOf: at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic' as const,
      currency: 'EUR' as const,
    },
    financialEngineResult: runFinancialEngine({ incomes: [income], expenses: [shadowExpense], currency: 'EUR', usageMode: 'basic' }),
    incomes: [income], expenses: [shadowExpense],
    candidateId: 'browser-shadow' as SnapshotCandidateId,
    generatedAt: at, sealedAt: at, persistedAt: at,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
  })
  const financialBefore = {
    services: await database.services.toArray(),
    expenses: await database.expenses.toArray(),
  }
  const disabledCount = await table.count()
  assert(await runSnapshotShadowMode(shadowInput(shadowIncome), { repository, dev: false }) === undefined, 'snapshot shadow flag is disabled by default')
  assert(await table.count() === disabledCount, 'disabled shadow mode does not persist')
  const firstShadow = await runSnapshotShadowMode(shadowInput(shadowIncome), { enabled: true, repository, dev: false })
  assert(firstShadow?.revision === 1, 'real shadow pipeline persists first revision')
  const shadowKey = firstShadow!.snapshotKey
  database.close()

  database = new FinanceDB()
  await database.open()
  repository = new FinancialSnapshotRepository(database)
  const reopenedDuplicate = await runSnapshotShadowMode(shadowInput(shadowIncome), { enabled: true, repository, dev: false })
  assert(reopenedDuplicate?.idempotent === true && reopenedDuplicate.revision === 1, 'shadow idempotence survives close and reopen')
  const changedIncome = { ...shadowIncome, eurValue: 75 }
  const revisedShadow = await runSnapshotShadowMode(shadowInput(changedIncome), { enabled: true, repository, dev: false })
  assert(revisedShadow?.revision === 2, 'material shadow change creates next revision')
  const shadowRecords = await repository.listBySnapshotKey(shadowKey)
  assert(shadowRecords[1].supersedesSnapshotId === shadowRecords[0].snapshotId, 'real shadow revision supersedes previous snapshot')
  const promotionInput = {
    snapshotKey: shadowKey,
    expectedScope: {
      kind: 'monthly' as const,
      periodStart: '2026-03-01' as CivilDate,
      periodEndExclusive: '2026-04-01' as CivilDate,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic' as const,
      currency: 'EUR' as const,
    },
    officialCurrentResult: shadowInput(changedIncome).financialEngineResult,
    repository,
    dev: false,
  }
  const promoted = await executeSnapshotPromotion({ ...promotionInput, featureEnabled: true })
  assert(promoted.source === 'snapshot', 'valid persisted latest snapshot promotes with explicit flag')
  assert((await executeSnapshotPromotion({ ...promotionInput, featureEnabled: false })).source === 'current', 'disabled promotion flag falls back immediately')
  const corrupted = structuredClone(shadowRecords[1])
  corrupted.fingerprintValue = '0'.repeat(64)
  const corruptedRepository = {
    getLatestBySnapshotKey: async () => corrupted,
    listBySnapshotKey: async () => [shadowRecords[0], corrupted],
  }
  assert((await executeSnapshotPromotion({ ...promotionInput, featureEnabled: true, repository: corruptedRepository })).source === 'current', 'altered fingerprint falls back')
  assert((await executeSnapshotPromotion({
    ...promotionInput, featureEnabled: true,
    expectedScope: { ...promotionInput.expectedScope, timezone: 'UTC' as IanaTimeZone },
  })).source === 'current', 'incompatible scope falls back')
  const staleRepository = {
    getLatestBySnapshotKey: async () => shadowRecords[0],
    listBySnapshotKey: async () => shadowRecords,
  }
  assert((await executeSnapshotPromotion({ ...promotionInput, featureEnabled: true, repository: staleRepository })).source === 'current', 'non-latest revision falls back')
  deepEqual({ services: await database.services.toArray(), expenses: await database.expenses.toArray() }, financialBefore, 'shadow pipeline leaves financial tables unchanged')

  database.close()
  database = new FinanceDB()
  await database.open()
  repository = new FinancialSnapshotRepository(database)
  const reopenedPromotion = await executeSnapshotPromotion({ ...promotionInput, repository, featureEnabled: true })
  assert(reopenedPromotion.source === promoted.source, 'promotion decision survives full close and reopen')
  deepEqual({ services: await database.services.toArray(), expenses: await database.expenses.toArray() }, financialBefore, 'promotion leaves financial tables unchanged')

  const secondA = await sealed(20, 2, source.identity.snapshotId)
  const secondB = await sealed(30, 2, source.identity.snapshotId)
  const concurrent = await Promise.allSettled([repository.persist(secondA, at), repository.persist(secondB, at)])
  assert(concurrent.filter(({ status }) => status === 'fulfilled').length === 1, 'real concurrent transactions allow one revision winner')
  const rejected = concurrent.find(({ status }) => status === 'rejected')
  const conflictCode = rejected?.status === 'rejected'
    ? (rejected.reason as FinancialSnapshotPersistenceError).code
    : undefined
  assert(
    conflictCode === 'SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES' || conflictCode === 'SNAPSHOT_PERSISTENCE_REVISION_CONFLICT',
    'real concurrent loser reports a deterministic revision/supersedes conflict',
  )
  assert((await repository.listBySnapshotKey(source.identity.snapshotKey)).length === 2, 'concurrent conflict stores exactly one next revision')

  database.close()
  database = new FinanceDB()
  await database.open()
  assert(await database.financialSnapshots.count() === 4, 'second full reopen preserves repository and shadow revisions')
  database.close()
  await Dexie.delete(databaseName)
}

try {
  await run()
  result.dataset.status = 'passed'
  result.textContent = JSON.stringify({ runtime: navigator.userAgent, indexedDB: typeof indexedDB, checks })
} catch (error) {
  result.dataset.status = 'failed'
  result.textContent = JSON.stringify({ message: (error as Error).message, stack: (error as Error).stack, checks })
}
