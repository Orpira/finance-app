import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'

interface CollapsibleFiltersProps {
  title?: string
  children: ReactNode
  defaultOpen?: boolean
  storageKey?: string
}

export function CollapsibleFilters({
  title = 'Filtros',
  children,
  defaultOpen = false,
  storageKey,
}: CollapsibleFiltersProps) {
  const contentId = useId()
  const [isOpen, setIsOpen] = useState(() => {
    if (!storageKey || typeof window === 'undefined') {
      return defaultOpen
    }

    const storedValue = window.localStorage.getItem(storageKey)

    return storedValue ? storedValue === 'true' : defaultOpen
  })
  const Icon = isOpen ? ChevronUp : ChevronDown

  useEffect(() => {
    if (storageKey) {
      window.localStorage.setItem(storageKey, String(isOpen))
    }
  }, [isOpen, storageKey])

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <button
        aria-controls={contentId}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 dark:hover:bg-slate-800"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold text-slate-950">{title}</span>
            <span className="text-sm text-slate-500">
              {isOpen ? 'Ocultar filtros' : 'Mostrar filtros'}
            </span>
          </span>
        </span>
        <Icon className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
      </button>

      <div
        className={[
          'grid transition-[grid-template-rows] duration-300 ease-in-out',
          isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ].join(' ')}
      >
        <div id={contentId} className="min-h-0 overflow-hidden">
          <div className="border-t border-slate-200 p-4 dark:border-slate-800">
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

export default CollapsibleFilters
