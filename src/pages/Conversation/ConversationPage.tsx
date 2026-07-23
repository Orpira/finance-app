import { useMemo } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { ConversationHeader } from './ConversationHeader'
import { createConversationControllerDependencies } from './conversationComposition'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { useConversation } from './useConversation'

export function ConversationPage() {
  const dependencies = useMemo(
    () => createConversationControllerDependencies(),
    [],
  )
  const { state, sendMessage } = useConversation(dependencies)

  // Temporal: traza sanitizada para auditar recepción de estado en render React.
  console.info('[ConversationTrace]', 'react.render.received', {
    status: state.status,
    sessionId: state.session?.sessionId ?? null,
    messageCount: state.messages.length,
    hasError: state.errorMessage !== null,
  })

  const isLoadingConversation =
    state.status === 'idle' ||
    state.status === 'loading' ||
    state.status === 'loading-memory'
  const isSending =
    state.status === 'sending' ||
    state.status === 'receiving' ||
    state.status === 'saving-memory' ||
    state.status === 'deleting-memory'

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <PageHeader
        backLabel="Mas"
        backTo="/more"
        eyebrow="AI Conversation"
        title="Preview conversacional"
      />

      <ConversationHeader isSending={isSending} session={state.session} />

      {state.errorMessage ? (
        <div
          aria-live="assertive"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          role="alert"
        >
          {state.errorMessage}
        </div>
      ) : null}

      <MessageList
        isLoadingConversation={isLoadingConversation}
        isSending={isSending}
        messages={state.messages}
      />

      <MessageComposer
        disabled={isLoadingConversation || isSending || state.session === null}
        onSend={sendMessage}
      />
    </section>
  )
}

export default ConversationPage
