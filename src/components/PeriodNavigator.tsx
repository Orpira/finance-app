import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PeriodNavigatorProps {
  readonly canMove?: boolean
  readonly label: string
  readonly navigationLabel?: string
  readonly onLabelClick?: () => void
  readonly onNext: () => void
  readonly onPrevious: () => void
}

export function PeriodNavigator({
  canMove = true,
  label,
  navigationLabel = 'Navegación del período',
  onLabelClick,
  onNext,
  onPrevious,
}: PeriodNavigatorProps) {
  const sideButtonClassName =
    'flex size-11 items-center justify-center text-slate-600 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <div
      aria-label={navigationLabel}
      className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <button
        aria-label="Período anterior"
        className={sideButtonClassName}
        disabled={!canMove}
        onClick={onPrevious}
        title="Período anterior"
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </button>
      {onLabelClick ? (
        <button
          className="min-w-0 self-stretch px-2 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 dark:text-slate-100"
          onClick={onLabelClick}
          type="button"
        >
          <span className="block truncate">{label}</span>
        </button>
      ) : (
        <span className="block min-w-0 truncate px-2 text-center text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </span>
      )}
      <button
        aria-label="Período siguiente"
        className={sideButtonClassName}
        disabled={!canMove}
        onClick={onNext}
        title="Período siguiente"
        type="button"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </button>
    </div>
  )
}

export default PeriodNavigator