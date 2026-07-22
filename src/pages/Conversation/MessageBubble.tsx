import type { AIConversationMessage } from '../../intelligence/ai-conversation/message'

interface MessageBubbleProps {
  readonly message: AIConversationMessage
}

function resolveTone(role: AIConversationMessage['role']): string {
  if (role === 'USER') {
    return 'self-end border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
  }
  if (role === 'ASSISTANT') {
    return 'self-start border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
  }
  return 'self-start border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
}

function resolveRoleLabel(role: AIConversationMessage['role']): string {
  if (role === 'USER') {
    return 'Usuario'
  }
  if (role === 'ASSISTANT') {
    return 'Asistente'
  }
  return 'Sistema'
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content.value}</p>
    </article>
  )
}

export default MessageBubble
