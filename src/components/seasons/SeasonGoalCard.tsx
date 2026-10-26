import { CheckCircle2, Target } from 'lucide-react'

import type { SeasonGoalProgress } from '../../services/earningPeriodService'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { SensitiveAmount } from '../SensitiveAmount'
import { formatCivilDate } from './geo/stayPresentation'

interface SeasonGoalCardProps {
  currency: CurrencyCode
  hidden?: boolean
  plannedEndDate?: string
  progress: SeasonGoalProgress
  /**
   * PB-GEO-002: progreso contra el objetivo original, calculado con el mismo
   * resultado financiero (getSeasonGoalProgress). Solo se muestra si difiere.
   */
  originalProgress?: SeasonGoalProgress | null
  /** 'migration_baseline' indica que el original es el valor conocido al migrar. */
  originalSource?: 'season_creation' | 'migration_baseline'
}

// plannedEndDate se guarda como `YYYY-MM-DDT23:59:59.999Z` (fecha civil con hora
// UTC sintética): se formatea la fecha civil para no desplazarla un día.
function formatDate(value?: string) {
  if (!value) return null
  return formatCivilDate(value.slice(0, 10))
}

export function SeasonGoalCard({
  currency,
  hidden = false,
  plannedEndDate,
  progress,
  originalProgress,
  originalSource,
}: SeasonGoalCardProps) {
  const showOriginal = Boolean(originalProgress && originalProgress.goal !== progress.goal)
  const plannedDate = formatDate(plannedEndDate)
  const displayPercentage = Math.round(progress.percentage)
  const displayedExpenses = progress.expenses > 0 ? -progress.expenses : 0
  const visualPercentage = Math.min(Math.max(displayPercentage, 0), 100)

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
            Meta alcanzada
          </span>
        )}
      </div>

      <div className="mt-5">
        <p className="text-xs text-slate-500 dark:text-slate-400">Resultado</p>
        <p className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">
          <SensitiveAmount hidden={hidden} value={formatCurrency(progress.result, currency)} />
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Progreso', `${displayPercentage} %`],
          ['Meta', progress.goal],
          ['Ingresos netos', progress.netIncome],
          ['Egresos', displayedExpenses],
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
        aria-label={`${displayPercentage} % de progreso de la meta`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={visualPercentage}
        className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
      >
        <div
          className="h-full rounded-full bg-emerald-600"
          style={{ width: `${Math.min(Math.max(progress.percentage, 0), 100)}%` }}
        />
      </div>

      {showOriginal && originalProgress && (
        <p className="mt-3 rounded-md bg-slate-50 p-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {originalSource === 'migration_baseline' ? 'Objetivo conocido al actualizar la app' : 'Objetivo original'}:{' '}
          <SensitiveAmount hidden={hidden} value={formatCurrency(originalProgress.goal, currency)} />
          {' · '}{Math.round(originalProgress.percentage)} % de progreso. El objetivo vigente es el que se muestra arriba.
        </p>
      )}

      <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
        {progress.exceeded > 0 ? (
          <>Meta superada en <SensitiveAmount hidden={hidden} value={formatCurrency(progress.exceeded, currency)} /></>
        ) : progress.completed ? (
          'Meta alcanzada'
        ) : (
          <>Faltan <SensitiveAmount hidden={hidden} value={formatCurrency(progress.remaining, currency)} /></>
        )}
      </p>
    </article>
  )
}