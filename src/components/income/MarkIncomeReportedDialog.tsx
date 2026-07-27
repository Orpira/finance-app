import { CheckCircle2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { DialogFrame } from '../dialogs/DialogFrame'
import { getTodayInputDate } from '../../utils/currency'

export interface MarkIncomeReportedValues {
  reportedAt: string
  reportReference?: string
  reportNotes?: string
}

interface MarkIncomeReportedDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: (values: MarkIncomeReportedValues) => void
}

export function MarkIncomeReportedDialog({
  open,
  title,
  message,
  confirmLabel = 'Marcar como reportado',
  onCancel,
  onConfirm,
}: MarkIncomeReportedDialogProps) {
  const dateInputRef = useRef<HTMLInputElement>(null)
  const [reportedAt, setReportedAt] = useState(getTodayInputDate)
  const [reportReference, setReportReference] = useState('')
  const [reportNotes, setReportNotes] = useState('')

  function handleConfirm() {
    onConfirm({
      reportedAt,
      reportReference: reportReference.trim() || undefined,
      reportNotes: reportNotes.trim() || undefined,
    })
  }

  return (
    <DialogFrame
      actions={(
        <>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            disabled={!reportedAt}
            onClick={handleConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </>
      )}
      icon={<CheckCircle2 className="size-6" aria-hidden="true" />}
      iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      initialFocusRef={dateInputRef}
      message={message}
      onCancel={onCancel}
      open={open}
      title={title}
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Fecha de reporte</span>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            max={getTodayInputDate()}
            onChange={(event) => setReportedAt(event.target.value)}
            ref={dateInputRef}
            required
            type="date"
            value={reportedAt}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Referencia <span className="font-normal text-slate-500">(opcional)</span>
          </span>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            maxLength={120}
            onChange={(event) => setReportReference(event.target.value)}
            placeholder="N.º de declaración, folio, etc."
            type="text"
            value={reportReference}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Nota <span className="font-normal text-slate-500">(opcional)</span>
          </span>
          <textarea
            className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            maxLength={500}
            onChange={(event) => setReportNotes(event.target.value)}
            placeholder="Observaciones sobre este reporte"
            value={reportNotes}
          />
        </label>
      </div>
    </DialogFrame>
  )
}

export default MarkIncomeReportedDialog
