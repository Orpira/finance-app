import type {
  IncomeCalculationMethod,
  WorkedTimeUnit,
} from '../../catalogs/incomeCalculationMethods'
import type { ServiceIncomeType } from '../../types/service'
import type { UsageMode } from '../../types/settings'

export interface IncomeCalculationInput {
  usageMode: UsageMode
  incomeType?: ServiceIncomeType
  /** Significativo solo en 'service_duration': el importe tecleado por la usuaria. */
  totalAmount: number
  percentage: number
  /** Significativo solo en 'hourly_workday'. */
  workedTime?: number
  workedTimeUnit?: WorkedTimeUnit
  hourlyRate?: number
  storedRealGain?: number
}

export interface IncomeCalculationResult {
  /**
   * Importe del ingreso principal (servicio o jornada), SIN Adicionales.
   * Los Adicionales viven aparte (`ServiceIncome.additionalsTotal`) y nunca
   * se suman a este valor ni se persisten sobre él: el registro del ingreso
   * refleja únicamente el trabajo realizado.
   */
  realGain: number
  /** Solo presente en 'hourly_workday'. */
  workedHours?: number
}

export interface IncomeCalculator {
  method: IncomeCalculationMethod
  calculate(input: IncomeCalculationInput): IncomeCalculationResult
}
