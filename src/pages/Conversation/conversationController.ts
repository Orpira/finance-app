import type { AIConversationApplicationService } from '../../application/ai-conversation'
import type { AIConversationSessionSnapshot } from '../../intelligence/ai-conversation/session'
import {
  createInitialConversationUiState,
  type ConversationUiState,
} from './conversationState'

export interface ConversationControllerDependencies {
  readonly service: Pick<
    AIConversationApplicationService,
    'startConversation' | 'sendMessage'
  > & Partial<Pick<AIConversationApplicationService, 'loadSession' | 'saveSession'>>
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
        if (state.status === 'loading' || state.status === 'loading-memory') {
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
          status: 'loading-memory',
          session: state.session,
          messages: state.messages,
          errorMessage: null,
        })

        let loadedSession: AIConversationSessionSnapshot | null
        try {
          const loaded = dependencies.service.loadSession === undefined
            ? {
              kind: 'failure' as const,
              code: 'SESSION_NOT_FOUND',
              retryable: false,
              safeMessage: 'No se encontro una sesion conversacional en memoria local.',
            }
            : await dependencies.service.loadSession()
          if (loaded.kind === 'failure') {
            if (loaded.code === 'SESSION_NOT_FOUND') {
              loadedSession = null
            } else {
              emit({
                status: 'memory-error',
                session: state.session,
                messages: state.messages,
                errorMessage: resolveSafeErrorMessage(
                  'No se pudo recuperar la memoria conversacional local.',
                  loaded.safeMessage,
                ),
              })
              return
            }
          } else {
            loadedSession = loaded.value
          }

        } catch {
          emit({
            status: 'memory-error',
            session: state.session,
            messages: state.messages,
            errorMessage: 'No se pudo recuperar la memoria conversacional local.',
          })
          return
        }

        if (loadedSession !== null) {
          debugConversationBoundary('controller.session.recovered', {
            sessionId: loadedSession.sessionId,
            messageCount: loadedSession.messages.length,
          })

          emit({
            status: 'memory-loaded',
            session: loadedSession,
            messages: loadedSession.messages,
            errorMessage: null,
          })

          emit({
            status: 'ready',
            session: loadedSession,
            messages: loadedSession.messages,
            errorMessage: null,
          })
          return
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
          status: 'saving-memory',
          session: result.value,
          messages: result.value.messages,
          errorMessage: null,
        })

        const saved = dependencies.service.saveSession === undefined
          ? {
            kind: 'success' as const,
            value: {
              session: result.value,
              retention: {
                evictionStrategy: 'KEEP_MOST_RECENT' as const,
                maxSessions: 25,
                maxMessagesPerSession: 300,
                evictedSessionIds: [],
                evictedCount: 0,
                messagesTruncated: false as const,
              },
            },
          }
          : await dependencies.service.saveSession({
            session: result.value,
          })
        if (saved.kind === 'failure') {
          emit({
            status: 'memory-error',
            session: result.value,
            messages: result.value.messages,
            errorMessage: resolveSafeErrorMessage(
              'No se pudo guardar la memoria conversacional local.',
              saved.safeMessage,
            ),
          })
          return
        }

        emit({
          status: 'ready',
          session: saved.value.session,
          messages: saved.value.session.messages,
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
        status: 'saving-memory',
        session: result.value.session,
        messages: result.value.session.messages,
        errorMessage: null,
      })

      const saved = dependencies.service.saveSession === undefined
        ? {
          kind: 'success' as const,
          value: {
            session: result.value.session,
            retention: {
              evictionStrategy: 'KEEP_MOST_RECENT' as const,
              maxSessions: 25,
              maxMessagesPerSession: 300,
              evictedSessionIds: [],
              evictedCount: 0,
              messagesTruncated: false as const,
            },
          },
        }
        : await dependencies.service.saveSession({
          session: result.value.session,
        })
      if (saved.kind === 'failure') {
        emit({
          status: 'memory-error',
          session: result.value.session,
          messages: result.value.session.messages,
          errorMessage: resolveSafeErrorMessage(
            'No se pudo guardar la memoria conversacional local.',
            saved.safeMessage,
          ),
        })
        return
      }

      emit({
        status: 'ready',
        session: saved.value.session,
        messages: saved.value.session.messages,
        errorMessage: null,
      })
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
