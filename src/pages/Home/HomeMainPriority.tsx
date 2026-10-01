import { ListChecks } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { FinancialCopilotPriority } from '../../intelligence/deterministic-copilot'

interface HomeMainPriorityProps {
  priorities: readonly FinancialCopilotPriority[]
}

export function HomeMainPriority({ priorities }: HomeMainPriorityProps) {
  const priority = priorities[0]

  if (!priority) return null

  return (
    <section aria-labelledby="main-priority-title" className="order-1">
      <h2
        className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200"
        id="main-priority-title"
      >
        <ListChecks className="size-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
        Prioridad principal
      </h2>
      <article className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
          {priority.message}
        </p>
        <Link
          className="shrink-0 rounded-sm text-xs font-semibold text-amber-800 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 dark:text-amber-200"
          to={priority.action.to}
        >
          {priority.action.label}
        </Link>
      </article>
    </section>
  )
}
