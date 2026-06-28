import type { ServiceIncome } from '../types/service'

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
  { durationMinutes: 120, durationLabel: 'Salida' },
]

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
    income.actualDuration ?? income.duration,
    income.durationLabel,
  )
}
