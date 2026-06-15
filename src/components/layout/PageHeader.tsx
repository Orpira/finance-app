import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  backLabel?: string
  backTo?: string
  eyebrow?: string
  children?: ReactNode
}

export function PageHeader({
  title,
  backLabel,
  backTo,
  eyebrow,
  children,
}: PageHeaderProps) {
  const navigate = useNavigate()

  function handleBack() {
    if (backTo) {
      navigate(backTo)
      return
    }

    navigate(-1)
  }

  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          {backLabel ? (
            <button
              className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md pr-2 text-base font-semibold text-emerald-700 transition hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:text-emerald-300 dark:hover:text-emerald-200 dark:focus:ring-offset-slate-950"
              onClick={handleBack}
              type="button"
            >
              <ArrowLeft className="size-5" aria-hidden="true" />
              <span>{backLabel}</span>
            </button>
          ) : null}

          <div className="flex flex-col gap-1">
            {eyebrow ? (
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="text-2xl font-semibold text-slate-950">{title}</h1>
          </div>
        </div>

        {children ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            {children}
          </div>
        ) : null}
      </div>
    </header>
  )
}

export default PageHeader
