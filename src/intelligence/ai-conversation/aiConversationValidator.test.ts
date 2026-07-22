import { describe, expect, it } from 'vitest'
import type { AIConversation, AIConversationId } from './aiConversationContracts'
import {
  isAIConversationRole,
  validateAIConversation,
  validateAIConversationMetadata,
  validateAIConversationParticipant,
} from './aiConversationValidator'

function conversationId(value: string): AIConversationId {
  return value as AIConversationId
}

const validConversation = {
  protocolVersion: 1,
  conversationId: conversationId('conversation:main:001'),
  status: 'ACTIVE',
  participants: [
    {
      participantId: 'user:1',
      role: 'USER',
      active: true,
    },
    {
      participantId: 'assistant:1',
      role: 'ASSISTANT',
      active: true,
    },
    {
      participantId: 'system:1',
      role: 'SYSTEM',
      active: true,
    },
  ],
  metadata: {
    createdAt: '2026-07-22T00:00:00.000Z',
    updatedAt: '2026-07-22T00:01:00.000Z',
    source: 'SYSTEM',
    tags: ['conversation'],
  },
} as const satisfies AIConversation

describe('isAIConversationRole', () => {
  it('accepts the supported roles', () => {
    expect(isAIConversationRole('USER')).toBe(true)
    expect(isAIConversationRole('ASSISTANT')).toBe(true)
    expect(isAIConversationRole('SYSTEM')).toBe(true)
  })

  it('rejects unknown roles', () => {
    expect(isAIConversationRole('TOOL')).toBe(false)
  })
})

describe('AI Conversation validators', () => {
  it('accepts a valid conversation', () => {
    expect(validateAIConversation(validConversation)).toBeNull()
  })

  it('rejects invalid metadata', () => {
    const failure = validateAIConversationMetadata({
      createdAt: '',
      source: 'APPLICATION',
    })

    expect(failure?.code).toBe('INVALID_METADATA')
  })

  it('rejects invalid participants', () => {
    const failure = validateAIConversationParticipant({
      participantId: '',
      role: 'USER',
      active: true,
    })

    expect(failure?.code).toBe('INVALID_PARTICIPANT')
  })

  it('rejects invalid participant roles', () => {
    const failure = validateAIConversationParticipant({
      participantId: 'user:1',
      role: 'TOOL' as 'USER',
      active: true,
    })

    expect(failure?.code).toBe('INVALID_PARTICIPANT')
  })

  it('rejects conversations with duplicated participants', () => {
    const failure = validateAIConversation({
      ...validConversation,
      participants: [
        {
          participantId: 'user:1',
          role: 'USER',
          active: true,
        },
        {
          participantId: 'user:1',
          role: 'ASSISTANT',
          active: true,
        },
      ],
    })

    expect(failure?.code).toBe('INVALID_PARTICIPANT')
  })

  it('rejects conversations with invalid status', () => {
    const failure = validateAIConversation({
      ...validConversation,
      status: 'EXECUTING' as 'ACTIVE',
    })

    expect(failure?.code).toBe('INVALID_CONVERSATION')
  })

  it('rejects conversations without participants', () => {
    const failure = validateAIConversation({
      ...validConversation,
      participants: [],
    })

    expect(failure?.code).toBe('INVALID_CONVERSATION')
  })
})
