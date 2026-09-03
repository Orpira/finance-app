import { Plus, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import type { UsageMode } from '../../types/settings'
import { getFloatingCreateActions } from './floatingCreateActions'

export function FloatingCreateMenu({ usageMode }: { usageMode: UsageMode }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const actions = getFloatingCreateActions(usageMode)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-60 md:bottom-6 md:right-6"
      ref={containerRef}
    >
      {isOpen && (
        <div
          aria-label="Crear nuevo"
          className="absolute bottom-14 right-0 grid min-w-52 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          id={menuId}
          role="menu"
        >
          {actions.map(({ icon: Icon, label, path }) => (
            <Link
              className="flex h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
              key={path}
              onClick={() => setIsOpen(false)}
              role="menuitem"
              to={path}
            >
              <Icon className="size-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      )}

      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Cerrar menú de creación' : 'Crear nuevo'}
        className="inline-flex size-12 items-center justify-center rounded-full border border-slate-200 bg-white text-emerald-700 shadow-lg transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-emerald-300 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        title={isOpen ? 'Cerrar menú de creación' : 'Crear nuevo'}
        type="button"
      >
        {isOpen ? (
          <X className="size-5" aria-hidden="true" />
        ) : (
          <Plus className="size-5" aria-hidden="true" />
        )}
      </button>
    </div>
  )
}

export default FloatingCreateMenu