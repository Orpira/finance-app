import { Info } from 'lucide-react'
import { useRef } from 'react'

import { DialogFrame } from './DialogFrame'

export interface RecordDetailItem {
  key?: number
  title: string
  detail: string
}

export interface RecordDetailRequest {
  title: string
  items: RecordDetailItem[]
}

interface RecordDetailDialogProps {
  request: RecordDetailRequest
  open: boolean
  onClose: () => void
}

/**
 * Ventana emergente de solo consulta para mostrar el detalle de registros
 * (ingresos de un día, egresos de una categoría, etc.) sin navegar a otra
 * pantalla. Reutilizada por SeasonDetailPage y BestDaysHistoryPage.
 */
export function RecordDetailDialog({ request, open, onClose }: RecordDetailDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  return (
    <DialogFrame
      actions={(
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-900"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
        >
          Cerrar
        </button>
      )}
      icon={<Info className="size-6" aria-hidden="true" />}
      iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
      initialFocusRef={closeButtonRef}
      onCancel={onClose}
      open={open}
      title={request.title}
    >
      {request.items.length ? (
        <ul className="max-h-[60dvh] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {request.items.map((item, index) => (
            <li className="py-2 text-sm" key={item.key ?? index}>
              <p className="font-medium text-slate-950 dark:text-white">{item.title}</p>
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">{item.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sin registros.</p>
      )}
    </DialogFrame>
  )
}
