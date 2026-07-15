import { afterEach, describe, expect, it, vi } from 'vitest'

import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../src/intelligence/financial-snapshot/snapshotSealer'
import { runFinancialEngine, type FinancialEngineResult } from '../src/services/financialEngineAdapter'
import {
  executeReportsSnapshotPromotion,
  isFinancialSnapshotReportsEnabled,
  type ReportsSnapshotPromotionExpectedScope,
  type ReportsSnapshotPromotionRepositoryPort,
} from '../src/services/reportsSnapshotPromotionExecutor'
import type { PersistedFinancialSnapshot } from '../src/types/persistedFinancialSnapshot'
import type {
  CanonicalizationVersion,
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  RulesetVersion,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  SnapshotVersion,
  UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'

const at = '2026-07-15T10:00:00.000Z' as UtcInstant
const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = `engine-bundled/${engineVersion}` as RulesetVersion

const expectedScope: ReportsSnapshotPromotionExpectedScope = {
  kind: 'monthly',
  periodStart: '2026-07-01' as CivilDate,
  periodEndExclusive: '2026-08-01' as CivilDate,
  timezone: 'Europe/Madrid' as IanaTimeZone,
  usageMode: 'basic',
  currency: 'EUR',
}

function engine(balance = 10): FinancialEngineResult {
  const result = runFinancialEngine({
    incomes: [],
    expenses: [],
    currency: 'EUR',
    usageMode: 'basic',
  })
  return {
    ...result,
    balanceReport: {
      ...result.balanceReport,
      generalBalance: balance,
    },
  }
}

async function record(options: {
  rules?: boolean
  scope?: Partial<ValidatedSnapshotCandidate['scope']>
  canonicalizationVersion?: CanonicalizationVersion
} = {}) {
  const rules = options.rules === false
    ? []
    : [{
        ruleId: 'balance.report.current',
        order: 0,
        engineVersion,
        rulesetVersion,
        explanationCode: 'rule.balance.report.current' as SnapshotNormativeCode,
        affectedFields: [],
        limitationCodes: ['rule.version.unavailable' as SnapshotNormativeCode],
        warningCodes: [],
      }]

  const candidate: ValidatedSnapshotCandidate<FinancialEngineResult> = {
    status: 'validated',
    identity: { candidateId: 'reports-executor-test' as SnapshotCandidateId },
    scope: {
      ...expectedScope,
      periodBoundary: '[start,end)',
      asOf: at,
      filters: {},
      ...options.scope,
    },
    engineResult: engine(99),
    evidence: {
      strategy: 'embedded-v1',
      records: [],
      context: [
        {
          kind: 'settings-context',
          usageMode: 'basic',
          currency: 'EUR',
          timezone: 'Europe/Madrid' as IanaTimeZone,
        },
      ],
      candidateRecordCount: 0,
      includedRecordCount: 0,
      excludedRecordCount: 0,
      coverageCodes: ['coverage.empty_dataset' as SnapshotNormativeCode],
      warningCodes: [],
    },
    appliedRules: rules,
    metadata: {
      generatedAt: at,
      generationReasonCode: 'generation.shadow_evaluation' as SnapshotNormativeCode,
      provenance: 'local',
      qualityCodes: ['quality.validated_structure' as SnapshotNormativeCode],
      warningCodes: [],
      limitationCodes: ['rule.version.unavailable' as SnapshotNormativeCode],
    },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion:
      options.canonicalizationVersion ??
      ('financial-snapshot-c14n/2.0.0' as CanonicalizationVersion),
    engineVersion,
    rulesetVersion,
  }

  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)
  const fingerprint = await fingerprintCanonicalSnapshotDocument(canonicalDocument)
  const sealed = await sealCanonicalSnapshot({
    canonicalDocument,
    fingerprint,
    snapshotKey: deriveSnapshotKey(canonicalDocument),
    revision: 1,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
    sealedAt: at,
  })

  return {
    snapshotId: sealed.identity.snapshotId,
    snapshotKey: sealed.identity.snapshotKey,
    revision: 1,
    revisionReasonCode: sealed.revision.reasonCode,
    status: 'persisted',
    canonicalDocument,
    fingerprint,
    sealedAt: at,
    persistedAt: at,
    localSchemaVersion: 1,
    snapshotVersion: sealed.snapshotVersion,
    canonicalizationVersion: sealed.canonicalizationVersion,
    engineVersion,
    rulesetVersion,
    scopeKind: sealed.scope.kind,
    scopePeriodStart: sealed.scope.periodStart,
    fingerprintValue: fingerprint.value,
  } satisfies PersistedFinancialSnapshot<FinancialEngineResult>
}

function repository(item: PersistedFinancialSnapshot): ReportsSnapshotPromotionRepositoryPort {
  return {
    getLatestBySnapshotKey: vi.fn(async () => structuredClone(item)),
    listBySnapshotKey: vi.fn(async () => [structuredClone(item)]),
  }
}

async function execute(
  item: PersistedFinancialSnapshot,
  overrides: Record<string, unknown> = {},
) {
  return executeReportsSnapshotPromotion({
    snapshotKey: item.snapshotKey,
    expectedScope,
    officialCurrentResult: engine(10),
    featureEnabled: true,
    repository: repository(item),
    dev: false,
    ...overrides,
  })
}

describe('ReportsSnapshotPromotionExecutor', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    [undefined, false],
    ['false', false],
    ['true', true],
    ['TRUE', false],
    ['1', false],
    ['yes', false],
    ['invalid', false],
  ])('enables only exact true for %j', (value, enabled) => {
    vi.stubEnv('VITE_FINANCIAL_SNAPSHOT_REPORTS_ENABLED', value)
    expect(isFinancialSnapshotReportsEnabled()).toBe(enabled)
  })

  it('falls back when feature flag is disabled', async () => {
    const current = engine(10)
    const repo = { getLatestBySnapshotKey: vi.fn(), listBySnapshotKey: vi.fn() }
    const decision = await executeReportsSnapshotPromotion({
      snapshotKey: 'unused' as never,
      expectedScope,
      officialCurrentResult: current,
      featureEnabled: false,
      repository: repo as never,
      dev: false,
    })

    expect(decision).toMatchObject({
      source: 'current',
      result: current,
      fallbackReason: 'feature_disabled',
    })
    expect(repo.getLatestBySnapshotKey).not.toHaveBeenCalled()
  })

  it('promotes a valid monthly snapshot for reports', async () => {
    const item = await record()
    const decision = await execute(item)
    expect(decision.source).toBe('snapshot')
    expect(decision.result.balanceReport.generalBalance).toBe(99)
    expect(decision.assessment?.eligible).toBe(true)
  })

  it('falls back when snapshot does not exist', async () => {
    const base = await record()
    const repo = {
      getLatestBySnapshotKey: vi.fn(async () => {
        throw { code: 'SNAPSHOT_PERSISTENCE_NOT_FOUND' }
      }),
      listBySnapshotKey: vi.fn(async () => []),
    }
    const decision = await execute(base, { repository: repo })
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'snapshot_not_found',
    })
  })

  it('falls back when fingerprint is altered', async () => {
    const item = await record()
    const broken = {
      ...structuredClone(item),
      fingerprintValue: '0'.repeat(64),
    }
    const decision = await execute(broken)
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'integrity_mismatch',
    })
  })

  it('falls back when promotion policy is negative', async () => {
    const item = await record({ rules: false })
    const decision = await execute(item)
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'snapshot_not_eligible',
    })
    expect(decision.assessment?.eligible).toBe(false)
  })

  it('falls back for incompatible scope', async () => {
    const item = await record()
    const decision = await execute(item, {
      expectedScope: {
        ...expectedScope,
        currency: 'USD',
      },
    })
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'scope_mismatch',
    })
  })

  it('falls back for incompatible canonicalization version', async () => {
    const item = await record({
      canonicalizationVersion:
        'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    })
    const decision = await execute(item)
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'snapshot_not_eligible',
    })
  })

  it('falls back when snapshot result payload is corrupt', async () => {
    const item = await record()
    const corrupted = structuredClone(item)
    corrupted.canonicalDocument = {
      ...corrupted.canonicalDocument,
      payload: {
        ...corrupted.canonicalDocument.payload,
        engineResult: {
          ...engine(99),
          balanceReport: {
            ...engine(99).balanceReport,
            generalBalance: 'not-a-number',
          },
        },
      },
    }
    const recalculated = await fingerprintCanonicalSnapshotDocument(
      corrupted.canonicalDocument,
    )
    corrupted.fingerprint = recalculated
    corrupted.fingerprintValue = recalculated.value
    corrupted.snapshotId =
      `financial-snapshot:${recalculated.fingerprintVersion}:${recalculated.value}`
    const decision = await execute(corrupted as PersistedFinancialSnapshot)
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'result_contract_invalid',
    })
  })

  it('falls back for incompatible engine/ruleset version', async () => {
    const item = await record()
    const incompatible = {
      ...structuredClone(item),
      engineVersion: '1.0.0-legacy' as EngineVersion,
      rulesetVersion: 'engine-bundled/1.0.0-legacy' as RulesetVersion,
    }
    const decision = await execute(incompatible)
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'version_incompatible',
    })
  })

  it('keeps financial output unchanged on fallback paths', async () => {
    const item = await record({ rules: false })
    const current = engine(777)
    const decision = await executeReportsSnapshotPromotion({
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: current,
      featureEnabled: true,
      repository: repository(item),
      dev: false,
    })

    expect(decision.source).toBe('current')
    expect(decision.result).toEqual(current)
    expect(decision.result.balanceReport.generalBalance).toBe(777)
  })

  it('does not mutate repository snapshots (read-only executor)', async () => {
    const item = await record()
    const frozenLatest = structuredClone(item)
    const frozenHistory = [structuredClone(item)]
    const beforeLatest = structuredClone(frozenLatest)
    const beforeHistory = structuredClone(frozenHistory)
    const repo = {
      getLatestBySnapshotKey: vi.fn(async () => frozenLatest),
      listBySnapshotKey: vi.fn(async () => frozenHistory),
    }

    await executeReportsSnapshotPromotion({
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: engine(10),
      featureEnabled: true,
      repository: repo,
      dev: false,
    })

    expect(frozenLatest).toEqual(beforeLatest)
    expect(frozenHistory).toEqual(beforeHistory)
  })

  it('never evaluates Home feature flag for Reports executor', async () => {
    vi.stubEnv('VITE_FINANCIAL_SNAPSHOT_HOME_ENABLED', 'true')
    vi.stubEnv('VITE_FINANCIAL_SNAPSHOT_REPORTS_ENABLED', 'false')
    expect(isFinancialSnapshotReportsEnabled()).toBe(false)

    const current = engine(12)
    const decision = await executeReportsSnapshotPromotion({
      snapshotKey: 'unused' as never,
      expectedScope,
      officialCurrentResult: current,
      featureEnabled: isFinancialSnapshotReportsEnabled(),
      repository: {
        getLatestBySnapshotKey: vi.fn(),
        listBySnapshotKey: vi.fn(),
      } as never,
      dev: false,
    })

    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'feature_disabled',
      result: current,
    })
  })

  it('preserves result shape for UI compatibility on snapshot source', async () => {
    const item = await record()
    const decision = await execute(item)
    const report = decision.result.balanceReport as Record<string, unknown>

    expect(decision.source).toBe('snapshot')
    expect(typeof report.hasData).toBe('boolean')
    expect(typeof report.incomeGrossTotal).toBe('number')
    expect(typeof report.expenseTotal).toBe('number')
    expect(typeof report.netProfit).toBe('number')
    expect(typeof report.generalBalance).toBe('number')
    expect(Array.isArray(report.incomesByType)).toBe(true)
    expect(Array.isArray(report.expensesByType)).toBe(true)
    expect(Array.isArray(report.adjustments)).toBe(true)
  })

  it('does not mutate the official current result object', async () => {
    const item = await record()
    const current = engine(321)
    const before = structuredClone(current)

    await executeReportsSnapshotPromotion({
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: current,
      featureEnabled: true,
      repository: repository(item),
      dev: false,
    })

    expect(current).toEqual(before)
  })

  it('falls back when repository chain is empty or invalid', async () => {
    const item = await record()
    const repo = {
      getLatestBySnapshotKey: vi.fn(async () => structuredClone(item)),
      listBySnapshotKey: vi.fn(async () => []),
    }
    const decision = await execute(item, { repository: repo })
    expect(decision).toMatchObject({
      source: 'current',
      fallbackReason: 'revision_chain_invalid',
    })
  })

  it('supports rollback by disabling flag without changing current result', async () => {
    const item = await record()
    const current = engine(10)
    const decision = await executeReportsSnapshotPromotion({
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: current,
      featureEnabled: false,
      repository: repository(item),
      dev: false,
    })
    expect(decision).toMatchObject({
      source: 'current',
      result: current,
      fallbackReason: 'feature_disabled',
    })
  })

  it('is deterministic and idempotent for equivalent inputs', async () => {
    const item = await record()
    const input = {
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: engine(10),
      featureEnabled: true,
      repository: repository(item),
      dev: false,
    }
    const first = await executeReportsSnapshotPromotion(input)
    const second = await executeReportsSnapshotPromotion(input)
    expect(first).toEqual(second)
  })

  it('keeps production logs disabled and never writes to repository', async () => {
    const item = await record()
    const logger = vi.fn()
    const repo = repository(item)
    const decision = await executeReportsSnapshotPromotion({
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: engine(10),
      featureEnabled: true,
      repository: repo,
      dev: false,
      logger,
    })

    expect(decision.source).toBe('snapshot')
    expect(logger).not.toHaveBeenCalled()
    expect('persist' in repo).toBe(false)
    expect('add' in repo).toBe(false)
  })

  it('logs minimal safe decision data in development', async () => {
    const item = await record()
    const logger = vi.fn()

    await executeReportsSnapshotPromotion({
      snapshotKey: item.snapshotKey,
      expectedScope,
      officialCurrentResult: engine(10),
      featureEnabled: true,
      repository: repository(item),
      dev: true,
      logger,
    })

    expect(logger).toHaveBeenCalledWith(
      '[financial-snapshot] Reports promotion decision',
      expect.objectContaining({
        source: expect.any(String),
        revision: 1,
      }),
    )
    const payload = JSON.stringify(logger.mock.calls)
    expect(payload).not.toMatch(/[0-9a-f]{64}/)
    expect(payload).not.toContain('canonicalDocument')
    expect(payload).not.toContain('evidence')
  })
})
