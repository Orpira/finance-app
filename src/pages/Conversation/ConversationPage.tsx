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

  const isLoadingConversation =
    state.status === 'idle' ||
    state.status === 'loading'
  const isSending =
    state.status === 'sending'

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-2">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Private Balance"
        title="Asistente"
      />

      <ConversationHeader isSending={isSending} status={state.status} />

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
        disabled={isLoadingConversation || isSending}
        onSend={sendMessage}
      />
    </section>
  )
}

export default ConversationPage
