import { BriefcaseBusiness } from 'lucide-react'

/**
 * Shown at the top of the professional setup steps (work mode, season,
 * currency) only when the user picked Híbrido, to make clear these choices
 * configure the Profesional workspace only — Personal starts untouched and
 * is configured separately, later, from its own space.
 */
export function HybridWorkspaceBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-left dark:border-emerald-900 dark:bg-emerald-950/40">
      <BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
      <div>
        <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
          Configura tu espacio Profesional
        </p>
        <p className="mt-0.5 text-xs text-emerald-800 dark:text-emerald-200">
          Las siguientes opciones se utilizarán únicamente para tu actividad profesional y no afectarán al espacio Personal.
        </p>
      </div>
    </div>
  )
}
