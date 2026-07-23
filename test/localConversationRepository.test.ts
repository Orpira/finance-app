import { describe, expect, it } from 'vitest'

import type { AIConversationSessionSnapshot } from '../src/intelligence/ai-conversation/session'
import { createAIConversationService } from '../src/intelligence/ai-conversation/service'
import { LocalConversationRepository } from '../src/database/localConversationRepository'
import type { PersistedConversationMemory } from '../src/types/persistedConversationMemory'

class MemoryConversationTable {
  readonly records = new Map<string, PersistedConversationMemory>()
  failWrites = false

  async put(record: PersistedConversationMemory): Promise<void> {
    if (this.failWrites) {
      throw new Error('write failed')
    }
    this.records.set(record.sessionId, structuredClone(record))
  }

  async get(sessionId: string): Promise<PersistedConversationMemory | undefined> {
    return this.records.get(sessionId)
  }

  async toArray(): Promise<PersistedConversationMemory[]> {
    return [...this.records.values()].map((record) => structuredClone(record))
  }

  orderBy(field: 'updatedAt') {
    const values = [...this.records.values()].sort((left, right) => left[field].localeCompare(right[field]))
    return {
      last: async () => values.at(-1),
      reverse: () => ({
        toArray: async () => [...values].reverse().map((record) => structuredClone(record)),
      }),
    }
  }

  async bulkDelete(sessionIds: readonly string[]): Promise<void> {
    for (const sessionId of sessionIds) {
      this.records.delete(sessionId)
    }
  }

  async delete(sessionId: string): Promise<void> {
    this.records.delete(sessionId)
  }

  async count(): Promise<number> {
    return this.records.size
  }

  async clear(): Promise<void> {
    this.records.clear()
  }
}

function createSessionFixture(input: {
  readonly createdAt: string
  readonly sessionId: string
}): AIConversationSessionSnapshot {
  const service = createAIConversationService({
    now: () => input.createdAt,
    idFactory: {
      create(kind) {
        if (kind === 'conversation') return `conversation:${input.sessionId}`
        if (kind === 'session') return input.sessionId
        if (kind === 'interaction') return `interaction:${input.sessionId}`
        return `message:${input.sessionId}:001`
      },
    },
  })

  const started = service.startConversation({
    createdAt: input.createdAt,
    userDisplayName: 'Usuario',
    assistantDisplayName: 'Private Balance AI',
  })

  if (started.kind !== 'success') {
    throw new Error('Expected valid conversation session fixture')
  }

  return started.value
}

function createRepositoryFixture() {
  const conversationMemories = new MemoryConversationTable()
  const repository = new LocalConversationRepository({
    conversationMemories,
  } as never)

  return {
    conversationMemories,
    repository,
  }
}

describe('LocalConversationRepository (Milestone 11C)', () => {
  it('save/load/list/delete/clear conversation memory', async () => {
    const { repository } = createRepositoryFixture()
    const session = createSessionFixture({
      createdAt: '2026-07-23T00:00:00.000Z',
      sessionId: 'session:memory:001',
    })

    const saved = await repository.saveSession({
      session,
      retentionPolicy: {
        maxSessions: 10,
        maxMessagesPerSession: 100,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    })

    expect(saved.kind).toBe('success')
    if (saved.kind !== 'success') {
      throw new Error(`Expected save success, received ${saved.code}`)
    }
    expect(saved.value.retention.evictedCount).toBe(0)
    expect(saved.value.retention.messagesTruncated).toBe(false)

    const loaded = await repository.loadSession({ sessionId: session.sessionId })
    expect(loaded.kind).toBe('success')
    if (loaded.kind !== 'success' || loaded.value === null) {
      throw new Error('Expected to load persisted session')
    }

    expect(loaded.value.session).toEqual(session)

    const listed = await repository.listSessions()
    expect(listed.kind).toBe('success')
    if (listed.kind === 'success') {
      expect(listed.value).toHaveLength(1)
      expect(listed.value[0]?.sessionId).toBe(session.sessionId)
    }

    const deleted = await repository.deleteSession({ sessionId: session.sessionId })
    expect(deleted).toEqual({ kind: 'success', value: { deleted: true } })

    const afterDelete = await repository.loadSession({ sessionId: session.sessionId })
    expect(afterDelete).toEqual({
      kind: 'failure',
      code: 'SESSION_NOT_FOUND',
      retryable: false,
      safeMessage: 'No se encontro una sesion conversacional en memoria local.',
    })

    const resaved = await repository.saveSession({
      session,
      retentionPolicy: {
        maxSessions: 10,
        maxMessagesPerSession: 100,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    })
    expect(resaved.kind).toBe('success')

    const cleared = await repository.clearMemory()
    expect(cleared).toEqual({ kind: 'success', value: { deletedCount: 1 } })
  })

  it('returns null for non-existent session', async () => {
    const { repository } = createRepositoryFixture()

    const loaded = await repository.loadSession({
      sessionId: 'session:memory:missing',
    })

    expect(loaded).toEqual({
      kind: 'failure',
      code: 'SESSION_NOT_FOUND',
      retryable: false,
      safeMessage: 'No se encontro una sesion conversacional en memoria local.',
    })
  })

  it('fails closed on corrupted session payload', async () => {
    const { repository } = createRepositoryFixture()

    const corruptedSession = {
      protocolVersion: 1,
      sessionId: 'session:memory:corrupt',
      conversation: {
        protocolVersion: 1,
        conversationId: 'conversation:memory:corrupt',
        status: 'OPEN',
        participants: [{ participantId: 'user:1', role: 'USER', active: true }],
        metadata: {
          createdAt: '2026-07-23T00:00:00.000Z',
          source: 'APPLICATION',
        },
      },
      status: 'ACTIVE',
      participants: [{ participantId: 'user:1', role: 'USER', active: true }],
      messages: [
        {
          protocolVersion: 1,
          id: 'message:memory:invalid',
          conversationId: 'conversation:memory:corrupt',
          sessionId: 'session:memory:corrupt',
          role: 'USER',
          content: {
            kind: 'TEXT',
            value: 'mensaje',
            format: 'PLAIN_TEXT',
          },
          status: 'READY',
          sequence: 7,
          createdAt: '2026-07-23T00:00:00.000Z',
          metadata: {
            contractVersion: 1,
            generatedLocally: true,
          },
        },
      ],
      metadata: {
        createdAt: '2026-07-23T00:00:00.000Z',
        source: 'APPLICATION',
      },
      interaction: null,
    } as unknown as AIConversationSessionSnapshot

    const saved = await repository.saveSession({
      session: corruptedSession,
      retentionPolicy: {
        maxSessions: 10,
        maxMessagesPerSession: 100,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    })

    expect(saved.kind).toBe('failure')
    if (saved.kind === 'failure') {
      expect(saved.code).toBe('MEMORY_CORRUPTED')
    }
  })

  it('returns persistence failure when local storage write fails', async () => {
    const { repository, conversationMemories } = createRepositoryFixture()
    const session = createSessionFixture({
      createdAt: '2026-07-23T00:00:00.000Z',
      sessionId: 'session:memory:write-failure',
    })

    conversationMemories.failWrites = true

    const saved = await repository.saveSession({
      session,
      retentionPolicy: {
        maxSessions: 10,
        maxMessagesPerSession: 100,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    })

    expect(saved.kind).toBe('failure')
    if (saved.kind === 'failure') {
      expect(saved.code).toBe('MEMORY_WRITE_FAILED')
    }
  })

  it('returns explicit retention eviction details when maxSessions is reached', async () => {
    const { repository } = createRepositoryFixture()

    for (let index = 0; index < 25; index += 1) {
      const session = createSessionFixture({
        createdAt: `2026-07-23T00:00:${String(index).padStart(2, '0')}.000Z`,
        sessionId: `session:memory:retention:${String(index + 1).padStart(3, '0')}`,
      })
      const saved = await repository.saveSession({
        session,
        retentionPolicy: {
          maxSessions: 25,
          maxMessagesPerSession: 300,
          evictionStrategy: 'KEEP_MOST_RECENT',
        },
      })
      expect(saved.kind).toBe('success')
      if (saved.kind === 'success') {
        expect(saved.value.retention.evictedCount).toBe(0)
      }
    }

    const overflowSession = createSessionFixture({
      createdAt: '2026-07-23T00:01:00.000Z',
      sessionId: 'session:memory:retention:overflow',
    })
    const overflowSaved = await repository.saveSession({
      session: overflowSession,
      retentionPolicy: {
        maxSessions: 25,
        maxMessagesPerSession: 300,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    })

    expect(overflowSaved.kind).toBe('success')
    if (overflowSaved.kind !== 'success') {
      throw new Error('Expected overflow save to succeed with explicit eviction details')
    }

    expect(overflowSaved.value.retention.evictedCount).toBe(1)
    expect(overflowSaved.value.retention.evictedSessionIds).toHaveLength(1)
    expect(overflowSaved.value.retention.messagesTruncated).toBe(false)

    const evictedSessionId = overflowSaved.value.retention.evictedSessionIds[0]
    if (evictedSessionId === undefined) {
      throw new Error('Expected one explicit evicted session id')
    }

    const evictedLoad = await repository.loadSession({ sessionId: evictedSessionId })
    expect(evictedLoad.kind).toBe('failure')
    if (evictedLoad.kind === 'failure') {
      expect(evictedLoad.code).toBe('SESSION_NOT_FOUND')
    }
  })

  it('rejects save explicitly when maxMessagesPerSession is exceeded', async () => {
    const { repository } = createRepositoryFixture()
    const service = createAIConversationService({
      now: () => '2026-07-23T00:00:00.000Z',
      idFactory: {
        create(kind) {
          if (kind === 'conversation') return 'conversation:memory:max-messages'
          if (kind === 'session') return 'session:memory:max-messages'
          if (kind === 'interaction') return 'interaction:memory:max-messages'
          return `message:memory:max-messages:${Date.now()}`
        },
      },
    })

    const started = service.startConversation({
      createdAt: '2026-07-23T00:00:00.000Z',
      userDisplayName: 'Usuario',
      assistantDisplayName: 'Private Balance AI',
    })
    if (started.kind !== 'success') {
      throw new Error('Expected started session for max messages test')
    }

    let session = started.value
    for (let index = 0; index < 301; index += 1) {
      const created = service.createUserMessage({
        id: `message:memory:max-messages:${String(index).padStart(3, '0')}`,
        conversationId: session.conversation.conversationId,
        sessionId: session.sessionId,
        content: { value: `msg-${index}` },
        sequence: session.messages.length,
        createdAt: '2026-07-23T00:00:00.000Z',
        metadata: { generatedLocally: true },
      })
      if (created.kind !== 'success') {
        throw new Error(`Expected valid message creation at index ${index}`)
      }

      const appended = service.appendMessage(session, created.value)
      if (appended.kind !== 'success') {
        throw new Error(`Expected valid append at index ${index}`)
      }
      session = appended.value
    }

    const saved = await repository.saveSession({
      session,
      retentionPolicy: {
        maxSessions: 25,
        maxMessagesPerSession: 300,
        evictionStrategy: 'KEEP_MOST_RECENT',
      },
    })

    expect(saved.kind).toBe('failure')
    if (saved.kind === 'failure') {
      expect(saved.code).toBe('MEMORY_MAX_MESSAGES_EXCEEDED')
    }
  })

  it('fails closed when local schema version is unsupported', async () => {
    const { repository, conversationMemories } = createRepositoryFixture()
    const session = createSessionFixture({
      createdAt: '2026-07-23T00:00:00.000Z',
      sessionId: 'session:memory:unsupported-version',
    })

    await conversationMemories.put({
      sessionId: session.sessionId,
      session: structuredClone(session),
      createdAt: session.metadata.createdAt,
      updatedAt: session.metadata.updatedAt ?? session.metadata.createdAt,
      lastMessageAt: null,
      messageCount: session.messages.length,
      status: session.status,
      source: session.metadata.source,
      tags: [...(session.metadata.tags ?? [])],
      localSchemaVersion: 999 as never,
    })

    const loaded = await repository.loadSession({ sessionId: session.sessionId })
    expect(loaded.kind).toBe('failure')
    if (loaded.kind === 'failure') {
      expect(loaded.code).toBe('MEMORY_VERSION_UNSUPPORTED')
    }
  })
})
