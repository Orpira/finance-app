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
  }
}
