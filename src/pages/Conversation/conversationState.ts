import type { AssistantProposalRecord } from '../../intelligence/assistant'

export type ConversationUiStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'sending'
  | 'error'

export type ConversationUiMessageRole = 'USER' | 'ASSISTANT'

export interface ConversationUiMessage {
  readonly id: string
  readonly role: ConversationUiMessageRole
  readonly text: string
  readonly createdAt: string
  /** Presente solo en mensajes del asistente que contienen una propuesta de acción pendiente de confirmar. */
  readonly proposal?: AssistantProposalRecord
}

export interface ConversationUiState {
  readonly status: ConversationUiStatus
  readonly messages: readonly ConversationUiMessage[]
  readonly errorMessage: string | null
}

export function createInitialConversationUiState(): ConversationUiState {
  return {
    status: 'idle',
    messages: [],
    errorMessage: null,
  }
}
