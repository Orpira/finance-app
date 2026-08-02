import type { AssistantProposalRecord } from '../../intelligence/assistant'
import type { FinancialCopilotSessionSnapshot } from '../../intelligence/deterministic-copilot'

export type ConversationUiStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'sending'
  | 'error'

export type ConversationUiMessageRole = 'USER' | 'ASSISTANT'

export interface CopilotResponseSections {
  readonly response: string
  readonly explanation: string
  readonly evidence: readonly string[]
  readonly recommendedAction: string
}

export interface ConversationUiMessage {
  readonly id: string
  readonly role: ConversationUiMessageRole
  readonly text: string
  readonly createdAt: string
  /** Presente solo en mensajes del Copiloto que contienen una propuesta pendiente de confirmar. */
  readonly proposal?: AssistantProposalRecord
  readonly responseType?: 'local-calculation' | 'deterministic-explanation' | 'pending-proposal' | 'executed-action'
  readonly sections?: CopilotResponseSections
}

export interface ConversationUiState {
  readonly status: ConversationUiStatus
  readonly messages: readonly ConversationUiMessage[]
  readonly errorMessage: string | null
  readonly context: FinancialCopilotSessionSnapshot | null
}

export function createInitialConversationUiState(): ConversationUiState {
  return {
    status: 'idle',
    messages: [],
    errorMessage: null,
    context: null,
  }
}
