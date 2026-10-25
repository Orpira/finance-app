import {
  isIncomeCalculationMethod,
  type IncomeCalculationMethod,
} from '../../catalogs/incomeCalculationMethods'
import { assertAdditionalAmountIsValid } from '../incomeAdditionals'
import type { IncomeCalculationInput } from './types'

export { assertAdditionalAmountIsValid }

export function assertIncomeCalculationInputIsValid(
  method: IncomeCalculationMethod,
  input: Pick<
    IncomeCalculationInput,
    'workedTime' | 'hourlyRate' | 'applySeasonPercentage' | 'percentage'
  >,
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
    // Fail-closed (D-015): si se optó por aplicar el % de temporada a este
    // ingreso de Jornada por horas, no se calcula sin un % válido — nunca se
    // inventa un valor ni se degrada silenciosamente a 100%.
    if (input.applySeasonPercentage && (!input.percentage || input.percentage <= 0)) {
      throw new Error(
        'No hay un % de temporada válido para aplicar a este ingreso de Jornada por horas.',
      )
    }
  }
}
