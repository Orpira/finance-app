import { describe, expect, it, vi } from 'vitest'

import type {
  AIConversationApplicationService,
  AIConversationApplicationSendResponse,
} from '../src/application/ai-conversation'
import { createAIConversationService } from '../src/intelligence/ai-conversation/service'
import type { AIConversationSessionSnapshot } from '../src/intelligence/ai-conversation/session'
import { createConversationController } from '../src/pages/Conversation/conversationController'

function createSessionFixture(): AIConversationSessionSnapshot {
  const service = createAIConversationService()
  const started = service.startConversation({
    userDisplayName: 'Usuario',
    assistantDisplayName: 'Private Balance AI',
    createdAt: '2026-07-23T00:00:00.000Z',
  })

  if (started.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  return started.value
}

function createSendResponseWithAssistantMessage(
  session: AIConversationSessionSnapshot,
): AIConversationApplicationSendResponse {
  const conversationService = createAIConversationService()
  const userMessage = conversationService.createUserMessage({
    id: 'message:user:memory-failure:001',
    conversationId: session.conversation.conversationId,
    sessionId: session.sessionId,
    content: { value: 'Hola' },
    sequence: session.messages.length,
    createdAt: '2026-07-23T00:00:01.000Z',
    metadata: { generatedLocally: true },
  })
  if (userMessage.kind !== 'success') {
    throw new Error('Expected valid user message fixture')
  }

  const withUser = conversationService.appendMessage(session, userMessage.value)
  if (withUser.kind !== 'success') {
    throw new Error('Expected session append success for user message')
  }

  const assistantMessage = conversationService.createAssistantMessage({
    id: 'message:assistant:memory-failure:001',
    conversationId: session.conversation.conversationId,
    sessionId: session.sessionId,
    content: { value: 'Respuesta pipeline' },
    sequence: withUser.value.messages.length,
    createdAt: '2026-07-23T00:00:02.000Z',
    metadata: { generatedLocally: false },
  })
  if (assistantMessage.kind !== 'success') {
    throw new Error('Expected valid assistant message fixture')
  }

  const finalSession = conversationService.appendMessage(withUser.value, assistantMessage.value)
  if (finalSession.kind !== 'success') {
    throw new Error('Expected final session append success')
  }

  return {
    session: finalSession.value,
    userMessage: userMessage.value,
    assistantMessage: assistantMessage.value,
  }
}

describe('ConversationController persistence failure after successful AI pipeline', () => {
  it('keeps session safe, avoids duplicate provider calls and reports memory-error state', async () => {
    const startedSession = createSessionFixture()
    const sendResponse = createSendResponseWithAssistantMessage(startedSession)

    const sendMessage = vi.fn(async () => ({
      kind: 'success' as const,
      value: sendResponse,
    }))

    const service: AIConversationApplicationService = {
      startConversation: vi.fn(() => ({ kind: 'success', value: startedSession })),
      loadSession: vi.fn(async () => ({
        kind: 'failure',
        code: 'SESSION_NOT_FOUND',
        retryable: false,
        safeMessage: 'No session yet',
      })),
      saveSession: vi.fn(async () => ({
        kind: 'failure',
        code: 'MEMORY_WRITE_FAILED',
        retryable: true,
        safeMessage: 'Disk write failed',
      })),
      listSessions: vi.fn(async () => ({ kind: 'success', value: [] })),
      deleteSession: vi.fn(async () => ({ kind: 'success', value: { deleted: false } })),
      clearMemory: vi.fn(async () => ({ kind: 'success', value: { deletedCount: 0 } })),
      sendMessage,
    }

    const controller = createConversationController({ service })
    await controller.initialize()
    await controller.sendMessage('Hola')

    expect(sendMessage).toHaveBeenCalledTimes(1)

    const state = controller.getState()
    expect(state.status).toBe('memory-error')
    expect(state.errorMessage).toContain('Disk write failed')
    expect(state.session?.sessionId).toBe(sendResponse.session.sessionId)
    expect(state.messages).toHaveLength(sendResponse.session.messages.length)

    const userCount = state.messages.filter((item) => item.role === 'USER').length
    const assistantCount = state.messages.filter((item) => item.role === 'ASSISTANT').length
    expect(userCount).toBe(1)
    expect(assistantCount).toBe(1)
  })
})
