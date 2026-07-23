import Dexie, { type Table } from 'dexie'

import { AIConversationSessionValidator } from '../intelligence/ai-conversation/session'
import type {
  AIConversationMemoryFailure,
  AIConversationMemoryMetadata,
  AIConversationMemoryPort,
  AIConversationMemoryRecord,
  AIConversationMemoryResult,
  AIConversationMemorySaveResult,
} from '../application/ai-conversation/aiConversationMemoryContracts'
import { CONVERSATION_MEMORY_LOCAL_SCHEMA_VERSION, type PersistedConversationMemory } from '../types/persistedConversationMemory'
import { db } from './db'

interface ConversationMemoryDatabase {
  readonly conversationMemories: Table<
    PersistedConversationMemory,
    PersistedConversationMemory['sessionId']
  >
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function success<TValue>(value: TValue): AIConversationMemoryResult<TValue> {
  return {
    kind: 'success',
    value,
  }
}

function failure(
  code: AIConversationMemoryFailure['code'],
  safeMessage: string,
  retryable = false,
): AIConversationMemoryFailure {
  return {
    kind: 'failure',
    code,
    retryable,
    safeMessage,
  }
}

function toMetadata(record: PersistedConversationMemory): AIConversationMemoryMetadata {
  return {
    sessionId: record.sessionId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastMessageAt: record.lastMessageAt,
    messageCount: record.messageCount,
    status: record.status,
    source: record.source,
    tags: [...record.tags],
  }
}

function toRecord(record: PersistedConversationMemory): AIConversationMemoryRecord {
  return {
    metadata: toMetadata(record),
    session: clone(record.session),
  }
}

function isIsoUtcInstant(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
}

function messageTimestampOrNull(session: AIConversationMemoryRecord['session']): string | null {
  if (session.messages.length === 0) {
    return null
  }

  const timestamp = session.messages[session.messages.length - 1]?.createdAt ?? ''
  return isIsoUtcInstant(timestamp) ? timestamp : null
}

function enforceRetention(records: readonly PersistedConversationMemory[], maxSessions: number): readonly PersistedConversationMemory[] {
  if (records.length <= maxSessions) {
    return records
  }

  const sorted = [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return sorted.slice(0, maxSessions)
}

export class LocalConversationRepository implements AIConversationMemoryPort {
  private readonly database: ConversationMemoryDatabase

  constructor(database: ConversationMemoryDatabase = db) {
    this.database = database
  }

  async saveSession(input: {
    readonly session: AIConversationMemoryRecord['session']
    readonly retentionPolicy: {
      readonly maxSessions: number
      readonly maxMessagesPerSession: number
      readonly evictionStrategy: 'KEEP_MOST_RECENT'
    }
  }): Promise<AIConversationMemoryResult<AIConversationMemorySaveResult>> {
    if (input.retentionPolicy.maxSessions < 1 || input.retentionPolicy.maxMessagesPerSession < 1) {
      return failure('INVALID_INPUT', 'La politica de retencion es invalida.')
    }

    const validation = new AIConversationSessionValidator().validate(input.session)
    if (validation) {
      return failure('MEMORY_CORRUPTED', 'La sesion no cumple el contrato canonico de conversacion.')
    }

    if (input.session.messages.length > input.retentionPolicy.maxMessagesPerSession) {
      return failure('MEMORY_MAX_MESSAGES_EXCEEDED', 'La sesion excede el maximo de mensajes permitido por la politica de retencion.')
    }

    const createdAt = input.session.metadata.createdAt
    const updatedAt = input.session.metadata.updatedAt ?? input.session.metadata.createdAt
    if (!isIsoUtcInstant(createdAt) || !isIsoUtcInstant(updatedAt)) {
      return failure('MEMORY_CORRUPTED', 'La sesion contiene timestamps invalidos para persistencia local.')
    }

    const record: PersistedConversationMemory = {
      sessionId: input.session.sessionId,
      session: clone(input.session),
      createdAt,
      updatedAt,
      lastMessageAt: messageTimestampOrNull(input.session),
      messageCount: input.session.messages.length,
      status: input.session.status,
      source: input.session.metadata.source,
      tags: [...(input.session.metadata.tags ?? [])],
      localSchemaVersion: CONVERSATION_MEMORY_LOCAL_SCHEMA_VERSION,
    }

    try {
      await this.database.conversationMemories.put(record)
      const allRecords = await this.database.conversationMemories.toArray()
      const keep = enforceRetention(allRecords, input.retentionPolicy.maxSessions)
      const keepIds = new Set(keep.map((item) => item.sessionId))
      const staleIds = allRecords
        .map((item) => item.sessionId)
        .filter((sessionId) => !keepIds.has(sessionId))
      if (staleIds.length > 0) {
        await this.database.conversationMemories.bulkDelete(staleIds)
      }

      const persisted = await this.database.conversationMemories.get(record.sessionId)
      if (persisted === undefined) {
        return failure('MEMORY_WRITE_FAILED', 'No se pudo confirmar la persistencia de la sesion conversacional.')
      }

      return success({
        record: toRecord(persisted),
        retention: {
          evictionStrategy: input.retentionPolicy.evictionStrategy,
          maxSessions: input.retentionPolicy.maxSessions,
          maxMessagesPerSession: input.retentionPolicy.maxMessagesPerSession,
          evictedSessionIds: staleIds,
          evictedCount: staleIds.length,
          messagesTruncated: false,
        },
      })
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('MEMORY_UNAVAILABLE', 'La memoria conversacional local no esta disponible temporalmente.', true)
      }
      return failure('MEMORY_WRITE_FAILED', 'Fallo la persistencia local de la sesion conversacional.', true)
    }
  }

  async loadSession(input?: {
    readonly sessionId?: string
  }): Promise<AIConversationMemoryResult<AIConversationMemoryRecord>> {
    try {
      const record = input?.sessionId === undefined
        ? await this.database.conversationMemories.orderBy('updatedAt').last()
        : await this.database.conversationMemories.get(input.sessionId as PersistedConversationMemory['sessionId'])

      if (record === undefined) {
        return failure('SESSION_NOT_FOUND', 'No se encontro una sesion conversacional en memoria local.')
      }

      if (record.localSchemaVersion !== CONVERSATION_MEMORY_LOCAL_SCHEMA_VERSION) {
        return failure('MEMORY_VERSION_UNSUPPORTED', 'La version local de memoria conversacional no es compatible.')
      }

      const validation = new AIConversationSessionValidator().validate(record.session)
      if (validation) {
        return failure('MEMORY_CORRUPTED', 'La sesion almacenada esta corrupta o incumple el contrato de conversacion.')
      }

      return success(toRecord(record))
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('MEMORY_UNAVAILABLE', 'La memoria conversacional local no esta disponible temporalmente.', true)
      }
      return failure('MEMORY_READ_FAILED', 'No se pudo leer la memoria conversacional local.', true)
    }
  }

  async listSessions(): Promise<AIConversationMemoryResult<readonly AIConversationMemoryMetadata[]>> {
    try {
      const records = await this.database.conversationMemories
        .orderBy('updatedAt')
        .reverse()
        .toArray()

      return success(records.map((record) => toMetadata(record)))
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('MEMORY_UNAVAILABLE', 'La memoria conversacional local no esta disponible temporalmente.', true)
      }
      return failure('MEMORY_READ_FAILED', 'No se pudo listar la memoria conversacional local.', true)
    }
  }

  async deleteSession(input: {
    readonly sessionId: string
  }): Promise<AIConversationMemoryResult<{ readonly deleted: boolean }>> {
    if (input.sessionId.trim().length === 0) {
      return failure('INVALID_INPUT', 'El identificador de sesion es obligatorio para eliminar memoria.')
    }

    try {
      const existing = await this.database.conversationMemories.get(
        input.sessionId as PersistedConversationMemory['sessionId'],
      )
      if (existing === undefined) {
        return success({ deleted: false })
      }

      await this.database.conversationMemories.delete(existing.sessionId)
      return success({ deleted: true })
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('MEMORY_UNAVAILABLE', 'La memoria conversacional local no esta disponible temporalmente.', true)
      }
      return failure('MEMORY_WRITE_FAILED', 'No se pudo eliminar la sesion conversacional local.', true)
    }
  }

  async clearMemory(): Promise<AIConversationMemoryResult<{ readonly deletedCount: number }>> {
    try {
      const deletedCount = await this.database.conversationMemories.count()
      await this.database.conversationMemories.clear()
      return success({ deletedCount })
    } catch (error) {
      if (Dexie.errnames.DatabaseClosed === (error as Error)?.name) {
        return failure('MEMORY_UNAVAILABLE', 'La memoria conversacional local no esta disponible temporalmente.', true)
      }
      return failure('MEMORY_WRITE_FAILED', 'No se pudo limpiar la memoria conversacional local.', true)
    }
  }
}
