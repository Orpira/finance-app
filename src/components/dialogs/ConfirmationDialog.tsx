import { CircleHelp } from 'lucide-react'
import { useRef } from 'react'

import { DialogFrame } from './DialogFrame'
import type { ConfirmationDialogOptions, DialogTone } from './useDialog'

interface ConfirmationDialogProps {
  options: ConfirmationDialogOptions
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

const confirmButtonClasses: Record<DialogTone, string> = {
  primary: 'bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-500',
  danger: 'bg-rose-700 text-white hover:bg-rose-800 focus:ring-rose-500',
  warning: 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500',
}

export function ConfirmationDialog({
  options,
  open,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const tone = options.confirmTone ?? 'primary'

  return (
    <DialogFrame
      actions={(
        <>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-900"
            onClick={onCancel}
            type="button"
          >
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${confirmButtonClasses[tone]}`}
            onClick={onConfirm}
            ref={confirmButtonRef}
            type="button"
          >
            {options.confirmLabel ?? 'Confirmar'}
          </button>
        </>
      )}
      icon={options.icon ?? <CircleHelp className="size-6" aria-hidden="true" />}
      iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      initialFocusRef={confirmButtonRef}
      message={options.message}
      onCancel={onCancel}
      open={open}
      title={options.title}
    />
  )
}
