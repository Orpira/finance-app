import type { AIConversationSessionSnapshot } from '../../intelligence/ai-conversation/session'

export const AI_CONVERSATION_MEMORY_FAILURE_CODES = [
  'INVALID_INPUT',
  'SESSION_NOT_FOUND',
  'MEMORY_READ_FAILED',
  'MEMORY_WRITE_FAILED',
  'MEMORY_CORRUPTED',
  'MEMORY_VERSION_UNSUPPORTED',
  'MEMORY_MAX_MESSAGES_EXCEEDED',
  'MEMORY_UNAVAILABLE',
] as const

export type AIConversationMemoryFailureCode =
  (typeof AI_CONVERSATION_MEMORY_FAILURE_CODES)[number]

export interface AIConversationMemoryFailure {
  readonly kind: 'failure'
  readonly code: AIConversationMemoryFailureCode
  readonly retryable: boolean
  readonly safeMessage: string
}

export interface AIConversationMemorySuccess<TValue> {
  readonly kind: 'success'
  readonly value: TValue
}

export type AIConversationMemoryResult<TValue> =
  | AIConversationMemoryFailure
  | AIConversationMemorySuccess<TValue>

export interface AIConversationRetentionPolicy {
  readonly maxSessions: number
  readonly maxMessagesPerSession: number
  readonly evictionStrategy: 'KEEP_MOST_RECENT'
}

export interface AIConversationMemoryMetadata {
  readonly sessionId: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly lastMessageAt: string | null
  readonly messageCount: number
  readonly status: AIConversationSessionSnapshot['status']
  readonly source: AIConversationSessionSnapshot['metadata']['source']
  readonly tags: readonly string[]
}

export interface AIConversationMemoryRecord {
  readonly metadata: AIConversationMemoryMetadata
  readonly session: AIConversationSessionSnapshot
}

export interface AIConversationMemoryRetentionEffect {
  readonly evictionStrategy: AIConversationRetentionPolicy['evictionStrategy']
  readonly maxSessions: number
  readonly maxMessagesPerSession: number
  readonly evictedSessionIds: readonly string[]
  readonly evictedCount: number
  readonly messagesTruncated: false
}

export interface AIConversationMemorySaveResult {
  readonly record: AIConversationMemoryRecord
  readonly retention: AIConversationMemoryRetentionEffect
}

export interface AIConversationMemoryPort {
  saveSession(input: {
    readonly session: AIConversationSessionSnapshot
    readonly retentionPolicy: AIConversationRetentionPolicy
  }): Promise<AIConversationMemoryResult<AIConversationMemorySaveResult>>
  loadSession(input?: {
    readonly sessionId?: string
  }): Promise<AIConversationMemoryResult<AIConversationMemoryRecord>>
  listSessions(): Promise<AIConversationMemoryResult<readonly AIConversationMemoryMetadata[]>>
  deleteSession(input: {
    readonly sessionId: string
  }): Promise<AIConversationMemoryResult<{ readonly deleted: boolean }>>
  clearMemory(): Promise<AIConversationMemoryResult<{ readonly deletedCount: number }>>
}
