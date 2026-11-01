import {
  SERVICE_DURATION_OPTIONS,
  formatServiceDuration,
  type ServiceDurationLabel,
} from '../../utils/serviceDuration'
import type { WorkedTimeUnit } from '../../catalogs/incomeCalculationMethods'

interface ServiceDurationSelectProps {
  onChange: (durationLabel: ServiceDurationLabel) => void
  customMinutes?: number
  onCustomMinutesChange?: (minutes: number) => void
  unit?: WorkedTimeUnit
  value: ServiceDurationLabel | ''
}

export function ServiceDurationSelect({
  onChange,
  customMinutes,
  onCustomMinutesChange,
  unit = 'minutes',
  value,
}: ServiceDurationSelectProps) {
  return (
    <div className="flex flex-col gap-2">
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">
        Duración ({unit === 'hours' ? 'Horas' : 'Minutos'})
      </span>
      <select
        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) =>
          onChange(event.target.value as ServiceDurationLabel)
        }
        required
        value={value}
      >
        <option disabled value="">
          Selecciona una duración
        </option>
        {SERVICE_DURATION_OPTIONS.filter((option) => onCustomMinutesChange
          ? option.durationLabel !== 'Salida' && option.durationLabel !== '120'
          : option.durationLabel !== '45').map((option) => (
          <option key={option.durationLabel} value={option.durationLabel}>
            {option.durationLabel === 'Salida'
              ? option.durationLabel
              : formatServiceDuration(option.durationMinutes, unit)}
          </option>
        ))}
        {onCustomMinutesChange && <option value="Personalizado">Personalizado</option>}
      </select>
    </label>
    {onCustomMinutesChange && value === 'Personalizado' && (
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">Duración personalizada (minutos)</span>
        <input
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          required
          value={customMinutes || ''}
          onChange={(event) => onCustomMinutesChange(Number(event.target.value))}
        />
      </label>
    )}
    </div>
  )
}
