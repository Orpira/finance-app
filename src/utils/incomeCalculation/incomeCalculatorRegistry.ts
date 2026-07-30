import type { IncomeCalculationMethod } from '../../catalogs/incomeCalculationMethods'
import { hourlyWorkdayCalculator } from './hourlyWorkdayCalculator'
import { serviceDurationCalculator } from './serviceDurationCalculator'
import { assertIncomeCalculationInputIsValid } from './incomeCalculationValidation'
import type { IncomeCalculationInput, IncomeCalculationResult, IncomeCalculator } from './types'

const CALCULATORS: Record<IncomeCalculationMethod, IncomeCalculator> = {
  service_duration: serviceDurationCalculator,
  hourly_workday: hourlyWorkdayCalculator,
}

export function runIncomeCalculation(
  method: IncomeCalculationMethod | undefined,
  input: IncomeCalculationInput,
): IncomeCalculationResult {
  const resolvedMethod = method ?? 'service_duration'

  assertIncomeCalculationInputIsValid(resolvedMethod, input)

  return CALCULATORS[resolvedMethod].calculate(input)
}
