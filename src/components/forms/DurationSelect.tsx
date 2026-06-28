const durationOptions = [
  { value: 15, label: '15 Min' },
  { value: 30, label: '30 Min' },
  { value: 60, label: '1 H' },
  { value: 120, label: '2H Salida' },
] as const

export const DEFAULT_DURATION_MINUTES = 60

interface DurationSelectProps {
  label?: string
  onChange: (duration: number) => void
  value: number
}

export function DurationSelect({
  label = 'Duración',
  onChange,
  value,
}: DurationSelectProps) {
  const isLegacyDuration = !durationOptions.some(
    (option) => option.value === value,
  )

  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        onChange={(event) => onChange(Number(event.target.value))}
        value={value}
      >
        {isLegacyDuration && (
          <option value={value}>{value} Min (registrada)</option>
        )}
        {durationOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
