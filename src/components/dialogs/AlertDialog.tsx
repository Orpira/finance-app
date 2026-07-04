import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react'
import { useRef, type ReactNode } from 'react'

import { DialogFrame } from './DialogFrame'
import type { AlertDialogOptions, AlertDialogType } from './useDialog'

interface AlertDialogProps {
  options: AlertDialogOptions
  open: boolean
  onAccept: () => void
}

const alertStyles: Record<AlertDialogType, { icon: ReactNode; className: string }> = {
  success: {
    icon: <CircleCheck className="size-6" aria-hidden="true" />,
    className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  },
  warning: {
    icon: <TriangleAlert className="size-6" aria-hidden="true" />,
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  },
  error: {
    icon: <CircleX className="size-6" aria-hidden="true" />,
    className: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  },
  info: {
    icon: <Info className="size-6" aria-hidden="true" />,
    className: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  },
}

export function AlertDialog({ options, open, onAccept }: AlertDialogProps) {
  const acceptButtonRef = useRef<HTMLButtonElement>(null)
  const type = options.type ?? 'info'
  const style = alertStyles[type]

  return (
    <DialogFrame
      actions={(
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          onClick={onAccept}
          ref={acceptButtonRef}
          type="button"
        >
          {options.acceptLabel ?? 'Aceptar'}
        </button>
      )}
      icon={options.icon ?? style.icon}
      iconClassName={style.className}
      initialFocusRef={acceptButtonRef}
      message={options.message}
      onCancel={onAccept}
      open={open}
      title={options.title}
    />
  )
}
