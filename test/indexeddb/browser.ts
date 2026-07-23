import Dexie from 'dexie'

import { FinanceDB } from '../../src/database/db'
import { createAIConversationService } from '../../src/intelligence/ai-conversation/service'
import { FinancialSnapshotRepository } from '../../src/intelligence/financial-snapshot/financialSnapshotRepository'
import { canonicalizeValidatedSnapshotCandidate } from '../../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../../src/intelligence/financial-snapshot/snapshotSealer'
import { buildKnowledgeCollectionFromSnapshot } from '../../src/intelligence/knowledge-layer/knowledgeFactsBuilder'
import { canonicalizeValidatedKnowledgeCollection } from '../../src/intelligence/knowledge-layer/knowledgeCanonicalizer'
import { validateKnowledgeCollection } from '../../src/intelligence/knowledge-layer/knowledgeCollectionValidator'
import { fingerprintCanonicalKnowledgeDocument } from '../../src/intelligence/knowledge-layer/knowledgeFingerprint'
import { KnowledgeSnapshotRepository } from '../../src/intelligence/knowledge-layer/knowledgeSnapshotRepository'
import { deriveKnowledgeSnapshotKey, sealCanonicalKnowledgeDocument } from '../../src/intelligence/knowledge-layer/knowledgeSealer'
import { runSnapshotShadowMode } from '../../src/services/snapshotShadowModeService'
import { runFinancialEngine } from '../../src/services/financialEngineAdapter'
import { executeSnapshotPromotion } from '../../src/services/snapshotPromotionExecutor'
import { executeKnowledgePromotion } from '../../src/services/knowledgePromotionExecutor'
import type { Expense } from '../../src/types/expense'
import type { ServiceIncome } from '../../src/types/service'
import type {
  CanonicalizationVersion, CivilDate, EngineVersion, IanaTimeZone, RulesetVersion,
  SealedSnapshotId, SnapshotCandidateId, SnapshotKey, SnapshotNormativeCode,
  SnapshotVersion, UtcInstant, ValidatedSnapshotCandidate,
} from '../../src/types/financialSnapshot'
import type {
  KnowledgeBuilderVersion,
  KnowledgeProjectionVersion,
  KnowledgeRevisionReasonCode,
  KnowledgeRulesVersion,
  KnowledgeSnapshotId,
  KnowledgeVersion,
} from '../../src/types/knowledgeLayer'
import type { PersistedKnowledgeSnapshot } from '../../src/types/persistedKnowledgeSnapshot'

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
    if (code !== undefined) assert((error as { readonly code?: string }).code === code, message)
    else checks.push(message)
    return
  }
  throw new Error(`Expected rejection: ${message}`)
}

async function sealed(
  balance: number,
  revision = 1,
  supersedesSnapshotId?: SealedSnapshotId,
  canonicalizationVersion: CanonicalizationVersion = 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
  scopeOverrides: Partial<ValidatedSnapshotCandidate<{ readonly balance: number }>['scope']> = {},
) {
  const candidate: ValidatedSnapshotCandidate<{ readonly balance: number }> = {
    status: 'validated',
    identity: { candidateId: `browser-candidate:${balance}` as SnapshotCandidateId },
    scope: {
      kind: 'monthly', periodStart: '2026-01-01' as CivilDate,
      periodEndExclusive: '2026-02-01' as CivilDate, periodBoundary: '[start,end)',
      asOf: at, timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic', currency: 'EUR', filters: {},
      ...scopeOverrides,
    },
    engineResult: { balance },
    evidence: { strategy: 'embedded-v1', records: [], context: [], candidateRecordCount: 0, includedRecordCount: 0, excludedRecordCount: 0, coverageCodes: [], warningCodes: [] },
    appliedRules: [],
    metadata: { generatedAt: at, generationReasonCode: 'test' as SnapshotNormativeCode, provenance: 'local', qualityCodes: [], warningCodes: [], limitationCodes: [] },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion,
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

const KNOWLEDGE_VERSION = 'knowledge/1.0.0' as KnowledgeVersion
const BUILDER_VERSION = 'knowledge-builder/1.0.0' as KnowledgeBuilderVersion
const RULES_VERSION = 'knowledge-rules/1.0.0' as KnowledgeRulesVersion
const PROJECTION_VERSION = 'knowledge-projection/1.0.0' as KnowledgeProjectionVersion
const REVISION_REASON = 'revision.source_changed' as KnowledgeRevisionReasonCode

type BuilderEngineResult = {
  readonly balanceReport: {
    readonly hasData: boolean
    readonly generalBalance: number
    readonly netProfit: number
  }
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

function knowledgeSourceSnapshot(balance: number) {
  return {
    identity: {
      snapshotId:
        'financial-snapshot:financial-snapshot-fingerprint/2.0.0:browser-knowledge-source' as SealedSnapshotId,
      snapshotKey: 'snapshot-key:monthly:browser-knowledge-source' as SnapshotKey,
    },
    revision: {
      revision: 1,
      reasonCode: 'revision.source_changed' as SnapshotNormativeCode,
    },
    status: 'sealed' as const,
    canonicalDocument: {
      payload: {
        engineResult: {
          balanceReport: {
            hasData: true,
            generalBalance: balance,
            netProfit: balance,
          },
          incomeCount: balance > 0 ? 1 : 0,
          expenseCount: 0,
          adjustmentCount: 0,
        } as BuilderEngineResult,
      },
    },
    evidence: {
      records: [{ sourceId: 1 }],
      context: [{ kind: 'settings-context' }],
      coverageCodes: ['coverage.complete'],
      warningCodes: [],
    },
    appliedRules: [{ ruleId: 'balance.report.current' }],
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    engineVersion: '1.0.0-phase-1a-minimal' as EngineVersion,
    rulesetVersion: 'engine-bundled/1.0.0-phase-1a-minimal' as RulesetVersion,
    scope: {
      kind: 'monthly' as const,
      periodStart: '2026-07-01' as CivilDate,
      periodEndExclusive: '2026-08-01' as CivilDate,
      periodBoundary: '[start,end)' as const,
      asOf: at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic' as const,
      currency: 'EUR' as const,
      filters: {},
    },
    fingerprint: {
      value:
        'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
  }
}

function knowledgeBuilderInput(
  snapshot: ReturnType<typeof knowledgeSourceSnapshot>,
): Parameters<typeof buildKnowledgeCollectionFromSnapshot>[0] {
  return {
    snapshot,
    knowledgeVersion: KNOWLEDGE_VERSION,
    builderVersion: BUILDER_VERSION,
    rulesVersion: RULES_VERSION,
    projectionVersion: PROJECTION_VERSION,
  }
}

async function sealedKnowledge(
  balance: number,
  revision = 1,
  supersedesKnowledgeSnapshotId?: KnowledgeSnapshotId,
  identitySuffix?: string,
) {
  const sourceSnapshot = knowledgeSourceSnapshot(balance)
  const draft = buildKnowledgeCollectionFromSnapshot(knowledgeBuilderInput(sourceSnapshot))
  const validated = validateKnowledgeCollection(draft)
  const canonicalDocument = canonicalizeValidatedKnowledgeCollection(validated)
  if (identitySuffix !== undefined) {
    ;(canonicalDocument.payload.identity as { knowledgeCollectionId: string }).knowledgeCollectionId =
      `${canonicalDocument.payload.identity.knowledgeCollectionId}:${identitySuffix}`
  }
  const fingerprint = await fingerprintCanonicalKnowledgeDocument(canonicalDocument)
  const knowledgeSnapshotKey = deriveKnowledgeSnapshotKey(canonicalDocument)
  return sealCanonicalKnowledgeDocument({
    canonicalDocument,
    fingerprint,
    knowledgeSnapshotKey,
    revision,
    revisionReasonCode: REVISION_REASON,
    sealedAt: at,
    ...(supersedesKnowledgeSnapshotId === undefined
      ? {}
      : { supersedesKnowledgeSnapshotId }),
  })
}

async function run() {
  await Dexie.delete(databaseName)

  const legacyV25 = new Dexie(databaseName)
  legacyV25.version(25).stores({
    services:
      '++id,date,currency,country,status,earningPeriodId,seasonPeriodId,reportStatusCode,timerStatus,timerEndsAt',
    settings: 'id',
    conversationMemories: 'sessionId,updatedAt,lastMessageAt,status',
    financialSnapshots:
      'snapshotId,snapshotKey,&[snapshotKey+revision],sealedAt,status,scopeKind,scopePeriodStart,fingerprintValue',
    knowledgeSnapshots:
      'knowledgeSnapshotId,knowledgeSnapshotKey,&[knowledgeSnapshotKey+revision],sealedAt,status,sourceSnapshotId,sourceSnapshotKey,fingerprintValue,knowledgeVersion,projectionVersion',
  })
  await legacyV25.open()
  const v25Service = {
    id: 25,
    date: '2026-01-25',
    amount: 250,
    status: 'PENDIENTE',
  }
  const v25Settings = {
    id: 'app',
    businessName: 'v25 to v26 migration sentinel',
  }
  const v25ConversationMemory = {
    sessionId: 'session:v25:migration:001',
    session: {
      sessionId: 'session:v25:migration:001',
      conversation: {
        conversationId: 'conversation:v25:migration:001',
      },
      messages: [],
      status: 'OPEN',
      metadata: {
        createdAt: at,
        updatedAt: at,
        source: 'APPLICATION',
      },
    },
    createdAt: at,
    updatedAt: at,
    lastMessageAt: null,
    messageCount: 0,
    status: 'OPEN',
    source: 'APPLICATION',
    tags: [],
    localSchemaVersion: 1,
  }
  await legacyV25.table('services').add(v25Service)
  await legacyV25.table('settings').add(v25Settings)
  await legacyV25.table('conversationMemories').add(v25ConversationMemory)
  legacyV25.close()

  let database = new FinanceDB()
  await database.open()
  assert(database.verno === 26, 'physical migration upgrades from v25 to v26')
  assert(database.tables.some((table) => table.name === 'conversationMemories'), 'v26 migration preserves v25 conversationMemories table')
  assert(database.tables.some((table) => table.name === 'knowledgeDocuments'), 'v26 migration creates knowledgeDocuments from v25 base')
  assert(database.tables.some((table) => table.name === 'knowledgeChunks'), 'v26 migration creates knowledgeChunks from v25 base')
  deepEqual(await database.services.get(25), v25Service, 'v25 migration preserves existing service data')
  deepEqual(await database.settings.get('app'), v25Settings, 'v25 migration preserves existing settings data')
  deepEqual(
    await database.conversationMemories.get(v25ConversationMemory.sessionId),
    v25ConversationMemory,
    'v25 migration preserves existing conversation memory data',
  )
  database.close()

  await Dexie.delete(databaseName)

  const legacyV24 = new Dexie(databaseName)
  legacyV24.version(24).stores({
    services:
      '++id,date,currency,country,status,earningPeriodId,seasonPeriodId,reportStatusCode,timerStatus,timerEndsAt',
    expenses:
      '++id,type,date,category,currency,country,relatedIncomeId,createdAt,earningPeriodId,seasonPeriodId,reportStatusCode',
    appointments:
      '++id,dateTime,completed,currency,earningPeriodId,seasonPeriodId,reportStatusCode',
    settings: 'id',
    exchangeRates: '++id,date,[baseCurrency+targetCurrency+date]',
    cutoffReports:
      '++id,frequency,periodStart,periodEnd,[frequency+periodStart+periodEnd]',
    earningPeriods: '++id,status,startDate,endDate,countryCode,city',
    licenses: 'id,deviceCode,status,expirationDate,licenseVersion',
    automationOutbox: 'eventId,event,nextAttemptAt,createdAt',
    communicationChannels: 'id,type,provider,status,updatedAt',
    deviceIdentity: 'id,userCode,deviceCode,platform,updatedAt',
    financialSnapshots:
      'snapshotId,snapshotKey,&[snapshotKey+revision],sealedAt,status,scopeKind,scopePeriodStart,fingerprintValue',
    knowledgeSnapshots:
      'knowledgeSnapshotId,knowledgeSnapshotKey,&[knowledgeSnapshotKey+revision],sealedAt,status,sourceSnapshotId,sourceSnapshotKey,fingerprintValue,knowledgeVersion,projectionVersion',
  })
  await legacyV24.open()
  const v24Service = {
    id: 24,
    date: '2026-01-20',
    amount: 240,
    status: 'PENDIENTE',
  }
  const v24Settings = {
    id: 'app',
    businessName: 'Immediate previous migration sentinel',
  }
  await legacyV24.table('services').add(v24Service)
  await legacyV24.table('settings').add(v24Settings)
  legacyV24.close()

  database = new FinanceDB()
  await database.open()
  assert(database.verno === 26, 'physical migration upgrades from v24 to v26')
  assert(database.tables.some((table) => table.name === 'conversationMemories'), 'v26 migration keeps conversationMemories from v24 base')
  assert(database.tables.some((table) => table.name === 'knowledgeDocuments'), 'v26 migration creates knowledgeDocuments from v24 base')
  assert(database.tables.some((table) => table.name === 'knowledgeChunks'), 'v26 migration creates knowledgeChunks from v24 base')
  deepEqual(await database.services.get(24), v24Service, 'v24 migration preserves existing service data')
  deepEqual(await database.settings.get('app'), v24Settings, 'v24 migration preserves existing settings data')
  database.close()

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

  database = new FinanceDB()
  await database.open()
  assert(database.verno === 26, 'physical migration opens schema v26')
  assert(database.tables.some((table) => table.name === 'financialSnapshots'), 'migration creates financialSnapshots')
  assert(database.tables.some((table) => table.name === 'knowledgeSnapshots'), 'migration creates knowledgeSnapshots')
  assert(database.tables.some((table) => table.name === 'conversationMemories'), 'migration creates conversationMemories')
  assert(database.tables.some((table) => table.name === 'knowledgeDocuments'), 'migration creates knowledgeDocuments')
  assert(database.tables.some((table) => table.name === 'knowledgeChunks'), 'migration creates knowledgeChunks')
  deepEqual(await database.services.get(7), legacyService, 'migration preserves legacy service data')
  deepEqual(await database.settings.get('app'), legacySettings, 'migration preserves legacy settings data')

  const conversationService = createAIConversationService()
  const startedConversation = conversationService.startConversation({
    userDisplayName: 'Usuario',
    assistantDisplayName: 'Private Balance AI',
    createdAt: at,
  })
  if (startedConversation.kind !== 'success') {
    throw new Error('Expected valid conversation fixture for IndexedDB memory test')
  }

  await database.conversationMemories.put({
    sessionId: startedConversation.value.sessionId,
    session: structuredClone(startedConversation.value),
    createdAt: startedConversation.value.metadata.createdAt,
    updatedAt: startedConversation.value.metadata.updatedAt ?? startedConversation.value.metadata.createdAt,
    lastMessageAt: null,
    messageCount: startedConversation.value.messages.length,
    status: startedConversation.value.status,
    source: startedConversation.value.metadata.source,
    tags: [...(startedConversation.value.metadata.tags ?? [])],
    localSchemaVersion: 1,
  })

  const persistedConversationMemory = await database.conversationMemories.get(startedConversation.value.sessionId)
  assert(persistedConversationMemory !== undefined, 'conversation memory persists in Dexie table')

  let repository = new FinancialSnapshotRepository(database)
  const source = await sealed(10)
  const persisted = await repository.persist(source, at)
  database.close()

  database = new FinanceDB()
  await database.open()
  repository = new FinancialSnapshotRepository(database)
  deepEqual(await repository.getBySnapshotId(source.identity.snapshotId), persisted, 'snapshot survives full close and reopen')
  deepEqual(
    await database.conversationMemories.get(startedConversation.value.sessionId),
    persistedConversationMemory,
    'conversation memory survives full close and reopen',
  )

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

  let knowledgeRepository = new KnowledgeSnapshotRepository(database)
  let knowledgeTable = database.knowledgeSnapshots
  const knowledgeV1 = await sealedKnowledge(10)
  const knowledgePersistedV1 = await knowledgeRepository.persist(knowledgeV1, at)
  deepEqual(
    await knowledgeRepository.getByKnowledgeSnapshotId(knowledgeV1.knowledgeSnapshotId),
    knowledgePersistedV1.record,
    'knowledge snapshot survives first persistence',
  )
  deepEqual(
    await knowledgeTable
      .where('[knowledgeSnapshotKey+revision]')
      .equals([knowledgePersistedV1.record.knowledgeSnapshotKey, 1])
      .toArray(),
    [knowledgePersistedV1.record],
    'knowledge compound revision index returns record',
  )
  deepEqual(
    await knowledgeRepository.persist(knowledgeV1, '2026-02-02T00:00:00.000Z' as UtcInstant),
    {
      record: knowledgePersistedV1.record,
      idempotent: true,
      revision: 1,
    },
    'knowledge persistence is idempotent by knowledgeSnapshotId',
  )
  assert(await knowledgeTable.count() === 1, 'knowledge idempotence does not duplicate records')

  const knowledgeV2 = await sealedKnowledge(
    10,
    2,
    knowledgeV1.knowledgeSnapshotId,
    'rev2',
  )
  const knowledgePersistedV2 = await knowledgeRepository.persist(knowledgeV2, at)
  assert(knowledgePersistedV2.revision === 2, 'knowledge second material revision is assigned in transaction')
  assert(
    knowledgePersistedV2.record.supersedesKnowledgeSnapshotId === knowledgePersistedV1.record.knowledgeSnapshotId,
    'knowledge supersedes chain links to immediate previous revision',
  )

  const duplicateKnowledgeRevision = {
    ...structuredClone(knowledgePersistedV2.record),
    knowledgeSnapshotId: `${knowledgePersistedV2.record.knowledgeSnapshotId}:other` as KnowledgeSnapshotId,
  }
  await expectReject(
    () => knowledgeTable.add(duplicateKnowledgeRevision),
    'knowledge unique [knowledgeSnapshotKey+revision] index rejects duplicate',
  )
  await expectReject(
    () => knowledgeTable.update(knowledgePersistedV1.record.knowledgeSnapshotId, { persistedAt: '2026-02-03T00:00:00.000Z' as UtcInstant }),
    'knowledge updating hook blocks physical mutation',
  )
  await expectReject(
    () => knowledgeTable.delete(knowledgePersistedV1.record.knowledgeSnapshotId),
    'knowledge deleting hook blocks physical deletion',
  )

  const knowledgeConcurrentA = await sealedKnowledge(
    10,
    3,
    knowledgePersistedV2.record.knowledgeSnapshotId,
    'concurrent-a',
  )
  const knowledgeConcurrentB = await sealedKnowledge(
    10,
    3,
    knowledgePersistedV2.record.knowledgeSnapshotId,
    'concurrent-b',
  )
  const knowledgeConcurrent = await Promise.allSettled([
    knowledgeRepository.persist(knowledgeConcurrentA, at),
    knowledgeRepository.persist(knowledgeConcurrentB, at),
  ])
  assert(
    knowledgeConcurrent.filter(({ status }) => status === 'fulfilled').length === 1,
    'knowledge concurrent transactions allow one revision winner',
  )
  assert(
    knowledgeConcurrent.filter(({ status }) => status === 'rejected').length === 1,
    'knowledge concurrent loser rejects deterministically',
  )

  const knowledgeBeforeReopen = await knowledgeRepository.listByKnowledgeSnapshotKey(
    knowledgePersistedV1.record.knowledgeSnapshotKey,
  )
  assert(knowledgeBeforeReopen.length === 3, 'knowledge retention keeps all revisions before reopen')

  const coexistenceV1 = await sealed(
    30,
    1,
    undefined,
    'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    { periodStart: '2026-05-01' as CivilDate, periodEndExclusive: '2026-06-01' as CivilDate },
  )
  await repository.persist(coexistenceV1, at)
  const coexistenceV2 = await sealed(
    30,
    2,
    coexistenceV1.identity.snapshotId,
    'financial-snapshot-c14n/2.0.0' as CanonicalizationVersion,
    { periodStart: '2026-05-01' as CivilDate, periodEndExclusive: '2026-06-01' as CivilDate },
  )
  await repository.persist(coexistenceV2, at)
  const coexistenceRecords = await repository.listBySnapshotKey(coexistenceV1.identity.snapshotKey)
  assert(coexistenceRecords.length === 2, 'indexeddb preserves V1 and V2 coexistence in one append-only chain')
  assert(coexistenceRecords[0].canonicalizationVersion === 'financial-snapshot-c14n/1.0.0', 'indexeddb keeps legacy V1 snapshot readable')
  assert(coexistenceRecords[1].canonicalizationVersion === 'financial-snapshot-c14n/2.0.0', 'indexeddb persists V2 beside V1 without rewrite')

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
  const shadowInput = (
    income: ServiceIncome,
    overrides: Partial<{
      readonly candidateId: SnapshotCandidateId
      readonly generatedAt: UtcInstant
      readonly sealedAt: UtcInstant
      readonly persistedAt: UtcInstant
      readonly asOf: UtcInstant
    }> = {},
  ) => ({
    consumer: 'home.balance.current-month' as const,
    scope: {
      periodStart: '2026-03-01' as CivilDate,
      periodEndExclusive: '2026-04-01' as CivilDate,
      asOf: overrides.asOf ?? at,
      timezone: 'Europe/Madrid' as IanaTimeZone,
      usageMode: 'basic' as const,
      currency: 'EUR' as const,
    },
    financialEngineResult: runFinancialEngine({ incomes: [income], expenses: [shadowExpense], currency: 'EUR', usageMode: 'basic' }),
    incomes: [income], expenses: [shadowExpense],
    candidateId: overrides.candidateId ?? 'browser-shadow' as SnapshotCandidateId,
    generatedAt: overrides.generatedAt ?? at,
    sealedAt: overrides.sealedAt ?? at,
    persistedAt: overrides.persistedAt ?? at,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
  })
  const financialBefore = {
    services: await database.services.toArray(),
    expenses: await database.expenses.toArray(),
  }
  const knowledgeShadowBaselineCount = await knowledgeTable.count()
  const disabledCount = await table.count()
  await runSnapshotShadowMode(shadowInput(shadowIncome), { enabled: false, repository, dev: false })
  assert(await table.count() === disabledCount, 'disabled shadow mode does not persist')
  await runSnapshotShadowMode(shadowInput(shadowIncome, {
    candidateId: 'browser-shadow:knowledge-disabled' as SnapshotCandidateId,
  }), {
    enabled: true,
    repository,
    dev: false,
  })
  assert(await knowledgeTable.count() === knowledgeShadowBaselineCount, 'knowledge shadow is disabled by default and does not persist')
  const firstShadow = await runSnapshotShadowMode(shadowInput(shadowIncome), { enabled: true, repository, dev: false })
  assert(firstShadow?.revision === 1, 'real shadow pipeline persists first revision')
  const shadowKey = firstShadow!.snapshotKey
  const firstShadowPersisted = await repository.getLatestBySnapshotKey(shadowKey)
  await runSnapshotShadowMode(shadowInput(shadowIncome, {
    candidateId: 'browser-shadow:knowledge-first' as SnapshotCandidateId,
    generatedAt: '2026-02-01T00:00:10.000Z' as UtcInstant,
    sealedAt: '2026-02-01T00:00:11.000Z' as UtcInstant,
    persistedAt: '2026-02-01T00:00:12.000Z' as UtcInstant,
    asOf: '2026-02-01T00:00:13.000Z' as UtcInstant,
  }), {
    enabled: true,
    repository,
    dev: false,
    knowledgeShadow: {
      enabled: true,
      repository: database,
    },
  })
  assert(await knowledgeTable.count() === knowledgeShadowBaselineCount + 1, 'knowledge shadow persists a first material snapshot through snapshot integration')
  const knowledgeShadowRecordsBeforeReopen = await knowledgeTable.toArray()
  const knowledgeShadowFirstRecord = knowledgeShadowRecordsBeforeReopen.find(
    (record) => record.sourceSnapshotId === firstShadowPersisted.snapshotId,
  )!
  assert(knowledgeShadowFirstRecord.revision === 1, 'knowledge shadow stores first revision = 1 in indexeddb')
  database.close()

  database = new FinanceDB()
  await database.open()
  repository = new FinancialSnapshotRepository(database)
  knowledgeTable = database.knowledgeSnapshots
  const equivalentRuns = [
    shadowInput(shadowIncome, {
      candidateId: 'browser-shadow:2' as SnapshotCandidateId,
      generatedAt: '2026-02-01T00:00:01.000Z' as UtcInstant,
      sealedAt: '2026-02-01T00:00:02.000Z' as UtcInstant,
      persistedAt: '2026-02-01T00:00:03.000Z' as UtcInstant,
      asOf: '2026-02-01T00:00:04.000Z' as UtcInstant,
    }),
    shadowInput(shadowIncome, {
      candidateId: 'browser-shadow:3' as SnapshotCandidateId,
      generatedAt: '2026-02-01T01:00:00.000Z' as UtcInstant,
      sealedAt: '2026-02-01T01:00:01.000Z' as UtcInstant,
      persistedAt: '2026-02-01T01:00:02.000Z' as UtcInstant,
      asOf: '2026-02-01T01:00:03.000Z' as UtcInstant,
    }),
    shadowInput(shadowIncome, {
      candidateId: 'browser-shadow:4' as SnapshotCandidateId,
      generatedAt: '2026-02-02T00:00:00.000Z' as UtcInstant,
      sealedAt: '2026-02-02T00:00:01.000Z' as UtcInstant,
      persistedAt: '2026-02-02T00:00:02.000Z' as UtcInstant,
      asOf: '2026-02-02T00:00:03.000Z' as UtcInstant,
    }),
    shadowInput(shadowIncome, {
      candidateId: 'browser-shadow:5' as SnapshotCandidateId,
      generatedAt: '2026-02-03T09:30:00.000Z' as UtcInstant,
      sealedAt: '2026-02-03T09:30:01.000Z' as UtcInstant,
      persistedAt: '2026-02-03T09:30:02.000Z' as UtcInstant,
      asOf: '2026-02-03T09:30:03.000Z' as UtcInstant,
    }),
  ]
  for (const input of equivalentRuns) {
    const duplicate = await runSnapshotShadowMode(input, {
      enabled: true,
      repository,
      dev: false,
      knowledgeShadow: {
        enabled: true,
        repository: database,
      },
    })
    assert(duplicate?.idempotent === true && duplicate.revision === 1, 'shadow idempotence survives varying generatedAt/sealedAt/persistedAt/asOf')
  }
  const stableShadowRecords = await repository.listBySnapshotKey(shadowKey)
  assert(stableShadowRecords.length === 1, 'five equivalent shadow executions keep a single revision in indexeddb')
  assert(stableShadowRecords[0].canonicalizationVersion === 'financial-snapshot-c14n/2.0.0', 'shadow mode persists V2 canonicalization in indexeddb')
  assert(stableShadowRecords[0].fingerprint.fingerprintVersion === 'financial-snapshot-fingerprint/2.0.0', 'shadow mode persists V2 fingerprint version in indexeddb')
  const stableKnowledgeRecords = await knowledgeTable.toArray()
  const stableKnowledgeChain = stableKnowledgeRecords.filter(
    (record) => record.knowledgeSnapshotKey === knowledgeShadowFirstRecord.knowledgeSnapshotKey,
  )
  assert(stableKnowledgeChain.length === 1, 'five equivalent knowledge shadow executions keep a single material knowledge snapshot')
  assert(stableKnowledgeChain[0].fingerprintValue === knowledgeShadowFirstRecord.fingerprintValue, 'equivalent knowledge shadow executions keep the same fingerprint')
  assert(stableKnowledgeChain[0].knowledgeSnapshotId === knowledgeShadowFirstRecord.knowledgeSnapshotId, 'equivalent knowledge shadow executions keep the same knowledgeSnapshotId')
  const changedIncome = { ...shadowIncome, eurValue: 75 }
  const revisedShadow = await runSnapshotShadowMode(shadowInput(changedIncome), {
    enabled: true,
    repository,
    dev: false,
    knowledgeShadow: {
      enabled: true,
      repository: database,
    },
  })
  assert(revisedShadow?.revision === 2, 'material shadow change creates next revision')
  const shadowRecords = await repository.listBySnapshotKey(shadowKey)
  assert(shadowRecords.length === 2, 'material shadow change creates exactly one new indexeddb revision')
  assert(shadowRecords[0].fingerprintValue !== shadowRecords[1].fingerprintValue, 'material shadow change updates fingerprint in indexeddb')
  assert(shadowRecords[0].snapshotId !== shadowRecords[1].snapshotId, 'material shadow change updates snapshotId in indexeddb')
  assert(shadowRecords[1].supersedesSnapshotId === shadowRecords[0].snapshotId, 'real shadow revision supersedes previous snapshot')
  const knowledgeAfterMaterialChange = await knowledgeTable.toArray()
  assert(knowledgeAfterMaterialChange.length === knowledgeShadowBaselineCount + 2, 'material financial change creates one additional knowledge snapshot in indexeddb')
  const latestKnowledgeRecord = knowledgeAfterMaterialChange.find(
    (record) => record.sourceSnapshotId === shadowRecords[1].snapshotId,
  )!
  assert(latestKnowledgeRecord.knowledgeSnapshotId !== knowledgeShadowFirstRecord.knowledgeSnapshotId, 'material financial change updates knowledgeSnapshotId')
  assert(latestKnowledgeRecord.fingerprintValue !== knowledgeShadowFirstRecord.fingerprintValue, 'material financial change updates knowledge fingerprint')
  assert(latestKnowledgeRecord.sourceSnapshotId === shadowRecords[1].snapshotId, 'material financial change links knowledge to the latest financial snapshot source')
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
  ;(corrupted as { fingerprintValue: string }).fingerprintValue = '0'.repeat(64)
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
  knowledgeRepository = new KnowledgeSnapshotRepository(database)
  knowledgeTable = database.knowledgeSnapshots
  const reopenedPromotion = await executeSnapshotPromotion({ ...promotionInput, repository, featureEnabled: true })
  assert(reopenedPromotion.source === promoted.source, 'promotion decision survives full close and reopen')
  deepEqual({ services: await database.services.toArray(), expenses: await database.expenses.toArray() }, financialBefore, 'promotion leaves financial tables unchanged')
  assert(
    (await knowledgeRepository.listByKnowledgeSnapshotKey(knowledgePersistedV1.record.knowledgeSnapshotKey)).length === 3,
    'knowledge revisions survive full close and reopen',
  )
  await runSnapshotShadowMode(shadowInput(changedIncome, {
    candidateId: 'browser-shadow:knowledge-reopen' as SnapshotCandidateId,
    generatedAt: '2026-02-03T12:00:00.000Z' as UtcInstant,
    sealedAt: '2026-02-03T12:00:01.000Z' as UtcInstant,
    persistedAt: '2026-02-03T12:00:02.000Z' as UtcInstant,
    asOf: '2026-02-03T12:00:03.000Z' as UtcInstant,
  }), {
    enabled: true,
    repository,
    dev: false,
    knowledgeShadow: {
      enabled: true,
      repository: database,
    },
  })
  assert(await database.knowledgeSnapshots.count() === knowledgeShadowBaselineCount + 2, 'knowledge shadow remains idempotent after full close and reopen')

  const knowledgePromotionVersions = {
    knowledgeVersion: knowledgePersistedV1.record.knowledgeVersion,
    builderVersion: knowledgePersistedV1.record.builderVersion,
    rulesVersion: knowledgePersistedV1.record.rulesVersion,
    projectionVersion: knowledgePersistedV1.record.projectionVersion,
    canonicalizationVersion: knowledgePersistedV1.record.canonicalizationVersion,
  }
  const knowledgePromotionInput = {
    knowledgeSnapshotKey: knowledgePersistedV1.record.knowledgeSnapshotKey,
    expectedScope: knowledgePersistedV1.record.canonicalDocument.payload.facts[0].scope,
    supportedVersions: knowledgePromotionVersions,
    featureEnabled: true,
    repository: knowledgeRepository,
    sourceSnapshotId: knowledgePersistedV1.record.sourceSnapshotId,
    consumer: 'browser.knowledge.current-month',
    diagnosticScope: 'indexeddb-real',
  }
  const promotionDisabled = await executeKnowledgePromotion({ ...knowledgePromotionInput, featureEnabled: false })
  assert(promotionDisabled.source === 'none' && promotionDisabled.fallbackReason === 'feature_disabled', 'promotion flag off returns none')
  const promotionEnabled = await executeKnowledgePromotion(knowledgePromotionInput)
  const latestKnownKnowledge = await knowledgeRepository.getLatestByKnowledgeSnapshotKey(
    knowledgePersistedV1.record.knowledgeSnapshotKey,
  )
  assert(promotionEnabled.source === 'knowledge', 'promotion flag on resolves knowledge')
  assert(promotionEnabled.revision === latestKnownKnowledge.revision, 'promotion flag on keeps latest known revision')
  const promotionReopen = await executeKnowledgePromotion(knowledgePromotionInput)
  assert(promotionReopen.source === promotionEnabled.source, 'promotion decision stays stable after reopen')

  const corruptedFingerprintRecord: PersistedKnowledgeSnapshot = {
    ...structuredClone(knowledgePersistedV1.record),
    fingerprintValue: '0'.repeat(64),
    fingerprint: {
      ...knowledgePersistedV1.record.fingerprint,
      value: '0'.repeat(64),
    },
  }
  const corruptedFingerprintRepo = {
    getLatestByKnowledgeSnapshotKey: async () => corruptedFingerprintRecord,
    listByKnowledgeSnapshotKey: async () => [corruptedFingerprintRecord],
  }
  const corruptedFingerprintDecision = await executeKnowledgePromotion({ ...knowledgePromotionInput, repository: corruptedFingerprintRepo })
  assert(corruptedFingerprintDecision.source === 'none' && corruptedFingerprintDecision.fallbackReason === 'fingerprint_mismatch', 'altered fingerprint falls back')

  const invalidChainRecord: PersistedKnowledgeSnapshot = {
    ...structuredClone(knowledgePersistedV1.record),
    revision: 2,
  }
  const invalidChainRepo = {
    getLatestByKnowledgeSnapshotKey: async () => invalidChainRecord,
    listByKnowledgeSnapshotKey: async () => [invalidChainRecord],
  }
  const invalidChainDecision = await executeKnowledgePromotion({ ...knowledgePromotionInput, repository: invalidChainRepo })
  assert(invalidChainDecision.source === 'none' && invalidChainDecision.fallbackReason === 'invalid_chain', 'invalid supersedes chain falls back')

  const notLatestRepo = {
    getLatestByKnowledgeSnapshotKey: async () => knowledgePersistedV1.record,
    listByKnowledgeSnapshotKey: async () => [knowledgePersistedV1.record, knowledgePersistedV2.record],
  }
  const notLatestDecision = await executeKnowledgePromotion({ ...knowledgePromotionInput, repository: notLatestRepo })
  assert(notLatestDecision.source === 'none' && notLatestDecision.fallbackReason === 'not_latest', 'stale latest record falls back')

  const incompatibleKeyRepo = {
    getLatestByKnowledgeSnapshotKey: async () => ({ ...knowledgePersistedV1.record, knowledgeSnapshotKey: 'knowledge-snapshot-key:v1:broken' as never }),
    listByKnowledgeSnapshotKey: async () => [{ ...knowledgePersistedV1.record, knowledgeSnapshotKey: 'knowledge-snapshot-key:v1:broken' as never }],
  }
  const incompatibleKeyDecision = await executeKnowledgePromotion({ ...knowledgePromotionInput, repository: incompatibleKeyRepo })
  assert(incompatibleKeyDecision.source === 'none' && incompatibleKeyDecision.fallbackReason === 'invalid_chain', 'incompatible knowledge key falls back')

  const incompatibleSourceRepo = {
    getLatestByKnowledgeSnapshotKey: async () => ({ ...knowledgePersistedV1.record, sourceSnapshotId: 'financial-snapshot:broken' as never }),
    listByKnowledgeSnapshotKey: async () => [{ ...knowledgePersistedV1.record, sourceSnapshotId: 'financial-snapshot:broken' as never }],
  }
  const incompatibleSourceDecision = await executeKnowledgePromotion({ ...knowledgePromotionInput, repository: incompatibleSourceRepo })
  assert(incompatibleSourceDecision.source === 'none' && incompatibleSourceDecision.fallbackReason === 'source_mismatch', 'incompatible source snapshot falls back')

  const policyNegativeRecord: PersistedKnowledgeSnapshot = {
    ...structuredClone(knowledgePersistedV1.record),
    canonicalDocument: {
      ...knowledgePersistedV1.record.canonicalDocument,
      payload: {
        ...knowledgePersistedV1.record.canonicalDocument.payload,
        facts: [],
        evidenceReferences: [],
      },
    },
  }
  const policyNegativeRepo = {
    getLatestByKnowledgeSnapshotKey: async () => policyNegativeRecord,
    listByKnowledgeSnapshotKey: async () => [policyNegativeRecord],
  }
  const policyNegativeDecision = await executeKnowledgePromotion({ ...knowledgePromotionInput, repository: policyNegativeRepo })
  assert(policyNegativeDecision.source === 'none' && policyNegativeDecision.fallbackReason === 'invalid_contract', 'policy-negative snapshot falls back')

  const beforeFinancial = {
    services: await database.services.toArray(),
    expenses: await database.expenses.toArray(),
  }
  const afterFinancial = {
    services: await database.services.toArray(),
    expenses: await database.expenses.toArray(),
  }
  deepEqual(afterFinancial, beforeFinancial, 'promotion executor does not modify financial tables')

  const promotionRollback = await executeKnowledgePromotion({ ...knowledgePromotionInput, featureEnabled: false })
  assert(promotionRollback.source === 'none' && promotionRollback.fallbackReason === 'feature_disabled', 'disabling flag restores none')

  const knowledgeFailureFinancialCountBefore = await database.financialSnapshots.count()
  const knowledgeFailureInput = shadowInput({ ...changedIncome, eurValue: 90 }, {
    candidateId: 'browser-shadow:knowledge-failure' as SnapshotCandidateId,
    generatedAt: '2026-02-04T00:00:00.000Z' as UtcInstant,
    sealedAt: '2026-02-04T00:00:01.000Z' as UtcInstant,
    persistedAt: '2026-02-04T00:00:02.000Z' as UtcInstant,
    asOf: '2026-02-04T00:00:03.000Z' as UtcInstant,
  })
  const financialWithKnowledgeFailure = await runSnapshotShadowMode(knowledgeFailureInput, {
    enabled: true,
    repository,
    dev: false,
    knowledgeShadow: {
      enabled: true,
      repository: database,
      runner: async () => {
        throw new Error('knowledge shadow failed')
      },
    },
  })
  assert(financialWithKnowledgeFailure?.revision === 3, 'knowledge failure does not block financial snapshot shadow mode')
  assert(await database.financialSnapshots.count() === knowledgeFailureFinancialCountBefore + 1, 'knowledge failure still allows a new financial snapshot revision when material data changes')
  assert(await database.knowledgeSnapshots.count() === knowledgeShadowBaselineCount + 2, 'knowledge failure does not persist partial knowledge artifacts')

  const secondA = await sealed(20, 2, source.identity.snapshotId)
  const secondB = await sealed(30, 2, source.identity.snapshotId)
  const concurrent = await Promise.allSettled([repository.persist(secondA, at), repository.persist(secondB, at)])
  assert(concurrent.filter(({ status }) => status === 'fulfilled').length === 1, 'real concurrent transactions allow one revision winner')
  const rejected = concurrent.find(({ status }) => status === 'rejected')
  const conflictCode = rejected?.status === 'rejected'
    ? (rejected.reason as { readonly code?: string }).code
    : undefined
  assert(
    conflictCode === 'SNAPSHOT_PERSISTENCE_INVALID_SUPERSEDES' || conflictCode === 'SNAPSHOT_PERSISTENCE_REVISION_CONFLICT',
    'real concurrent loser reports a deterministic revision/supersedes conflict',
  )
  assert((await repository.listBySnapshotKey(source.identity.snapshotKey)).length === 2, 'concurrent conflict stores exactly one next revision')

  database.close()
  database = new FinanceDB()
  await database.open()
  assert(await database.financialSnapshots.count() === 7, 'second full reopen preserves repository, coexistence and shadow revisions')
  assert(await database.knowledgeSnapshots.count() === 5, 'second full reopen preserves knowledge append-only history including shadow observations')
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
