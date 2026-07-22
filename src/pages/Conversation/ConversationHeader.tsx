import type { AIConversationSessionSnapshot } from '../../intelligence/ai-conversation/session'

interface ConversationHeaderProps {
  readonly session: AIConversationSessionSnapshot | null
  readonly isSending: boolean
}

function resolveStatusLabel(input: {
  readonly session: AIConversationSessionSnapshot | null
  readonly isSending: boolean
}): string {
  if (input.isSending) {
    return 'Procesando respuesta...'
  }

  if (!input.session) {
    return 'Sin sesion activa'
  }

  const interactionState = input.session.interaction?.lifecycleState
  if (interactionState) {
    return `Interaccion: ${interactionState}`
  }

  return `Sesion: ${input.session.status}`
}

export function ConversationHeader({ session, isSending }: ConversationHeaderProps) {
  const statusLabel = resolveStatusLabel({
    session,
    isSending,
  })

  return (
    <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">AI Conversation</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-950 dark:text-white">Conversacion</h1>
      <p aria-live="polite" className="mt-2 text-sm text-slate-500 dark:text-slate-300">
        {statusLabel}
      </p>
    </header>
  )
}

export default ConversationHeader
