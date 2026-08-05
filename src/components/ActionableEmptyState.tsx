import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

type EmptyStateAction =
  | { readonly label: string; readonly to: string; readonly onClick?: never }
  | { readonly label: string; readonly onClick: () => void; readonly to?: never }

interface ActionableEmptyStateProps {
  readonly title: string
  readonly description: string
  readonly action: EmptyStateAction
  readonly compact?: boolean
}

export function ActionableEmptyState({
  title,
  description,
  action,
  compact = false,
}: ActionableEmptyStateProps) {
  const actionClassName =
    'inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950'

  return (
    <div
      className={compact ? 'flex flex-col gap-3' : 'flex flex-col gap-3 p-4'}
      role="status"
    >
      <div>
        <p className="font-semibold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      {'to' in action && action.to ? (
        <Link className={actionClassName} to={action.to}>
          {action.label}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <button
          className={actionClassName}
          onClick={action.onClick}
          type="button"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}