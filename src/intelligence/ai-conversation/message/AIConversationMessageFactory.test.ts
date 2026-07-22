import { describe, expect, it } from 'vitest'
import { createAIConversation } from '../aiConversationFactory'
import { createAIConversationSession } from '../session/AIConversationSessionFactory'
import { createAIConversationMessage, createAIConversationMessageContent, createAIConversationMessageId } from './AIConversationMessageFactory'

function createConversationFixture() {
  const result = createAIConversation({
    conversationId: 'conversation:message:001',
    status: 'OPEN',
    participants: [
      { participantId: 'user:1', role: 'USER', active: true },
      { participantId: 'assistant:1', role: 'ASSISTANT', active: true },
    ],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (result.kind !== 'success') {
    throw new Error('Expected valid conversation fixture')
  }

  return result.conversation
}

function createSessionId() {
  const result = createAIConversationSession({
    sessionId: 'session:message:001',
    conversation: createConversationFixture(),
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (result.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  return result.session.sessionId
}

describe('createAIConversationMessageId', () => {
  it('accepts a canonical message identifier', () => {
    expect(createAIConversationMessageId('message:main:001')).toBe('message:main:001')
  })

  it('rejects invalid identifiers deterministically', () => {
    expect(createAIConversationMessageId('')).toBeNull()
    expect(createAIConversationMessageId('message')).toBeNull()
  })
})

describe('createAIConversationMessageContent', () => {
  it('accepts textual content with explicit format', () => {
    const content = createAIConversationMessageContent({
      kind: 'TEXT',
      value: 'Hello world',
      format: 'PLAIN_TEXT',
    })

    expect(content).not.toBeNull()
    expect(content?.kind).toBe('TEXT')
  })

  it('rejects whitespace-only content', () => {
    expect(
      createAIConversationMessageContent({
        kind: 'TEXT',
        value: '   ',
        format: 'PLAIN_TEXT',
      }),
    ).toBeNull()
  })
})

describe('createAIConversationMessage', () => {
  it('creates an immutable message with sequence zero', () => {
    const result = createAIConversationMessage({
      id: 'message:main:001',
      conversationId: 'conversation:message:001',
      sessionId: createSessionId(),
      role: 'USER',
      content: {
        value: 'User asked a question.',
      },
      status: 'CREATED',
      sequence: 0,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: {
        contractVersion: 1,
        generatedLocally: true,
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.message.sequence).toBe(0)
      expect(Object.isFrozen(result.message)).toBe(true)
      expect(Object.isFrozen(result.message.content)).toBe(true)
    }
  })

  it('fails closed for invalid content and metadata', () => {
    const result = createAIConversationMessage({
      id: 'message:main:002',
      conversationId: 'conversation:message:001',
      sessionId: createSessionId(),
      role: 'ASSISTANT',
      content: {
        value: ' ',
      },
      status: 'CREATED',
      sequence: 1,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: {
        contractVersion: 1,
        generatedLocally: false,
        interactionId: '',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_MESSAGE_CONTENT')
    }
  })
})
