export const FINANCIAL_ENGINE_HOME_CONSUMER = 'homeBalanceSummaryService'

export interface FinancialEnginePromotionCriteria {
  readonly exactMonetaryParity: boolean
  readonly zeroOneCentDivergences: boolean
  readonly sameFinancialClassification: boolean
  readonly sameBasicModeResults: boolean
  readonly sameProfessionalModeResults: boolean
  readonly sameSeasonMembership: boolean
  readonly sameHistoricalConversions: boolean
  readonly sameEmptyDatasetBehavior: boolean
  readonly sameLegacyIncompleteDataBehavior: boolean
  readonly zeroInputMutations: boolean
  readonly zeroWrites: boolean
  readonly zeroNetworkCalls: boolean
  readonly immediateRollbackAvailable: boolean
  readonly legacyFallbackAvailable: boolean
}

export type FinancialEnginePromotionCriterion = keyof FinancialEnginePromotionCriteria

export interface FinancialEnginePromotionAssessment {
  readonly eligible: boolean
  readonly criteria: FinancialEnginePromotionCriteria
  readonly failedCriteria: readonly FinancialEnginePromotionCriterion[]
  readonly engineVersion: string
  readonly consumer: typeof FINANCIAL_ENGINE_HOME_CONSUMER
}

/**
 * Deterministic promotion gate. Its evidence is supplied by controlled tests;
 * it deliberately does not imply persistent telemetry or sustained parity.
 */
export function assessFinancialEnginePromotion(input: {
  readonly criteria: FinancialEnginePromotionCriteria
  readonly engineVersion: string
}): FinancialEnginePromotionAssessment {
  const failedCriteria = (Object.keys(input.criteria) as FinancialEnginePromotionCriterion[])
    .filter((criterion) => !input.criteria[criterion])

  return {
    eligible: failedCriteria.length === 0,
    criteria: { ...input.criteria },
    failedCriteria,
    engineVersion: input.engineVersion,
    consumer: FINANCIAL_ENGINE_HOME_CONSUMER,
  }
}
