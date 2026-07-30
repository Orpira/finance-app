import { calculateStoredRealGain } from '../realGain'
import type { IncomeCalculator } from './types'

export const serviceDurationCalculator: IncomeCalculator = {
  method: 'service_duration',
  calculate(input) {
    return {
      realGain: calculateStoredRealGain({
        totalAmount: input.totalAmount,
        percentage: input.percentage,
        usageMode: input.usageMode,
        incomeType: input.incomeType,
        storedRealGain: input.storedRealGain,
      }),
    }
  },
}
