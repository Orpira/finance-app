import { afterEach, describe, expect, it, vi } from 'vitest'

import { canonicalizeValidatedSnapshotCandidate } from '../src/intelligence/financial-snapshot/snapshotCanonicalizer'
import { fingerprintCanonicalSnapshotDocument } from '../src/intelligence/financial-snapshot/snapshotFingerprint'
import { deriveSnapshotKey, sealCanonicalSnapshot } from '../src/intelligence/financial-snapshot/snapshotSealer'
import { runFinancialEngine, type FinancialEngineResult } from '../src/services/financialEngineAdapter'
import {
  executeSnapshotPromotion,
  isFinancialSnapshotHomeEnabled,
  type SnapshotPromotionExpectedScope,
  type SnapshotPromotionRepositoryPort,
} from '../src/services/snapshotPromotionExecutor'
import type { PersistedFinancialSnapshot } from '../src/types/persistedFinancialSnapshot'
import type {
  CanonicalizationVersion, CivilDate, EngineVersion, IanaTimeZone, RulesetVersion,
  SnapshotCandidateId, SnapshotNormativeCode, SnapshotVersion, UtcInstant,
  ValidatedSnapshotCandidate,
} from '../src/types/financialSnapshot'

const at = '2026-07-14T10:00:00.000Z' as UtcInstant
const engineVersion = '1.0.0-phase-1a-minimal' as EngineVersion
const rulesetVersion = `engine-bundled/${engineVersion}` as RulesetVersion
const expectedScope: SnapshotPromotionExpectedScope = {
  kind: 'monthly', periodStart: '2026-07-01' as CivilDate,
  periodEndExclusive: '2026-08-01' as CivilDate,
  timezone: 'Europe/Madrid' as IanaTimeZone, usageMode: 'basic', currency: 'EUR',
}

function engine(balance = 10): FinancialEngineResult {
  const result = runFinancialEngine({ incomes: [], expenses: [], currency: 'EUR', usageMode: 'basic' })
  return { ...result, balanceReport: { ...result.balanceReport, generalBalance: balance } }
}

async function record(options: { rules?: boolean; scope?: Partial<ValidatedSnapshotCandidate['scope']> } = {}) {
  const rules = options.rules === false ? [] : [{
    ruleId: 'balance.report.current', order: 0, engineVersion, rulesetVersion,
    explanationCode: 'rule.balance.report.current' as SnapshotNormativeCode,
    affectedFields: [], limitationCodes: ['rule.version.unavailable' as SnapshotNormativeCode], warningCodes: [],
  }]
  const candidate: ValidatedSnapshotCandidate<FinancialEngineResult> = {
    status: 'validated', identity: { candidateId: 'executor-test' as SnapshotCandidateId },
    scope: {
      ...expectedScope, periodBoundary: '[start,end)', asOf: at, filters: {}, ...options.scope,
    },
    engineResult: engine(99),
    evidence: {
      strategy: 'embedded-v1', records: [],
      context: [{ kind: 'settings-context', usageMode: 'basic', currency: 'EUR', timezone: 'Europe/Madrid' as IanaTimeZone }],
      candidateRecordCount: 0, includedRecordCount: 0, excludedRecordCount: 0,
      coverageCodes: ['coverage.empty_dataset' as SnapshotNormativeCode], warningCodes: [],
    },
    appliedRules: rules,
    metadata: {
      generatedAt: at, generationReasonCode: 'generation.shadow_evaluation' as SnapshotNormativeCode,
      provenance: 'local', qualityCodes: ['quality.validated_structure' as SnapshotNormativeCode],
      warningCodes: [], limitationCodes: ['rule.version.unavailable' as SnapshotNormativeCode],
    },
    snapshotVersion: 'financial-snapshot/1.0.0' as SnapshotVersion,
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0' as CanonicalizationVersion,
    engineVersion, rulesetVersion,
  }
  const canonicalDocument = canonicalizeValidatedSnapshotCandidate(candidate)
  const fingerprint = await fingerprintCanonicalSnapshotDocument(canonicalDocument)
  const sealed = await sealCanonicalSnapshot({
    canonicalDocument, fingerprint, snapshotKey: deriveSnapshotKey(canonicalDocument), revision: 1,
    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode, sealedAt: at,
  })
  return {
    snapshotId: sealed.identity.snapshotId, snapshotKey: sealed.identity.snapshotKey, revision: 1,
    revisionReasonCode: sealed.revision.reasonCode, status: 'persisted', canonicalDocument,
    fingerprint, sealedAt: at, persistedAt: at, localSchemaVersion: 1,
    snapshotVersion: sealed.snapshotVersion, canonicalizationVersion: sealed.canonicalizationVersion,
    engineVersion, rulesetVersion, scopeKind: sealed.scope.kind,
    scopePeriodStart: sealed.scope.periodStart, fingerprintValue: fingerprint.value,
  } satisfies PersistedFinancialSnapshot<FinancialEngineResult>
}

function repository(item: PersistedFinancialSnapshot): SnapshotPromotionRepositoryPort {
  return {
    getLatestBySnapshotKey: vi.fn(async () => structuredClone(item)),
    listBySnapshotKey: vi.fn(async () => [structuredClone(item)]),
  }
}

async function execute(item: PersistedFinancialSnapshot, overrides: Record<string, unknown> = {}) {
  return executeSnapshotPromotion({
    snapshotKey: item.snapshotKey, expectedScope, officialCurrentResult: engine(10),
    featureEnabled: true, repository: repository(item), dev: false, ...overrides,
  })
}

describe('SnapshotPromotionExecutor', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([[undefined, false], ['false', false], ['true', true], ['TRUE', false], ['1', false], ['yes', false], ['invalid', false]])(
    'enables only exact true for %j', (value, enabled) => {
      vi.stubEnv('VITE_FINANCIAL_SNAPSHOT_HOME_ENABLED', value)
      expect(isFinancialSnapshotHomeEnabled()).toBe(enabled)
    },
  )

  it('does not read repository when disabled and preserves current identity', async () => {
    const current = engine(10)
    const repo = { getLatestBySnapshotKey: vi.fn(), listBySnapshotKey: vi.fn() }
    const decision = await executeSnapshotPromotion({
      snapshotKey: 'unused' as never, expectedScope, officialCurrentResult: current,
      featureEnabled: false, repository: repo as never, dev: false,
    })
    expect(decision).toMatchObject({ source: 'current', result: current, fallbackReason: 'feature_disabled' })
    expect(repo.getLatestBySnapshotKey).not.toHaveBeenCalled()
  })

  it('promotes an eligible latest snapshot without mutating either result', async () => {
    const item = await record()
    const before = structuredClone(item)
    const decision = await execute(item)
    expect(decision.source).toBe('snapshot')
    expect(decision.result.balanceReport.generalBalance).toBe(99)
    expect(decision.assessment?.eligible).toBe(true)
    expect(item).toEqual(before)
    expect(decision.result).not.toBe(item.canonicalDocument.payload.engineResult)
  })

  it('falls back for missing snapshot and repository error', async () => {
    const base = await record()
    for (const error of [
      { code: 'SNAPSHOT_PERSISTENCE_NOT_FOUND' }, new Error('db failed'),
    ]) {
      const repo = {
        getLatestBySnapshotKey: vi.fn(async () => { throw error }),
        listBySnapshotKey: vi.fn(async () => []),
      }
      const decision = await execute(base, { repository: repo })
      expect(decision.source).toBe('current')
      expect(decision.result.balanceReport.generalBalance).toBe(10)
    }
  })

  it('falls back for altered fingerprint, canonical document and snapshotId', async () => {
    const base = await record()
    const variants = [
      { ...structuredClone(base), fingerprintValue: '0'.repeat(64) },
      { ...structuredClone(base), canonicalDocument: { ...base.canonicalDocument, payload: { ...base.canonicalDocument.payload, engineResult: engine(123) } } },
      { ...structuredClone(base), snapshotId: `${base.snapshotId}:wrong` },
    ] as PersistedFinancialSnapshot[]
    for (const item of variants) {
      expect(await execute(item)).toMatchObject({ source: 'current', fallbackReason: 'integrity_mismatch' })
    }
  })

  it.each([
    ['kind', { kind: 'year' }], ['currency', { currency: 'COP' }],
    ['timezone', { timezone: 'UTC' }], ['period start', { periodStart: '2026-06-01' }],
    ['period end', { periodEndExclusive: '2026-09-01' }], ['usage mode', { usageMode: 'professional' }],
    ['earning period', { earningPeriodId: 7 }],
  ])('falls back for incompatible %s', async (_label, difference) => {
    const item = await record()
    const decision = await execute(item, { expectedScope: { ...expectedScope, ...difference } })
    expect(decision).toMatchObject({ source: 'current', fallbackReason: 'scope_mismatch' })
  })

  it('requires compatible engine and ruleset versions', async () => {
    const item = await record()
    for (const changed of [
      { ...item, engineVersion: 'other' as EngineVersion },
      { ...item, rulesetVersion: 'other' as RulesetVersion },
    ]) {
      expect(await execute(changed)).toMatchObject({ source: 'current', fallbackReason: 'version_incompatible' })
    }
  })

  it('requires an eligible policy assessment', async () => {
    const item = await record({ rules: false })
    const decision = await execute(item)
    expect(decision).toMatchObject({ source: 'current', fallbackReason: 'snapshot_not_eligible' })
    expect(decision.assessment?.eligible).toBe(false)
  })

  it('falls back for a non-permitted persisted state or structural exception', async () => {
    const item = await record()
    expect(await execute({ ...item, status: 'invalidated' } as never)).toMatchObject({
      source: 'current', fallbackReason: 'revision_chain_invalid',
    })
    expect(await execute({ ...item, canonicalDocument: null } as never)).toMatchObject({
      source: 'current', fallbackReason: 'internal_error',
    })
  })

  it('rejects non-latest, conflicting and broken supersedes chains', async () => {
    const item = await record()
    const broken = { ...item, revision: 2, supersedesSnapshotId: 'missing' as never }
    expect(await execute(broken)).toMatchObject({ source: 'current', fallbackReason: 'revision_chain_invalid' })
    const repo = repository(item)
    vi.mocked(repo.listBySnapshotKey).mockResolvedValue([item, { ...item, revision: 1, snapshotId: `${item.snapshotId}:conflict` as never }])
    expect(await execute(item, { repository: repo })).toMatchObject({ source: 'current', fallbackReason: 'revision_chain_invalid' })
  })

  it('is deterministic, avoids production logs and never persists', async () => {
    const item = await record()
    const repo = repository(item)
    const logger = vi.fn()
    const input = {
      snapshotKey: item.snapshotKey, expectedScope, officialCurrentResult: engine(10),
      featureEnabled: true, repository: repo, dev: false, logger,
    }
    expect(await executeSnapshotPromotion(input)).toEqual(await executeSnapshotPromotion(input))
    expect(logger).not.toHaveBeenCalled()
    expect('persist' in repo).toBe(false)
  })
})
