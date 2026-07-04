import { PencilLine } from 'lucide-react'
import { useId, useRef, useState, type FormEvent } from 'react'

import { DialogFrame } from './DialogFrame'
import type { PromptDialogOptions } from './useDialog'

interface PromptDialogProps {
  options: PromptDialogOptions
  open: boolean
  onConfirm: (value: string) => void
  onCancel: () => void
}

export function PromptDialog({ options, open, onConfirm, onCancel }: PromptDialogProps) {
  const [value, setValue] = useState(options.initialValue ?? '')
  const [validationError, setValidationError] = useState('')
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const formId = useId()
  const inputId = useId()
  const errorId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const error = options.validate?.(value)
    if (error) {
      setValidationError(error)
      return
    }

    onConfirm(value)
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
            {options.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
            form={formId}
            ref={confirmButtonRef}
            type="submit"
          >
            {options.confirmLabel ?? 'Confirmar'}
          </button>
        </>
      )}
      icon={options.icon ?? <PencilLine className="size-6" aria-hidden="true" />}
      iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      initialFocusRef={confirmButtonRef}
      message={options.message}
      onCancel={onCancel}
      open={open}
      title={options.title}
    >
      <form id={formId} onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={inputId}>
          {options.title}
        </label>
        <input
          aria-describedby={validationError ? errorId : undefined}
          aria-invalid={Boolean(validationError)}
          className="h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          id={inputId}
          inputMode={options.inputMode ?? 'text'}
          onChange={(event) => {
            setValue(event.target.value)
            setValidationError('')
          }}
          placeholder={options.placeholder}
          value={value}
        />
        {validationError && (
          <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-300" id={errorId}>
            {validationError}
          </p>
        )}
      </form>
    </DialogFrame>
  )
}
