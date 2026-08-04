import type { ServiceIncome } from '../types/service'
import type { IncomeCalculationMethod, WorkedTimeUnit } from '../catalogs/incomeCalculationMethods'
import { DEFAULT_EXIT_DURATION_MINUTES } from '../config/serviceTimer'

export type ServiceDurationLabel = '15' | '30' | '60' | '120' | 'Salida'

export interface ServiceDurationOption {
  durationMinutes: number
  durationLabel: ServiceDurationLabel
}

export const SERVICE_DURATION_OPTIONS: readonly ServiceDurationOption[] = [
  { durationMinutes: 15, durationLabel: '15' },
  { durationMinutes: 30, durationLabel: '30' },
  { durationMinutes: 60, durationLabel: '60' },
  { durationMinutes: 120, durationLabel: '120' },
  { durationMinutes: DEFAULT_EXIT_DURATION_MINUTES, durationLabel: 'Salida' },
]

export interface EffectiveFinancialDurationInput {
  actualDuration?: number
  duration?: number
  durationLabel?: string
  incomeCalculationMethod?: IncomeCalculationMethod
  workedTime?: number
  workedTimeUnit?: WorkedTimeUnit
}

/**
 * Preserves the stored-duration precedence used by financial summaries.
 * 'hourly_workday' no guarda duration/actualDuration (siempre 0): la
 * duración real vive en workedTime/workedTimeUnit.
 */
export function getEffectiveFinancialDuration(
  input: EffectiveFinancialDurationInput,
) {
  if (input.incomeCalculationMethod === 'hourly_workday') {
    return input.workedTimeUnit === 'hours'
      ? (input.workedTime ?? 0) * 60
      : (input.workedTime ?? 0)
  }

  return input.actualDuration ?? input.duration
}

export function calculateEffectiveDuration(input: Pick<ServiceIncome, 'duration' | 'durationLabel'>) {
  if (input.durationLabel === 'Salida') {
    return DEFAULT_EXIT_DURATION_MINUTES
  }

  return Math.max(0, Math.floor(input.duration))
}

export function isServiceDurationLabel(
  value: string | undefined,
): value is ServiceDurationLabel {
  return SERVICE_DURATION_OPTIONS.some(
    (option) => option.durationLabel === value,
  )
}

export function getServiceDurationOption(
  durationLabel: ServiceDurationLabel,
) {
  return SERVICE_DURATION_OPTIONS.find(
    (option) => option.durationLabel === durationLabel,
  )
}

export function getNumericDurationLabel(
  durationMinutes: number,
): ServiceDurationLabel | undefined {
  const durationLabel = String(durationMinutes)

  return isServiceDurationLabel(durationLabel) && durationLabel !== 'Salida'
    ? durationLabel
    : undefined
}

export function getDurationDisplay(
  durationMinutes: number,
  durationLabel?: string,
  workedTimeUnit: WorkedTimeUnit = 'minutes',
) {
  if (durationLabel === 'Salida') {
    return 'Salida'
  }

  const displayMinutes = durationLabel?.trim() || String(durationMinutes)

  if (workedTimeUnit === 'hours') {
    const labeledDurationMinutes = Number(displayMinutes)
    return formatServiceDuration(
      Number.isFinite(labeledDurationMinutes)
        ? labeledDurationMinutes
        : durationMinutes,
      workedTimeUnit,
    )
  }

  return `${displayMinutes} minutos`
}

export function formatServiceDuration(
  durationMinutes: number,
  workedTimeUnit: WorkedTimeUnit,
) {
  if (workedTimeUnit === 'minutes') {
    return `${durationMinutes} ${durationMinutes === 1 ? 'minuto' : 'minutos'}`
  }

  const durationHours = durationMinutes / 60
  const formattedHours = new Intl.NumberFormat('es-ES', {
    maximumFractionDigits: 2,
  }).format(durationHours)

  return `${formattedHours} ${durationHours === 1 ? 'hora' : 'horas'}`
}

export function getIncomeDurationDisplay(
  income: Pick<
    ServiceIncome,
    | 'actualDuration'
    | 'duration'
    | 'durationLabel'
    | 'incomeCalculationMethod'
    | 'workedTime'
    | 'workedTimeUnit'
  >,
) {
  if (income.incomeCalculationMethod === 'hourly_workday') {
    const unitLabel = income.workedTimeUnit === 'hours' ? 'horas' : 'minutos'
    return `${income.workedTime ?? 0} ${unitLabel}`
  }

  return getDurationDisplay(
    getEffectiveFinancialDuration(income) ?? 0,
    income.durationLabel,
    income.workedTimeUnit,
  )
}
