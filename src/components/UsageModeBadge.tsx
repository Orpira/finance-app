import type { UsageMode } from '../types/settings'

export function UsageModeBadge({ usageMode }: { usageMode: UsageMode }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
      Modo {usageMode === 'professional' ? 'Profesional' : 'Básico'}
    </span>
  )
}
