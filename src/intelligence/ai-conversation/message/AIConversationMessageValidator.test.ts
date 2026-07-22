import { describe, expect, it } from 'vitest'
import { createAIConversation } from '../aiConversationFactory'
import { createAIConversationSession } from '../session/AIConversationSessionFactory'
import type { AIConversationMessage } from './AIConversationMessageContracts'
import {
  isAIConversationMessageRole,
  validateAIConversationMessage,
  validateAIConversationMessageContent,
  validateAIConversationMessageMetadata,
  validateAIConversationMessageSequence,
  validateAIConversationMessageStatus,
} from './AIConversationMessageValidator'

function messageFixture(overrides: Partial<AIConversationMessage> = {}): AIConversationMessage {
  const conversation = createAIConversation({
    conversationId: 'conversation:message:validator',
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

  if (conversation.kind !== 'success') {
    throw new Error('Expected valid conversation fixture')
  }

  const session = createAIConversationSession({
    sessionId: 'session:message:validator',
    conversation: conversation.conversation,
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (session.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  return {
    protocolVersion: 1,
    id: 'message:validator:001' as AIConversationMessage['id'],
    conversationId: conversation.conversation.conversationId,
    sessionId: session.session.sessionId,
    role: 'USER',
    content: {
      kind: 'TEXT',
      value: 'Hello',
      format: 'PLAIN_TEXT',
    },
    status: 'READY',
    sequence: 0 as AIConversationMessage['sequence'],
    createdAt: '2026-07-22T00:00:00.000Z',
    metadata: {
      contractVersion: 1,
      generatedLocally: true,
    },
    ...overrides,
  }
}

describe('isAIConversationMessageRole', () => {
  it('accepts supported roles', () => {
    expect(isAIConversationMessageRole('USER')).toBe(true)
    expect(isAIConversationMessageRole('ASSISTANT')).toBe(true)
    expect(isAIConversationMessageRole('SYSTEM')).toBe(true)
  })

  it('rejects unknown roles', () => {
    expect(isAIConversationMessageRole('TOOL')).toBe(false)
  })
})

describe('AIConversationMessage validators', () => {
  it('accepts a valid message', () => {
    expect(validateAIConversationMessage(messageFixture())).toBeNull()
  })

  it('rejects invalid content', () => {
    expect(
      validateAIConversationMessageContent({
        kind: 'TEXT',
        value: ' ',
        format: 'PLAIN_TEXT',
      }),
    )?.toBeDefined()
  })

  it('rejects invalid status', () => {
    expect(validateAIConversationMessageStatus('BROKEN' as 'CREATED')).not.toBeNull()
  })

  it('rejects invalid sequence', () => {
    expect(validateAIConversationMessageSequence(-1)).not.toBeNull()
    expect(validateAIConversationMessageSequence(Number.NaN)).not.toBeNull()
  })

  it('rejects invalid metadata', () => {
    expect(
      validateAIConversationMessageMetadata({
        contractVersion: 1,
        generatedLocally: true,
        correlationId: ' ',
      }),
    ).not.toBeNull()
  })

  it('rejects invalid conversation/session references', () => {
    expect(
      validateAIConversationMessage({
        ...messageFixture(),
        conversationId: 'conversation' as AIConversationMessage['conversationId'],
      }),
    ).not.toBeNull()
  })
})
