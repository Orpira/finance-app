import type { ConversationUiStatus } from './conversationState'

interface ConversationHeaderProps {
  readonly status: ConversationUiStatus
  readonly isSending: boolean
}

function resolveStatusLabel(input: {
  readonly status: ConversationUiStatus
  readonly isSending: boolean
}): string {
  if (input.isSending) {
    return 'Procesando respuesta...'
  }

  if (input.status === 'error') {
    return 'Error de procesamiento conversacional'
  }

  if (input.status === 'loading') {
    return 'Preparando conversación...'
  }

  return 'Puedes escribir en lenguaje natural: ingresos, gastos, citas o consultas.'
}

export function ConversationHeader({ status, isSending }: ConversationHeaderProps) {
  const statusLabel = resolveStatusLabel({
    status,
    isSending,
  })

  return (
    <p aria-live="polite" className="text-sm text-slate-500 dark:text-slate-400">
      {statusLabel}
    </p>
  )
}

export default ConversationHeader
