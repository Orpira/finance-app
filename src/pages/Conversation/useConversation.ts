import { useEffect, useMemo, useState } from 'react'

import {
  createConversationController,
  type ConversationControllerDependencies,
} from './conversationController'
import {
  createInitialConversationUiState,
  type ConversationUiState,
} from './conversationState'

export interface ConversationHookResult {
  readonly state: ConversationUiState
  readonly sendMessage: (message: string) => Promise<void>
  readonly confirmProposal: (input: {
    readonly messageId: string
    readonly edits?: Readonly<Record<string, string | number | null>>
  }) => Promise<void>
  readonly cancelProposal: (input: { readonly messageId: string }) => void
  readonly clearContext: () => void
  readonly removeContextFilter: (filter: 'period' | 'currency' | 'category') => void
}

export function useConversation(
  dependencies: ConversationControllerDependencies,
): ConversationHookResult {
  const controller = useMemo(
    () => createConversationController(dependencies),
    [dependencies],
  )

  const [state, setState] = useState<ConversationUiState>(
    createInitialConversationUiState(),
  )

  useEffect(() => {
    const unsubscribe = controller.subscribe((nextState) => {
      setState(nextState)
    })

    void controller.initialize()

    return () => {
      unsubscribe()
      controller.dispose()
    }
  }, [controller])

  return {
    state,
    sendMessage: (message) => controller.sendMessage(message),
    confirmProposal: (input) => controller.confirmProposal(input),
    cancelProposal: (input) => controller.cancelProposal(input),
    clearContext: () => controller.clearContext(),
    removeContextFilter: (filter) => controller.removeContextFilter(filter),
  }
}
