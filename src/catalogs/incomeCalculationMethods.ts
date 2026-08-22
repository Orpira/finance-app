export type IncomeCalculationMethod = 'service_duration' | 'hourly_workday'
export type WorkedTimeUnit = 'minutes' | 'hours'

export const INCOME_CALCULATION_METHODS = [
  { code: 'service_duration' as const, label: 'Servicio por tiempo' as const },
  { code: 'hourly_workday' as const, label: 'Jornada por horas' as const },
] as const

export const WORKED_TIME_UNITS = [
  { code: 'minutes' as const, label: 'Minutos' as const },
  { code: 'hours' as const, label: 'Horas' as const },
] as const

export function isIncomeCalculationMethod(value: unknown): value is IncomeCalculationMethod {
  return INCOME_CALCULATION_METHODS.some((item) => item.code === value)
}

export function isWorkedTimeUnit(value: unknown): value is WorkedTimeUnit {
  return WORKED_TIME_UNITS.some((item) => item.code === value)
}

// "Jornada por horas" siempre pide el tiempo trabajado en horas y "Servicio
// por tiempo" en minutos: son las únicas unidades válidas por método, no una
// preferencia libre de la usuaria.
export function getWorkedTimeUnitForMethod(
  method: IncomeCalculationMethod,
): WorkedTimeUnit {
  return method === 'hourly_workday' ? 'hours' : 'minutes'
}

export function shouldCollectPaymentTypeAtRegistration(
  method: IncomeCalculationMethod,
) {
  return method === 'service_duration'
}
