import type { ActiveContext } from '../types/settings'

export function UsageModeBadge({ usageMode }: { usageMode: ActiveContext }) {
  const isProfessional = usageMode === 'professional'

  return (
    <span
      className={[
        'inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold',
        isProfessional
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
      ].join(' ')}
    >
      {isProfessional ? 'Profesional' : 'Personal'}
    </span>
  )
}
