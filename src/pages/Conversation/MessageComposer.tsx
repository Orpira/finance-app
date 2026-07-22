import { useState } from 'react'

interface MessageComposerProps {
  readonly disabled?: boolean
  readonly onSend: (message: string) => Promise<void>
}

export function MessageComposer({ disabled = false, onSend }: MessageComposerProps) {
  const [value, setValue] = useState('')

  const trimmedValue = value.trim()
  const submitDisabled = disabled || trimmedValue.length === 0

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitDisabled) {
      return
    }

    const nextMessage = trimmedValue
    setValue('')

    await onSend(nextMessage)
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
      <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="conversation-message-input">
        Mensaje
        <textarea
          aria-label="Mensaje para el asistente"
          className="min-h-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          id="conversation-message-input"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Escribe tu mensaje..."
          value={value}
        />
      </label>

      <button
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitDisabled}
        type="submit"
      >
        Enviar
      </button>
    </form>
  )
}

export default MessageComposer
