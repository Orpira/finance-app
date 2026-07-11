import type { ServiceIncome } from '../types/service'
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
}

/** Preserves the stored-duration precedence used by financial summaries. */
export function getEffectiveFinancialDuration(
  input: EffectiveFinancialDurationInput,
) {
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
) {
  if (durationLabel === 'Salida') {
    return 'Salida'
  }

  const displayMinutes = durationLabel?.trim() || String(durationMinutes)
  return `${displayMinutes} minutos`
}

export function getIncomeDurationDisplay(
  income: Pick<ServiceIncome, 'actualDuration' | 'duration' | 'durationLabel'>,
) {
  return getDurationDisplay(
    getEffectiveFinancialDuration(income) ?? 0,
    income.durationLabel,
  )
}
