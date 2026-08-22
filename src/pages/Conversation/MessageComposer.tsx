import { useRef, useState } from 'react'

import { QUICK_SUGGESTIONS } from './quickSuggestions'

interface MessageComposerProps {
  readonly disabled?: boolean
  readonly onSend: (message: string) => Promise<void>
}

export function MessageComposer({ disabled = false, onSend }: MessageComposerProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  function applySuggestion(suggestion: string) {
    setValue(suggestion)
    textareaRef.current?.focus()
  }

  return (
    <form className="grid gap-3" onSubmit={(event) => void handleSubmit(event)}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Sugerencias rápidas">
        {QUICK_SUGGESTIONS.map((suggestion) => (
          <button
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-emerald-800 dark:hover:text-emerald-300"
            disabled={disabled}
            key={suggestion}
            onClick={() => applySuggestion(suggestion)}
            type="button"
          >
            {suggestion}
          </button>
        ))}
      </div>

      <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200" htmlFor="conversation-message-input">
        Mensaje
        <textarea
          aria-label="Mensaje para el Copiloto"
          className="min-h-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          disabled={disabled}
          id="conversation-message-input"
          onChange={(event) => setValue(event.target.value)}
          placeholder="Escribe tu mensaje... por ejemplo: «Hoy recibí 120 euros por un servicio»"
          ref={textareaRef}
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

      <p className="text-xs text-slate-400 dark:text-slate-500">
        El Copiloto propone; tú confirmas. Ningún ingreso, gasto o cita se guarda sin que lo revises antes.
      </p>
    </form>
  )
}

export default MessageComposer
