import { useId, useRef, type FormEvent, type ReactNode } from 'react'

import { DialogFrame } from '../../dialogs/DialogFrame'

interface GeoFormDialogProps {
  title: string
  message?: string
  icon: ReactNode
  submitLabel: string
  tone?: 'primary' | 'warning' | 'danger'
  busy?: boolean
  error?: string
  onCancel: () => void
  onSubmit: () => void
  children: ReactNode
}

const toneClassName = {
  primary: 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-500',
  warning: 'bg-amber-700 hover:bg-amber-800 focus:ring-amber-500',
  danger: 'bg-rose-700 hover:bg-rose-800 focus:ring-rose-500',
}

const iconToneClassName = {
  primary: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
}

export const geoInputClassName =
  'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-950 dark:text-white'

/**
 * Diálogo de formulario sobre DialogFrame (foco atrapado, Escape, hoja
 * inferior en móvil). Se monta solo mientras está abierto.
 */
export function GeoFormDialog({
  title,
  message,
  icon,
  submitLabel,
  tone = 'primary',
  busy = false,
  error,
  onCancel,
  onSubmit,
  children,
}: GeoFormDialogProps) {
  const formId = useId()
  const firstFieldRef = useRef<HTMLButtonElement>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!busy) onSubmit()
  }

  return (
    <DialogFrame
      actions={(
        <>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            disabled={busy}
            onClick={onCancel}
            ref={firstFieldRef}
            type="button"
          >
            Cancelar
          </button>
          <button
            className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${toneClassName[tone]}`}
            disabled={busy}
            form={formId}
            type="submit"
          >
            {busy ? 'Guardando...' : submitLabel}
          </button>
        </>
      )}
      icon={icon}
      iconClassName={iconToneClassName[tone]}
      initialFocusRef={firstFieldRef}
      message={message}
      onCancel={busy ? () => undefined : onCancel}
      open
      title={title}
    >
      <form className="grid gap-4" id={formId} onSubmit={handleSubmit}>
        {children}
        {error && (
          <p className="rounded-md bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-200" role="alert">
            {error}
          </p>
        )}
      </form>
    </DialogFrame>
  )
}
