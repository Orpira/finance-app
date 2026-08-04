import { CheckCircle2, Target } from 'lucide-react'

import type { SeasonGoalProgress } from '../../services/earningPeriodService'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { SensitiveAmount } from '../SensitiveAmount'

interface SeasonGoalCardProps {
  currency: CurrencyCode
  hidden?: boolean
  plannedEndDate?: string
  progress: SeasonGoalProgress
}

function formatDate(value?: string) {
  if (!value) return null
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

export function SeasonGoalCard({
  currency,
  hidden = false,
  plannedEndDate,
  progress,
}: SeasonGoalCardProps) {
  const plannedDate = formatDate(plannedEndDate)
  const displayPercentage = Math.round(progress.percentage)

  return (
    <article
      className={[
        'rounded-lg border p-5 shadow-sm',
        progress.completed
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
      ].join(' ')}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
            {progress.completed ? <CheckCircle2 className="size-5" aria-hidden="true" /> : <Target className="size-5" aria-hidden="true" />}
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Meta de la temporada</h2>
            {plannedDate && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Finalización prevista: {plannedDate}</p>}
          </div>
        </div>
        {progress.completed && (
          <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">
            Objetivo conseguido
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Meta', progress.goal],
          ['Alcanzado', progress.achieved],
          ['Progreso', `${displayPercentage} %`],
          ['Restante', progress.remaining],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 font-semibold text-slate-950 dark:text-white">
              {typeof value === 'number' ? (
                <SensitiveAmount hidden={hidden} value={formatCurrency(value, currency)} />
              ) : value}
            </p>
          </div>
        ))}
      </div>

      <div
        aria-label={`${displayPercentage} % de la meta alcanzado`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.min(Math.max(displayPercentage, 0), 100)}
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-emerald-600"
          style={{ width: `${Math.min(Math.max(progress.percentage, 0), 100)}%` }}
        />
      </div>
    </article>
  )
}