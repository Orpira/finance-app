import { describe, expect, it } from 'vitest'

import {
  assessFinancialEnginePromotion,
  type FinancialEnginePromotionCriteria,
} from '../src/services/financialEnginePromotionPolicy'

const passingCriteria: FinancialEnginePromotionCriteria = {
  exactMonetaryParity: true,
  zeroOneCentDivergences: true,
  sameFinancialClassification: true,
  sameBasicModeResults: true,
  sameProfessionalModeResults: true,
  sameSeasonMembership: true,
  sameHistoricalConversions: true,
  sameEmptyDatasetBehavior: true,
  sameLegacyIncompleteDataBehavior: true,
  zeroInputMutations: true,
  zeroWrites: true,
  zeroNetworkCalls: true,
  immediateRollbackAvailable: true,
  legacyFallbackAvailable: true,
}

describe('Financial Engine promotion policy', () => {
  it('is eligible only when every controlled-test criterion passes', () => {
    const assessment = assessFinancialEnginePromotion({
      criteria: passingCriteria,
      engineVersion: '1.0.0-phase-1a-minimal',
    })

    expect(assessment).toEqual({
      eligible: true,
      criteria: passingCriteria,
      failedCriteria: [],
      engineVersion: '1.0.0-phase-1a-minimal',
      consumer: 'homeBalanceSummaryService',
    })
  })

  it('rejects a monetary divergence of 0.01', () => {
    const legacyAmount: number = 80
    const engineAmount: number = 80.01
    const assessment = assessFinancialEnginePromotion({
      criteria: {
        ...passingCriteria,
        exactMonetaryParity: legacyAmount === engineAmount,
        zeroOneCentDivergences: Math.abs(legacyAmount - engineAmount) < 0.01,
      },
      engineVersion: '1.0.0-phase-1a-minimal',
    })

    expect(assessment.eligible).toBe(false)
    expect(assessment.failedCriteria).toEqual([
      'exactMonetaryParity',
      'zeroOneCentDivergences',
    ])
  })
})
