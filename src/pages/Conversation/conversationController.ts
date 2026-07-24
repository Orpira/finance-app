import type { ChatMessage } from '../../intelligence/mock-conversational-renderer/mockConversationalRenderer'
import {
  createInitialConversationUiState,
  type ConversationUiMessage,
  type ConversationUiState,
} from './conversationState'

export interface ConversationControllerDependencies {
  readonly pipeline: {
    generateAssistantMessage(input: {
      readonly userMessage: string
      readonly turn: number
    }): Promise<
      | { readonly kind: 'success'; readonly message: ChatMessage }
      | { readonly kind: 'failure'; readonly code: string; readonly safeMessage: string }
    >
  }
  readonly now?: () => string
}

export interface ConversationController {
  getState(): ConversationUiState
  subscribe(listener: (state: ConversationUiState) => void): () => void
  initialize(): Promise<void>
  sendMessage(message: string): Promise<void>
  dispose(): void
}

function toAssistantErrorMessage(safeMessage: string): string {
  const detail = safeMessage.trim()
  if (detail.length === 0) {
    return 'No fue posible procesar la solicitud.'
  }

  return `No fue posible procesar la solicitud.\n\n${detail}`
}

function createUserMessage(input: {
  readonly id: string
  readonly text: string
  readonly createdAt: string
}): ConversationUiMessage {
  return {
    id: input.id,
    role: 'USER',
    text: input.text,
    createdAt: input.createdAt,
  }
}

function createAssistantMessage(input: {
  readonly id: string
  readonly text: string
  readonly createdAt: string
}): ConversationUiMessage {
  return {
    id: input.id,
    role: 'ASSISTANT',
    text: input.text,
    createdAt: input.createdAt,
  }
}

export function validateConversationUiState(state: ConversationUiState): string | null {
  if (state.status === 'ready' && state.errorMessage !== null) {
    return 'El estado visual de conversacion no puede estar ready con error activo.'
  }

  if (state.status === 'sending' && state.messages.length === 0) {
    return 'El estado visual de conversacion no puede enviar sin historial.'
  }

  return null
}

export function createConversationController(
  dependencies: ConversationControllerDependencies,
): ConversationController {
  const now = dependencies.now ?? (() => new Date().toISOString())

  let state: ConversationUiState = createInitialConversationUiState()
  let disposed = false
  const listeners = new Set<(state: ConversationUiState) => void>()

  function emit(nextState: ConversationUiState): void {
    if (disposed) {
      return
    }

    state = nextState
    for (const listener of listeners) {
      listener(state)
    }
  }

  return {
    getState() {
      return state
    },

    subscribe(listener) {
      if (disposed) {
        disposed = false
      }

      listeners.add(listener)
      listener(state)

      return () => {
        listeners.delete(listener)
      }
    },

    async initialize() {
      if (state.status === 'ready') {
        return
      }

      emit({
        ...state,
        status: 'loading',
        errorMessage: null,
      })

      emit({
        ...state,
        status: 'ready',
        errorMessage: null,
      })
    },

    async sendMessage(message) {
      const text = message.trim()
      if (text.length === 0) {
        return
      }

      const turn = state.messages.filter((item) => item.role === 'USER').length + 1
      const userMessage = createUserMessage({
        id: `conversation:user:${turn}`,
        text,
        createdAt: now(),
      })

      const baseMessages = [...state.messages, userMessage]

      emit({
        status: 'sending',
        messages: baseMessages,
        errorMessage: null,
      })

      let generated
      try {
        generated = await dependencies.pipeline.generateAssistantMessage({
          userMessage: text,
          turn,
        })
      } catch {
        generated = {
          kind: 'failure' as const,
          code: 'UNEXPECTED_ERROR',
          safeMessage: 'No fue posible procesar la solicitud.',
        }
      }

      if (generated.kind === 'failure') {
        const assistantErrorMessage = createAssistantMessage({
          id: `conversation:assistant:error:${turn}`,
          text: toAssistantErrorMessage(generated.safeMessage),
          createdAt: now(),
        })

        emit({
          status: 'error',
          messages: [...baseMessages, assistantErrorMessage],
          errorMessage: assistantErrorMessage.text,
        })
        return
      }

      const assistantMessage = createAssistantMessage({
        id: generated.message.messageId,
        text: generated.message.text,
        createdAt: generated.message.timestamp,
      })

      emit({
        status: 'ready',
        messages: [...baseMessages, assistantMessage],
        errorMessage: null,
      })
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
