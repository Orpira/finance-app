import type { AIConversationSessionEvent } from './AIConversationSessionEvent'
import type { AIConversationSessionStatus } from './AIConversationSessionStatus'

export interface AIConversationSessionTransition {
  readonly from: AIConversationSessionStatus
  readonly event: AIConversationSessionEvent
  readonly to: AIConversationSessionStatus
}

export const AI_CONVERSATION_SESSION_TRANSITIONS: readonly AIConversationSessionTransition[] = [
  { from: 'CREATED', event: 'ACTIVATE', to: 'ACTIVE' },
  { from: 'ACTIVE', event: 'PAUSE', to: 'PAUSED' },
  { from: 'PAUSED', event: 'RESUME', to: 'ACTIVE' },
  { from: 'ACTIVE', event: 'COMPLETE', to: 'COMPLETED' },
  { from: 'PAUSED', event: 'COMPLETE', to: 'COMPLETED' },
  { from: 'CREATED', event: 'CANCEL', to: 'CANCELLED' },
  { from: 'ACTIVE', event: 'CANCEL', to: 'CANCELLED' },
  { from: 'PAUSED', event: 'CANCEL', to: 'CANCELLED' },
] as const
