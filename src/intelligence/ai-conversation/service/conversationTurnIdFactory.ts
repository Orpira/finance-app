export type AIConversationEntityKind =
  | 'conversation'
  | 'session'
  | 'message'
  | 'interaction'

export interface AIConversationTurnIdFactory {
  create(kind: AIConversationEntityKind): string
}

export function createDefaultAIConversationTurnIdFactory(): AIConversationTurnIdFactory {
  return {
    create(kind) {
      return `${kind}:${crypto.randomUUID()}`
    },
  }
}