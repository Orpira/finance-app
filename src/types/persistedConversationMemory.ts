import type { AIConversationSessionSnapshot } from '../intelligence/ai-conversation/session'

export const CONVERSATION_MEMORY_LOCAL_SCHEMA_VERSION = 1 as const

export interface PersistedConversationMemory {
  readonly sessionId: AIConversationSessionSnapshot['sessionId']
  readonly session: AIConversationSessionSnapshot
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastMessageAt: string | null
  readonly messageCount: number
  readonly status: AIConversationSessionSnapshot['status']
  readonly source: AIConversationSessionSnapshot['metadata']['source']
  readonly tags: readonly string[]
  readonly localSchemaVersion: typeof CONVERSATION_MEMORY_LOCAL_SCHEMA_VERSION
}
