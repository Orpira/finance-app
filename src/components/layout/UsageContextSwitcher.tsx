import { BriefcaseBusiness, House } from 'lucide-react'

import { setActiveContext } from '../../services/settingsService'
import type { ActiveContext } from '../../types/settings'

interface UsageContextSwitcherProps {
  activeContext: ActiveContext
  onSwitched: (nextContext: ActiveContext) => void
  className?: string
}

const OPTIONS: Array<{ value: ActiveContext; label: string; icon: typeof House }> = [
  { value: 'basic', label: 'Personal', icon: House },
  { value: 'professional', label: 'Profesional', icon: BriefcaseBusiness },
]

/**
 * Visible only for Híbrido installations (`usageMode === 'hybrid'`). Lets the
 * user switch which workspace (Personal/Profesional) is active — never
 * merges, converts or moves records between them, it only changes which one
 * is currently being viewed/written to (PB usage-modes spec, sección 7).
 */
export function UsageContextSwitcher({
  activeContext,
  onSwitched,
  className,
}: UsageContextSwitcherProps) {
  async function handleSwitch(next: ActiveContext) {
    if (next === activeContext) return

    try {
      await setActiveContext(next)
      onSwitched(next)
    } catch (error) {
      console.warn('No se pudo cambiar de espacio.', error)
    }
  }

  return (
    <div
      className={[
        'inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-900',
        className ?? '',
      ].join(' ')}
      role="group"
      aria-label="Espacio activo"
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const isActive = value === activeContext
        return (
          <button
            key={value}
            aria-pressed={isActive}
            className={[
              'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive
                ? value === 'professional'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-sky-600 text-white'
                : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800',
            ].join(' ')}
            onClick={() => handleSwitch(value)}
            type="button"
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
