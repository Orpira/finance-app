import type { AIConversationApplicationService } from '../../application/ai-conversation'
import {
  createInitialConversationUiState,
  type ConversationUiState,
} from './conversationState'

export interface ConversationControllerDependencies {
  readonly service: AIConversationApplicationService
  readonly recoverSession?: () => Promise<ConversationUiState['session']>
}

export interface ConversationController {
  getState(): ConversationUiState
  subscribe(listener: (state: ConversationUiState) => void): () => void
  initialize(): Promise<void>
  sendMessage(message: string): Promise<void>
  dispose(): void
}

function debugConversationBoundary(event: string, payload: Record<string, unknown>): void {
  // Temporal: trazas sanitizadas para auditar publicación de estado del controller.
  console.info('[ConversationTrace]', event, payload)
}

function resolveSafeErrorMessage(fallback: string, input: string): string {
  const value = input.trim()
  if (value.length === 0) {
    return fallback
  }
  return value
}

export function createConversationController(
  dependencies: ConversationControllerDependencies,
): ConversationController {
  let state: ConversationUiState = createInitialConversationUiState()
  let disposed = false
  let initializationTask: Promise<void> | null = null

  const listeners = new Set<(state: ConversationUiState) => void>()

  function emit(nextState: ConversationUiState): void {
    if (disposed) {
      return
    }

    debugConversationBoundary('controller.state.published', {
      status: nextState.status,
      sessionId: nextState.session?.sessionId ?? null,
      messageCount: nextState.messages.length,
      hasError: nextState.errorMessage !== null,
    })

    state = nextState
    for (const listener of listeners) {
      listener(state)
    }
  }

  function fail(message: string): void {
    emit({
      status: 'error',
      session: state.session,
      messages: state.session?.messages ?? state.messages,
      errorMessage: message,
    })
  }

  return {
    getState() {
      return state
    },

    subscribe(listener) {
      if (disposed) {
        // React StrictMode desmonta y vuelve a montar efectos en desarrollo.
        // Rehabilitamos el controller al resuscribirse para no perder emisiones.
        disposed = false
      }

      listeners.add(listener)
      listener(state)

      return () => {
        listeners.delete(listener)
      }
    },

    async initialize() {
      if (initializationTask !== null) {
        return initializationTask
      }

      initializationTask = (async () => {
        if (state.status === 'loading') {
          return
        }

        if (state.session !== null) {
          emit({
            status: 'ready',
            session: state.session,
            messages: state.session.messages,
            errorMessage: null,
          })
          return
        }

        emit({
          status: 'loading',
          session: state.session,
          messages: state.session?.messages ?? state.messages,
          errorMessage: null,
        })

        let recoveredSession: ConversationUiState['session'] = null

        if (dependencies.recoverSession !== undefined) {
          try {
            recoveredSession = await dependencies.recoverSession()
          } catch {
            recoveredSession = null
          }

          if (recoveredSession !== null) {
            debugConversationBoundary('controller.session.recovered', {
              sessionId: recoveredSession.sessionId,
              messageCount: recoveredSession.messages.length,
            })

            emit({
              status: 'ready',
              session: recoveredSession,
              messages: recoveredSession.messages,
              errorMessage: null,
            })
            return
          }
        }

        let result: ReturnType<AIConversationApplicationService['startConversation']>
        try {
          result = dependencies.service.startConversation({
            userDisplayName: 'Usuario',
            assistantDisplayName: 'Private Balance AI',
          })
        } catch {
          fail('No se pudo iniciar la sesion de conversacion.')
          return
        }

        if (result.kind === 'failure') {
          fail(
            resolveSafeErrorMessage(
              'No se pudo crear la sesion de conversacion.',
              result.safeMessage,
            ),
          )
          return
        }

        debugConversationBoundary('controller.session.created', {
          sessionId: result.value.sessionId,
          messageCount: result.value.messages.length,
        })

        emit({
          status: 'ready',
          session: result.value,
          messages: result.value.messages,
          errorMessage: null,
        })
      })()
        .catch(() => {
          fail('No se pudo inicializar la conversacion.')
        })
        .finally(() => {
          initializationTask = null
        })

      return initializationTask
    },

    async sendMessage(message) {
      const trimmedMessage = message.trim()
      if (trimmedMessage.length === 0) {
        return
      }

      if (!state.session) {
        fail('No hay una sesion activa para enviar mensajes.')
        return
      }

      emit({
        status: 'sending',
        session: state.session,
        messages: state.session.messages,
        errorMessage: null,
      })

      let result
      try {
        result = await dependencies.service.sendMessage({
          session: state.session,
          message: trimmedMessage,
          onStateChange: (applicationState) => {
            if (applicationState === 'Receiving') {
              emit({
                status: 'receiving',
                session: state.session,
                messages: state.session?.messages ?? state.messages,
                errorMessage: null,
              })
            }
          },
        })
      } catch {
        fail('No se pudo procesar la respuesta del asistente.')
        return
      }

      if (result.kind === 'failure') {
        fail(
          resolveSafeErrorMessage(
            'No se pudo procesar la respuesta del asistente.',
            result.safeMessage,
          ),
        )
        return
      }

      emit({
        status: 'ready',
        session: result.value.session,
        messages: result.value.session.messages,
        errorMessage: null,
      })
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
