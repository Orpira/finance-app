import type { ConversationUiMessage } from './conversationState'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  readonly messages: readonly ConversationUiMessage[]
  readonly isLoadingConversation: boolean
  readonly isSending: boolean
  readonly onConfirmProposal?: (input: {
    readonly messageId: string
    readonly edits: Readonly<Record<string, string | number | null>>
  }) => void
  readonly onCancelProposal?: (input: { readonly messageId: string }) => void
}

export function MessageList({
  messages,
  isLoadingConversation,
  isSending,
  onConfirmProposal,
  onCancelProposal,
}: MessageListProps) {
  if (isLoadingConversation) {
    return (
      <section
        aria-live="polite"
        className="flex min-h-56 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        Cargando conversación...
      </section>
    )
  }

  return (
    <section
      aria-label="Historial de mensajes"
      className="flex min-h-56 flex-col gap-3 py-2"
    >
      {messages.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">
          Escribe tu primer mensaje para iniciar la conversación.
        </p>
      ) : (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            onCancelProposal={onCancelProposal}
            onConfirmProposal={onConfirmProposal}
            proposalActionsDisabled={isSending}
          />
        ))
      )}

      {isSending ? (
        <p aria-live="polite" className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          El Copiloto está preparando la respuesta...
        </p>
      ) : null}
    </section>
  )
}

export default MessageList
