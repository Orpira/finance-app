import { describe, expect, it } from 'vitest'
import {
  createAIConversation,
  createAIConversationId,
} from './aiConversationFactory'

describe('createAIConversationId', () => {
  it('accepts a canonical conversation identifier', () => {
    expect(createAIConversationId('conversation:main:001')).toBe('conversation:main:001')
  })

  it('rejects invalid identifiers deterministically', () => {
    expect(createAIConversationId('')).toBeNull()
    expect(createAIConversationId('conversation')).toBeNull()
    expect(createAIConversationId(' conversation:bad id ')).toBeNull()
  })
})

describe('createAIConversation', () => {
  it('creates a valid immutable conversation', () => {
    const result = createAIConversation({
      conversationId: 'conversation:main:001',
      status: 'OPEN',
      participants: [
        {
          participantId: 'user:1',
          role: 'USER',
          displayName: 'Primary User',
          active: true,
        },
        {
          participantId: 'assistant:1',
          role: 'ASSISTANT',
          active: true,
        },
      ],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
        tags: ['conversation', 'test'],
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.conversation.status).toBe('OPEN')
      expect(result.conversation.participants).toHaveLength(2)
      expect(Object.isFrozen(result.conversation)).toBe(true)
      expect(Object.isFrozen(result.conversation.participants)).toBe(true)

      expect(() => {
        ;(result.conversation.participants as Array<unknown>).push('x')
      }).toThrow()
    }
  })

  it('fails closed when conversation identifier is invalid', () => {
    const result = createAIConversation({
      conversationId: 'invalid-id',
      status: 'OPEN',
      participants: [
        {
          participantId: 'user:1',
          role: 'USER',
          active: true,
        },
      ],
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_CONVERSATION_ID')
      expect(result.retryable).toBe(false)
    }
  })
})
