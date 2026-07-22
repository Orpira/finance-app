import type { AIConversationMessage } from '../../intelligence/ai-conversation/message'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  readonly messages: readonly AIConversationMessage[]
  readonly isLoadingConversation: boolean
  readonly isSending: boolean
}

export function MessageList({
  messages,
  isLoadingConversation,
  isSending,
}: MessageListProps) {
  if (isLoadingConversation) {
    return (
      <section
        aria-live="polite"
        className="flex min-h-56 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        Cargando conversacion...
      </section>
    )
  }

  return (
    <section
      aria-label="Historial de mensajes"
      className="flex min-h-56 flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Escribe tu primer mensaje para iniciar la conversacion.
        </p>
      ) : (
        messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))
      )}

      {isSending ? (
        <p aria-live="polite" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Esperando respuesta del asistente...
        </p>
      ) : null}
    </section>
  )
}

export default MessageList
