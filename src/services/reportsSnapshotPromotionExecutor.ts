import { FinancialSnapshotRepository } from '../intelligence/financial-snapshot/financialSnapshotRepository'
import { fingerprintCanonicalSnapshotDocument } from '../intelligence/financial-snapshot/snapshotFingerprint'
import {
  assessSnapshotPromotion,
  type SnapshotPromotionAssessment,
} from '../intelligence/financial-snapshot/snapshotPromotionPolicy'
import {
  materializeMetadataFromCanonicalDocument,
  materializeScopeFromCanonicalDocument,
} from '../intelligence/financial-snapshot/snapshotProtocol'
import type { FinancialEngineResult } from './financialEngineAdapter'
import type { PersistedFinancialSnapshot } from '../types/persistedFinancialSnapshot'
import type {
  CivilDate,
  EngineVersion,
  IanaTimeZone,
  SealedFinancialSnapshot,
  SnapshotKey,
} from '../types/financialSnapshot'
import type { CurrencyCode, UsageMode } from '../types/settings'

export interface ReportsSnapshotPromotionExpectedScope {
  readonly kind: 'monthly'
  readonly periodStart: CivilDate
  readonly periodEndExclusive: CivilDate
  readonly timezone: IanaTimeZone
  readonly usageMode: UsageMode
  readonly currency: CurrencyCode
  readonly earningPeriodId?: number
}

export type ReportsSnapshotPromotionFallbackReason =
  | 'feature_disabled'
  | 'snapshot_not_found'
  | 'repository_error'
  | 'revision_chain_invalid'
  | 'snapshot_not_eligible'
  | 'integrity_mismatch'
  | 'scope_mismatch'
  | 'version_incompatible'
  | 'result_contract_invalid'
  | 'internal_error'

export interface ReportsSnapshotPromotionDecision {
  readonly source: 'current' | 'snapshot'
  readonly result: FinancialEngineResult
  readonly assessment?: SnapshotPromotionAssessment
  readonly fallbackReason?: ReportsSnapshotPromotionFallbackReason
}

export interface ReportsSnapshotPromotionRepositoryPort {
  listBySnapshotKey(snapshotKey: SnapshotKey): Promise<PersistedFinancialSnapshot[]>
  getLatestBySnapshotKey(snapshotKey: SnapshotKey): Promise<PersistedFinancialSnapshot>
}

interface ReportsSnapshotPromotionExecutorInput {
  readonly snapshotKey: SnapshotKey
  readonly expectedScope: ReportsSnapshotPromotionExpectedScope
  readonly officialCurrentResult: FinancialEngineResult
  readonly featureEnabled: boolean
  readonly repository?: ReportsSnapshotPromotionRepositoryPort
  readonly dev?: boolean
  readonly logger?: (message: string, details: Record<string, unknown>) => void
}

export function isFinancialSnapshotReportsEnabled(): boolean {
  return import.meta.env.VITE_FINANCIAL_SNAPSHOT_REPORTS_ENABLED === 'true'
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function current(
  result: FinancialEngineResult,
  fallbackReason: ReportsSnapshotPromotionFallbackReason,
  assessment?: SnapshotPromotionAssessment,
): ReportsSnapshotPromotionDecision {
  return {
    source: 'current',
    result,
    fallbackReason,
    ...(assessment === undefined ? {} : { assessment }),
  }
}

function validChain(
  records: readonly PersistedFinancialSnapshot[],
  latest: PersistedFinancialSnapshot,
): boolean {
  if (records.length === 0) return false
  const ordered = [...records].sort((a, b) => a.revision - b.revision)
  if (ordered.at(-1)?.snapshotId !== latest.snapshotId) return false
  return ordered.every(
    (record, index) =>
      record.snapshotKey === latest.snapshotKey &&
      record.revision === index + 1 &&
      (index === 0
        ? record.supersedesSnapshotId === undefined
        : record.supersedesSnapshotId === ordered[index - 1].snapshotId),
  )
}

function sealedView(record: PersistedFinancialSnapshot): SealedFinancialSnapshot<unknown> {
  const payload = record.canonicalDocument.payload
  return {
    identity: { snapshotId: record.snapshotId, snapshotKey: record.snapshotKey },
    revision: {
      revision: record.revision,
      reasonCode: record.revisionReasonCode,
      ...(record.supersedesSnapshotId === undefined
        ? {}
        : { supersedesSnapshotId: record.supersedesSnapshotId }),
    },
    status: 'sealed',
    canonicalDocument: record.canonicalDocument,
    fingerprint: record.fingerprint,
    sealedAt: record.sealedAt,
    snapshotVersion: record.snapshotVersion,
    canonicalizationVersion: record.canonicalizationVersion,
    engineVersion: record.engineVersion,
    rulesetVersion: record.rulesetVersion,
    scope: materializeScopeFromCanonicalDocument(record.canonicalDocument),
    evidence: payload.evidence,
    appliedRules: payload.appliedRules,
    metadata: materializeMetadataFromCanonicalDocument(record.canonicalDocument),
  }
}

function scopeMatches(
  record: PersistedFinancialSnapshot,
  expected: ReportsSnapshotPromotionExpectedScope,
): boolean {
  const scope = record.canonicalDocument.payload.scope
  return (
    scope.kind === expected.kind &&
    scope.periodStart === expected.periodStart &&
    scope.periodEndExclusive === expected.periodEndExclusive &&
    scope.timezone === expected.timezone &&
    scope.usageMode === expected.usageMode &&
    scope.currency === expected.currency &&
    scope.earningPeriodId === expected.earningPeriodId
  )
}

function isFinancialEngineResult(value: unknown): value is FinancialEngineResult {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const result = value as Record<string, unknown>
  const report = result.balanceReport
  if (report === null || typeof report !== 'object' || Array.isArray(report)) return false
  const balance = report as Record<string, unknown>
  const numericReportFields = [
    'incomeGrossTotal',
    'expenseTotal',
    'adjustmentsPositiveTotal',
    'adjustmentsNegativeTotal',
    'adjustmentImpactTotal',
    'netProfit',
    'generalBalance',
    'impactByAdjustments',
  ]
  const arrayReportFields = [
    'incomesByType',
    'expensesByType',
    'adjustments',
    'incomeAdjustments',
    'expenseAdjustments',
  ]
  return (
    numericReportFields.every(
      (field) => typeof balance[field] === 'number' && Number.isFinite(balance[field]),
    ) &&
    arrayReportFields.every((field) => Array.isArray(balance[field])) &&
    typeof balance.hasData === 'boolean' &&
    typeof result.scheduledMinutes === 'number' &&
    Number.isFinite(result.scheduledMinutes) &&
    typeof result.actualMinutes === 'number' &&
    Number.isFinite(result.actualMinutes) &&
    Number.isSafeInteger(result.incomeCount) &&
    Number.isSafeInteger(result.expenseCount) &&
    Number.isSafeInteger(result.adjustmentCount) &&
    typeof result.engineVersion === 'string' &&
    Array.isArray(result.appliedRules) &&
    result.appliedRules.every((rule) => typeof rule === 'string')
  )
}

function safeSnapshotKey(snapshotKey: SnapshotKey): string {
  const value = String(snapshotKey)
  if (value.length <= 48) return value
  return `${value.slice(0, 24)}...${value.slice(-12)}`
}

function logDecision(
  input: ReportsSnapshotPromotionExecutorInput,
  decision: ReportsSnapshotPromotionDecision,
  latest?: PersistedFinancialSnapshot,
  records?: readonly PersistedFinancialSnapshot[],
): void {
  if (!(input.dev ?? import.meta.env.DEV)) return
  const logger = input.logger ?? console.info
  const ordered = records === undefined
    ? []
    : [...records].sort((first, second) => first.revision - second.revision)
  const previous = ordered.length > 1 ? ordered[ordered.length - 2] : undefined
  logger('[financial-snapshot] Reports promotion decision', {
    source: decision.source,
    snapshotKey: safeSnapshotKey(input.snapshotKey),
    scopeKind: input.expectedScope.kind,
    ...(latest === undefined
      ? {}
      : {
          revision: latest.revision,
          fingerprintChanged:
            previous === undefined
              ? false
              : previous.fingerprintValue !== latest.fingerprintValue,
        }),
    ...(decision.assessment === undefined
      ? {}
      : {
          failedChecks: decision.assessment.failedChecks.map((check) => check.code),
        }),
    ...(decision.fallbackReason === undefined
      ? {}
      : { fallbackReason: decision.fallbackReason }),
  })
}

/**
 * Read-only and fail-closed Reports promotion executor.
 * It never rebuilds, persists, mutates or repairs snapshots.
 */
export async function executeReportsSnapshotPromotion(
  input: ReportsSnapshotPromotionExecutorInput,
): Promise<ReportsSnapshotPromotionDecision> {
  if (!input.featureEnabled) {
    const decision = current(input.officialCurrentResult, 'feature_disabled')
    logDecision(input, decision)
    return decision
  }

  const repository = input.repository ?? new FinancialSnapshotRepository()
  let latest: PersistedFinancialSnapshot
  let records: PersistedFinancialSnapshot[]

  try {
    ;[latest, records] = await Promise.all([
      repository.getLatestBySnapshotKey(input.snapshotKey),
      repository.listBySnapshotKey(input.snapshotKey),
    ])
  } catch (error) {
    const reason =
      (error as { code?: unknown })?.code === 'SNAPSHOT_PERSISTENCE_NOT_FOUND'
        ? 'snapshot_not_found'
        : 'repository_error'
    const decision = current(input.officialCurrentResult, reason)
    logDecision(input, decision)
    return decision
  }

  try {
    if (
      latest.status !== 'persisted' ||
      latest.snapshotKey !== input.snapshotKey ||
      !validChain(records, latest)
    ) {
      const decision = current(input.officialCurrentResult, 'revision_chain_invalid')
      logDecision(input, decision, latest, records)
      return decision
    }

    if (!scopeMatches(latest, input.expectedScope)) {
      const decision = current(input.officialCurrentResult, 'scope_mismatch')
      logDecision(input, decision, latest, records)
      return decision
    }

    const expectedEngineVersion = input.officialCurrentResult.engineVersion as EngineVersion
    if (
      latest.engineVersion !== expectedEngineVersion ||
      latest.rulesetVersion !== `engine-bundled/${expectedEngineVersion}`
    ) {
      const decision = current(input.officialCurrentResult, 'version_incompatible')
      logDecision(input, decision, latest, records)
      return decision
    }

    const recalculated = await fingerprintCanonicalSnapshotDocument(
      latest.canonicalDocument,
    )
    if (
      JSON.stringify(recalculated) !== JSON.stringify(latest.fingerprint) ||
      latest.fingerprintValue !== recalculated.value ||
      latest.snapshotId !==
        `financial-snapshot:${recalculated.fingerprintVersion}:${recalculated.value}`
    ) {
      const decision = current(input.officialCurrentResult, 'integrity_mismatch')
      logDecision(input, decision, latest, records)
      return decision
    }

    const assessment = assessSnapshotPromotion(sealedView(latest))
    if (!assessment.eligible) {
      const decision = current(
        input.officialCurrentResult,
        'snapshot_not_eligible',
        assessment,
      )
      logDecision(input, decision, latest, records)
      return decision
    }

    const result = latest.canonicalDocument.payload.engineResult
    if (!isFinancialEngineResult(result) || result.engineVersion !== expectedEngineVersion) {
      const decision = current(
        input.officialCurrentResult,
        'result_contract_invalid',
        assessment,
      )
      logDecision(input, decision, latest, records)
      return decision
    }

    const decision: ReportsSnapshotPromotionDecision = {
      source: 'snapshot',
      result: clone(result),
      assessment,
    }
    logDecision(input, decision, latest, records)
    return decision
  } catch {
    const decision = current(input.officialCurrentResult, 'internal_error')
    logDecision(input, decision, latest, records)
    return decision
  }
}
