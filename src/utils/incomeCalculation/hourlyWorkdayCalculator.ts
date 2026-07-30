import type { WorkedTimeUnit } from '../../catalogs/incomeCalculationMethods'
import { roundMoney } from '../currency'
import type { IncomeCalculator } from './types'

export function convertWorkedTimeToHours(
  workedTime: number,
  unit: WorkedTimeUnit | undefined,
) {
  return unit === 'hours' ? workedTime : workedTime / 60
}

export const hourlyWorkdayCalculator: IncomeCalculator = {
  method: 'hourly_workday',
  calculate(input) {
    const workedHours = roundMoney(
      convertWorkedTimeToHours(input.workedTime ?? 0, input.workedTimeUnit),
    )

    // Jornada por horas nunca aplica el % de temporada: el pago por hora ya
    // es el 100% del ingreso final de la profesional (decisión aprobada).
    // Los Adicionales nunca se suman aquí — viven aparte.
    return {
      workedHours,
      realGain: roundMoney(workedHours * (input.hourlyRate ?? 0)),
    }
  },
}
