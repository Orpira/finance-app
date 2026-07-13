import type { ServiceIncomeType } from '../types/service'
import type { UsageMode } from '../types/settings'
import { roundMoney } from './currency'
import { isAdjustmentIncome, isServiceIncome } from './incomeTypes'

export interface CalculateStoredRealGainInput {
  totalAmount: number
  percentage: number
  usageMode: UsageMode
  incomeType?: ServiceIncomeType
  storedRealGain?: number
}

/**
 * Preserves the real-gain calculation used when an income is stored.
 * Historical non-service records keep their stored value when available.
 */
export function calculateStoredRealGain({
  totalAmount,
  percentage,
  usageMode,
  incomeType,
  storedRealGain,
}: CalculateStoredRealGainInput) {
  const isBasicMode = usageMode === 'basic'
  const isAdjustment = !isBasicMode && isAdjustmentIncome({ type: incomeType })
  const isService = isBasicMode || isServiceIncome({ type: incomeType })

  return roundMoney(
    isBasicMode || isAdjustment
      ? totalAmount
      : isService
        ? (totalAmount * percentage) / 100
        : storedRealGain ?? totalAmount,
  )
}
