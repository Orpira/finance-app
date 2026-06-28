import {
  SERVICE_DURATION_OPTIONS,
  type ServiceDurationLabel,
} from '../../utils/serviceDuration'

interface ServiceDurationSelectProps {
  onChange: (durationLabel: ServiceDurationLabel) => void
  value: ServiceDurationLabel | ''
}

export function ServiceDurationSelect({
  onChange,
  value,
}: ServiceDurationSelectProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">
        Duración (Minutos)
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
        {SERVICE_DURATION_OPTIONS.map((option) => (
          <option key={option.durationLabel} value={option.durationLabel}>
            {option.durationLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
