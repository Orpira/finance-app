import { ArrowDownLeft, ArrowUpRight, Plus } from 'lucide-react'
import { useRef } from 'react'
import { Link } from 'react-router-dom'

import { DialogFrame } from '../../components/dialogs/DialogFrame'

interface MovementCreateSheetProps {
  readonly onCancel: () => void
}

export function MovementCreateSheet({ onCancel }: MovementCreateSheetProps) {
  const incomeRef = useRef<HTMLAnchorElement>(null)

  return (
    <DialogFrame
      actions={(
        <button
          className="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
      )}
      icon={<Plus aria-hidden="true" className="size-5" />}
      iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      initialFocusRef={incomeRef}
      onCancel={onCancel}
      open
      title="Registrar movimiento"
    >
      <div className="grid gap-2">
        <Link
          className="flex min-h-16 items-center gap-3 rounded-md border border-emerald-200 px-3 text-left transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-900 dark:hover:bg-emerald-950"
          ref={incomeRef}
          to="/income/nuevo"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ArrowUpRight aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">Ingreso</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Registrar una entrada de dinero</span>
          </span>
        </Link>
        <Link
          className="flex min-h-16 items-center gap-3 rounded-md border border-rose-200 px-3 text-left transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-900 dark:hover:bg-rose-950"
          to="/expenses/nuevo"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
            <ArrowDownLeft aria-hidden="true" className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950 dark:text-white">Gasto</span>
            <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Registrar una salida de dinero</span>
          </span>
        </Link>
      </div>
    </DialogFrame>
  )
}

export default MovementCreateSheet