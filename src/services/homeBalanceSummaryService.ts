import { buildBalanceReport, type BalanceReportResult } from './balanceReportService'
import {
  type FinancialEngineShadowOptions,
} from './financialEngineShadowMode'
import {
  runFinancialEngine,
  type FinancialEngineInput,
  type FinancialEngineResult,
} from './financialEngineAdapter'
import { validateFinancialParity } from '../utils/financialParityValidator'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode, UsageMode } from '../types/settings'
import {
  runSnapshotShadowMode,
  type SnapshotShadowModeInput,
} from './snapshotShadowModeService'
import type {
  CivilDate,
  IanaTimeZone,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  UtcInstant,
} from '../types/financialSnapshot'
import { deriveSnapshotKey } from '../intelligence/financial-snapshot/snapshotSealer'
import {
  executeSnapshotPromotion,
  isFinancialSnapshotHomeEnabled,
  type SnapshotPromotionDecision,
  type SnapshotPromotionRepositoryPort,
} from './snapshotPromotionExecutor'

interface BuildHomeBalanceSummaryInput {
  readonly incomes: readonly ServiceIncome[]
  readonly expenses: readonly Expense[]
  readonly currency: CurrencyCode
  readonly usageMode: UsageMode
  readonly earningPeriodId?: number
  readonly scope: 'home.current-month' | 'home.previous-month'
  readonly snapshotShadow?: {
    readonly periodStart: CivilDate
    readonly periodEndExclusive: CivilDate
    readonly asOf: UtcInstant
    readonly timezone: IanaTimeZone
    readonly candidateId: SnapshotCandidateId
    readonly generatedAt: UtcInstant
    readonly sealedAt: UtcInstant
    readonly persistedAt: UtcInstant
    readonly revisionReasonCode: SnapshotNormativeCode
  }
}

interface HomeBalanceSummaryOptions extends FinancialEngineShadowOptions {
  readonly snapshotRunner?: (
    input: SnapshotShadowModeInput,
  ) => Promise<unknown>
}

interface HomeSnapshotPromotionOptions extends HomeBalanceSummaryOptions {
  readonly promotionEnabled?: boolean
  readonly promotionRepository?: SnapshotPromotionRepositoryPort
}

function isHomeFinancialEngineEnabled() {
  return import.meta.env.VITE_FINANCIAL_ENGINE_HOME_ENABLED === 'true'
}

export async function resolveHomeBalanceSummaryPromotion(
  input: BuildHomeBalanceSummaryInput,
  options: HomeSnapshotPromotionOptions = {},
): Promise<{ readonly summary: BalanceReportResult; readonly decision: SnapshotPromotionDecision }> {
  const legacyBalanceReport = buildBalanceReport({
    incomes: [...input.incomes], expenses: [...input.expenses], currency: input.currency,
  })
  const engineRunner = options.engineRunner ?? runFinancialEngine
  let officialCurrentResult: FinancialEngineResult
  try {
    officialCurrentResult = engineRunner({
      incomes: input.incomes,
      expenses: input.expenses,
      currency: input.currency,
      usageMode: input.usageMode,
      earningPeriodId: input.earningPeriodId,
    })
    if (!isHomeFinancialEngineEnabled()) {
      officialCurrentResult = { ...officialCurrentResult, balanceReport: legacyBalanceReport }
    }
  } catch {
    const summary = buildHomeBalanceSummary(input, options)
    return {
      summary,
      decision: { source: 'current', result: {
        balanceReport: summary, scheduledMinutes: 0, actualMinutes: 0,
        incomeCount: 0, expenseCount: 0, adjustmentCount: 0,
        engineVersion: 'unavailable', appliedRules: [],
      }, fallbackReason: 'internal_error' },
    }
  }

  const context = input.snapshotShadow
  if (input.scope !== 'home.current-month' || context === undefined) {
    return {
      summary: officialCurrentResult.balanceReport,
      decision: { source: 'current', result: officialCurrentResult, fallbackReason: 'feature_disabled' },
    }
  }
  const expectedScope = {
    kind: 'monthly' as const,
    periodStart: context.periodStart,
    periodEndExclusive: context.periodEndExclusive,
    timezone: context.timezone,
    usageMode: input.usageMode,
    currency: input.currency,
    ...(input.earningPeriodId === undefined ? {} : { earningPeriodId: input.earningPeriodId }),
  }
  const snapshotKey = deriveSnapshotKey({
    canonicalizationVersion: 'financial-snapshot-c14n/1.0.0' as never,
    payload: { scope: { ...expectedScope, periodBoundary: '[start,end)', asOf: context.asOf, filters: {} } } as never,
  })
  const decision = await executeSnapshotPromotion({
    snapshotKey,
    expectedScope,
    officialCurrentResult,
    featureEnabled: options.promotionEnabled ?? isFinancialSnapshotHomeEnabled(),
    ...(options.promotionRepository === undefined ? {} : { repository: options.promotionRepository }),
    dev: options.dev,
    logger: options.logger,
  })
  return { summary: decision.result.balanceReport, decision }
}

/**
 * The legacy result is always calculated and retained as the immediate
 * fallback. Removing the build flag, or setting it to false, is the complete
 * rollback procedure and requires no data migration or cleanup.
 */
export function buildHomeBalanceSummary(
  input: BuildHomeBalanceSummaryInput,
  options: HomeBalanceSummaryOptions = {},
): BalanceReportResult {
  const legacyBalanceReport = buildBalanceReport({
    incomes: [...input.incomes],
    expenses: [...input.expenses],
    currency: input.currency,
  })

  const engineRunner: (input: FinancialEngineInput) => FinancialEngineResult =
    options.engineRunner ?? runFinancialEngine

  try {
    const engineResult = engineRunner({
      incomes: input.incomes,
      expenses: input.expenses,
      currency: input.currency,
      usageMode: input.usageMode,
      earningPeriodId: input.earningPeriodId,
    })

    validateFinancialParity({
      legacyValue: legacyBalanceReport,
      newValue: engineResult.balanceReport,
      context: {
        scope: input.scope,
        usageMode: input.usageMode,
        currency: input.currency,
        earningPeriodId: input.earningPeriodId,
        incomeCount: input.incomes.length,
        expenseCount: input.expenses.length,
        field: 'balanceReport',
      },
    }, { dev: options.dev, logger: options.logger })

    if (input.scope === 'home.current-month' && input.snapshotShadow !== undefined) {
      const snapshotRunner = options.snapshotRunner ?? runSnapshotShadowMode
      try {
        void snapshotRunner({
          consumer: 'home.balance.current-month',
          scope: {
            periodStart: input.snapshotShadow.periodStart,
            periodEndExclusive: input.snapshotShadow.periodEndExclusive,
            asOf: input.snapshotShadow.asOf,
            timezone: input.snapshotShadow.timezone,
            usageMode: input.usageMode,
            currency: input.currency,
            ...(input.earningPeriodId === undefined
              ? {}
              : { earningPeriodId: input.earningPeriodId }),
          },
          financialEngineResult: engineResult,
          incomes: input.incomes,
          expenses: input.expenses,
          candidateId: input.snapshotShadow.candidateId,
          generatedAt: input.snapshotShadow.generatedAt,
          sealedAt: input.snapshotShadow.sealedAt,
          persistedAt: input.snapshotShadow.persistedAt,
          revisionReasonCode: input.snapshotShadow.revisionReasonCode,
        }).catch(() => undefined)
      } catch {
        // Snapshot is observational and cannot alter the official Home result.
      }
    }

    return isHomeFinancialEngineEnabled()
      ? engineResult.balanceReport
      : legacyBalanceReport
  } catch {
    if (options.dev ?? import.meta.env.DEV) {
      const logger = options.logger ?? console.warn
      logger('[financial-engine] Home adapter failed; using legacy fallback', {
        scope: input.scope,
        usageMode: input.usageMode,
        currency: input.currency,
        earningPeriodId: input.earningPeriodId,
        incomeCount: input.incomes.length,
        expenseCount: input.expenses.length,
      })
    }

    return legacyBalanceReport
  }
}
