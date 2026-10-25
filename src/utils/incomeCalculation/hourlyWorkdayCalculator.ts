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
    const grossGain = workedHours * (input.hourlyRate ?? 0)

    // D-011 (vigente por defecto): Jornada por horas no aplica el % de
    // temporada, el pago por hora ya es el 100% del ingreso final de la
    // profesional. D-015 (revisión): la usuaria puede optar, por ingreso,
    // por aplicar igualmente el % activo de la temporada —
    // input.applySeasonPercentage es un opt-in explícito, nunca implícito.
    // Los Adicionales nunca se suman aquí — viven aparte.
    const realGain = input.applySeasonPercentage
      ? roundMoney((grossGain * (input.percentage ?? 0)) / 100)
      : roundMoney(grossGain)

    return {
      workedHours,
      realGain,
    }
  },
}
