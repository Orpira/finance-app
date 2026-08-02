import {
  applyProposalEdits,
  executeAssistantProposal,
  interpretAssistantMessage,
  recordAssistantAudit,
  type AssistantProposalRecord,
} from '../../intelligence/assistant'
import type { ChatMessage } from '../../intelligence/mock-conversational-renderer/mockConversationalRenderer'
import type { CurrencyCode, UsageMode } from '../../types/settings'
import type { FinancialCopilotQueryAnswer } from '../../intelligence/deterministic-copilot'
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
  /**
   * Opcional a propósito: si se omite, el controlador nunca intenta
   * interpretar el mensaje como una acción (ingreso/gasto/cita) y todo turno
   * sigue el camino de consulta existente sin cambios — así ningún test o
   * composición previa que no conozca el flujo de propuestas se ve afectado.
   * La composition root real (conversationComposition.ts) sí la provee.
   */
  readonly getAssistantContext?: () => Promise<{
    readonly defaultCurrency: CurrencyCode
    readonly usageMode: UsageMode
  }>
  /** Consultas financieras deterministas, resueltas localmente antes de cualquier proveedor. */
  readonly answerLocalQuery?: (message: string) => Promise<FinancialCopilotQueryAnswer | null>
}

export interface ConversationController {
  getState(): ConversationUiState
  subscribe(listener: (state: ConversationUiState) => void): () => void
  initialize(): Promise<void>
  sendMessage(message: string): Promise<void>
  confirmProposal(input: {
    readonly messageId: string
    readonly edits?: Readonly<Record<string, string | number | null>>
  }): Promise<void>
  cancelProposal(input: { readonly messageId: string }): void
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
  readonly proposal?: AssistantProposalRecord
}): ConversationUiMessage {
  return {
    id: input.id,
    role: 'ASSISTANT',
    text: input.text,
    createdAt: input.createdAt,
    ...(input.proposal === undefined ? {} : { proposal: input.proposal }),
  }
}

function proposalKindLabel(kind: AssistantProposalRecord['kind']): string {
  if (kind === 'register_income') return 'ingreso'
  if (kind === 'register_expense') return 'gasto'
  return 'cita'
}

function proposalSummaryText(proposal: AssistantProposalRecord): string {
  if (proposal.missingRequiredFields.length > 0) {
    return `He preparado una propuesta de ${proposalKindLabel(proposal.kind)}, pero faltan algunos datos. Complétalos antes de confirmar.`
  }

  return `He preparado una propuesta de ${proposalKindLabel(proposal.kind)}. Revísala y confirma para guardarla.`
}

/**
 * El contexto del Asistente (moneda/modo de uso) es una capacidad
 * complementaria, no crítica: si no está disponible (dependencia no
 * provista, o `getSettings()` falla por cualquier motivo) el turno
 * simplemente sigue el camino de consulta existente en vez de romper el
 * envío del mensaje.
 */
async function resolveInterpretation(
  dependencies: ConversationControllerDependencies,
  text: string,
): Promise<ReturnType<typeof interpretAssistantMessage> | { readonly kind: 'no-action' }> {
  if (dependencies.getAssistantContext === undefined) {
    return { kind: 'no-action' }
  }

  try {
    const context = await dependencies.getAssistantContext()
    return interpretAssistantMessage(text, context)
  } catch {
    return { kind: 'no-action' }
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

  function replaceMessage(
    messageId: string,
    updater: (message: ConversationUiMessage) => ConversationUiMessage,
  ): ConversationUiMessage[] {
    return state.messages.map((message) => (message.id === messageId ? updater(message) : message))
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

      const interpretation = await resolveInterpretation(dependencies, text)

      if (interpretation.kind === 'privacy-denied') {
        const assistantErrorMessage = createAssistantMessage({
          id: `conversation:assistant:privacy-denied:${turn}`,
          text: toAssistantErrorMessage(interpretation.safeMessage),
          createdAt: now(),
        })

        emit({
          status: 'error',
          messages: [...baseMessages, assistantErrorMessage],
          errorMessage: assistantErrorMessage.text,
        })
        return
      }

      if (interpretation.kind === 'proposal') {
        const assistantMessage = createAssistantMessage({
          id: `conversation:assistant:proposal:${turn}`,
          text: proposalSummaryText(interpretation.proposal),
          createdAt: now(),
          proposal: interpretation.proposal,
        })

        emit({
          status: 'ready',
          messages: [...baseMessages, assistantMessage],
          errorMessage: null,
        })
        return
      }

      if (dependencies.answerLocalQuery !== undefined) {
        let localAnswer: FinancialCopilotQueryAnswer | null
        try {
          localAnswer = await dependencies.answerLocalQuery(text)
        } catch {
          const assistantErrorMessage = createAssistantMessage({
            id: `conversation:assistant:local-error:${turn}`,
            text: 'No pude consultar tus datos locales en este momento.',
            createdAt: now(),
          })
          emit({
            status: 'error',
            messages: [...baseMessages, assistantErrorMessage],
            errorMessage: assistantErrorMessage.text,
          })
          return
        }

        if (localAnswer !== null) {
          const assistantMessage = createAssistantMessage({
            id: `conversation:assistant:local:${turn}`,
            text: `${localAnswer.text}\n\n${localAnswer.explanation}`,
            createdAt: now(),
          })
          emit({
            status: 'ready',
            messages: [...baseMessages, assistantMessage],
            errorMessage: null,
          })
          return
        }
      }

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

    async confirmProposal(input) {
      const targetMessage = state.messages.find((message) => message.id === input.messageId)
      if (!targetMessage || !targetMessage.proposal) {
        return
      }

      const editedProposal = input.edits
        ? applyProposalEdits(targetMessage.proposal, input.edits)
        : targetMessage.proposal

      if (editedProposal.missingRequiredFields.length > 0) {
        emit({
          ...state,
          messages: replaceMessage(input.messageId, (message) => ({
            ...message,
            proposal: editedProposal,
          })),
        })
        return
      }

      const confirmedProposal: AssistantProposalRecord = { ...editedProposal, status: 'confirmed' }

      emit({
        ...state,
        status: 'sending',
        messages: replaceMessage(input.messageId, (message) => ({
          ...message,
          proposal: { ...confirmedProposal, status: 'executing' },
        })),
      })

      const result = await executeAssistantProposal({ ...confirmedProposal, status: 'confirmed' })
      const turn = state.messages.filter((item) => item.role === 'USER').length

      if (result.ok) {
        const completedProposal: AssistantProposalRecord = {
          ...confirmedProposal,
          status: 'completed',
          executedRecordId: result.recordId,
        }
        const confirmationMessage = createAssistantMessage({
          id: `conversation:assistant:confirmed:${input.messageId}`,
          text: `Listo, registré tu ${proposalKindLabel(completedProposal.kind)}.`,
          createdAt: now(),
        })

        emit({
          status: 'ready',
          errorMessage: null,
          messages: [
            ...replaceMessage(input.messageId, (message) => ({ ...message, proposal: completedProposal })),
            confirmationMessage,
          ],
        })
        return
      }

      const failedProposal: AssistantProposalRecord = {
        ...confirmedProposal,
        status: 'failed',
        failureReason: result.safeMessage,
      }
      const failureMessage = createAssistantMessage({
        id: `conversation:assistant:failed:${input.messageId}:${turn}`,
        text: toAssistantErrorMessage(result.safeMessage),
        createdAt: now(),
      })

      emit({
        status: 'error',
        errorMessage: failureMessage.text,
        messages: [
          ...replaceMessage(input.messageId, (message) => ({ ...message, proposal: failedProposal })),
          failureMessage,
        ],
      })
    },

    cancelProposal(input) {
      const targetMessage = state.messages.find((message) => message.id === input.messageId)
      if (!targetMessage || !targetMessage.proposal) {
        return
      }

      const cancelledProposal: AssistantProposalRecord = { ...targetMessage.proposal, status: 'cancelled' }
      recordAssistantAudit({
        timestamp: now(),
        proposalId: cancelledProposal.proposalId,
        kind: cancelledProposal.kind,
        status: 'cancelled',
      })

      const cancellationMessage = createAssistantMessage({
        id: `conversation:assistant:cancelled:${input.messageId}`,
        text: 'De acuerdo, no se registró nada.',
        createdAt: now(),
      })

      emit({
        status: 'ready',
        errorMessage: null,
        messages: [
          ...replaceMessage(input.messageId, (message) => ({ ...message, proposal: cancelledProposal })),
          cancellationMessage,
        ],
      })
    },

    dispose() {
      disposed = true
      listeners.clear()
    },
  }
}
