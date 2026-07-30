import {
  isIncomeCalculationMethod,
  type IncomeCalculationMethod,
} from '../../catalogs/incomeCalculationMethods'
import { assertAdditionalAmountIsValid } from '../incomeAdditionals'
import type { IncomeCalculationInput } from './types'

export { assertAdditionalAmountIsValid }

export function assertIncomeCalculationInputIsValid(
  method: IncomeCalculationMethod,
  input: Pick<IncomeCalculationInput, 'workedTime' | 'hourlyRate'>,
) {
  if (!isIncomeCalculationMethod(method)) {
    throw new Error(`Método de cálculo de ingreso no soportado: ${method}`)
  }

  if (method === 'hourly_workday') {
    if (!input.workedTime || input.workedTime <= 0) {
      throw new Error(
        'El tiempo trabajado debe ser mayor a cero para Jornada por horas.',
      )
    }
    if (!input.hourlyRate || input.hourlyRate <= 0) {
      throw new Error('El valor por hora debe ser mayor a cero.')
    }
  }
}
