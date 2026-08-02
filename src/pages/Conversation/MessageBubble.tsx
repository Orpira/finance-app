import { AssistantProposalCard } from './AssistantProposalCard'
import type { ConversationUiMessage } from './conversationState'

interface MessageBubbleProps {
  readonly message: ConversationUiMessage
  readonly proposalActionsDisabled?: boolean
  readonly onConfirmProposal?: (input: {
    readonly messageId: string
    readonly edits: Readonly<Record<string, string | number | null>>
  }) => void
  readonly onCancelProposal?: (input: { readonly messageId: string }) => void
}

function resolveTone(role: ConversationUiMessage['role']): string {
  if (role === 'USER') {
    return 'self-end border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
  }
  if (role === 'ASSISTANT') {
    return 'self-start border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
  }
  return 'self-start border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
}

function resolveRoleLabel(role: ConversationUiMessage['role']): string {
  if (role === 'USER') {
    return 'Usuario'
  }
  if (role === 'ASSISTANT') {
    return 'Asistente'
  }
  return 'Sistema'
}

function responseTypeLabel(type: ConversationUiMessage['responseType']): string | null {
  if (type === 'local-calculation') return 'Cálculo local'
  if (type === 'deterministic-explanation') return 'Explicación determinista'
  if (type === 'pending-proposal') return 'Propuesta pendiente'
  if (type === 'executed-action') return 'Acción ejecutada'
  return null
}

export function MessageBubble({
  message,
  proposalActionsDisabled = false,
  onConfirmProposal,
  onCancelProposal,
}: MessageBubbleProps) {
  return (
    <article
      aria-label={`Mensaje de ${resolveRoleLabel(message.role)}`}
      className={[
        'max-w-[85%] rounded-lg border px-3 py-2 shadow-sm',
        resolveTone(message.role),
      ].join(' ')}
    >
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {resolveRoleLabel(message.role)}
      </p>
      {responseTypeLabel(message.responseType) ? (
        <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {responseTypeLabel(message.responseType)}
        </p>
      ) : null}
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.text}</p>

      {message.proposal ? (
        <AssistantProposalCard
          disabled={proposalActionsDisabled}
          onCancel={() => onCancelProposal?.({ messageId: message.id })}
          onConfirm={(edits) => onConfirmProposal?.({ messageId: message.id, edits })}
          proposal={message.proposal}
        />
      ) : null}
    </article>
  )
}

export default MessageBubble
