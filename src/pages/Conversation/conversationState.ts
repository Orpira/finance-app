import type { AIConversationMessage } from '../../intelligence/ai-conversation/message'
import type { AIConversationSessionSnapshot } from '../../intelligence/ai-conversation/session'

export type ConversationUiStatus =
  | 'idle'
  | 'loading'
  | 'sending'
  | 'receiving'
  | 'success'
  | 'error'

export interface ConversationUiState {
  readonly status: ConversationUiStatus
  readonly session: AIConversationSessionSnapshot | null
  readonly messages: readonly AIConversationMessage[]
  readonly errorMessage: string | null
}

export function createInitialConversationUiState(): ConversationUiState {
  return {
    status: 'idle',
    session: null,
    messages: [],
    errorMessage: null,
  }
}
