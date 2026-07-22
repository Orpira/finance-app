import { describe, expect, it } from 'vitest'
import { createAIConversation } from '../aiConversationFactory'
import { createAIConversationService } from './aiConversationService'
import type { AIConversationReplyProvider } from './aiConversationReplyProvider'
import {
  AIInteractionPolicyEngine,
  AIInteractionPolicyRegistry,
  createDeterministicInteractionPolicy,
} from '../../ai-interaction/policies'
import type { AIInteraction } from '../../ai-interaction/aiInteractionContracts'

function createConversationFixture() {
  const created = createAIConversation({
    conversationId: 'conversation:service:001',
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

  if (created.kind !== 'success') {
    throw new Error('Expected valid conversation fixture')
  }

  return created.conversation
}

function createSessionFixture() {
  const service = createAIConversationService()
  const created = service.createConversationSession({
    sessionId: 'session:service:001',
    conversation: createConversationFixture(),
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })
  if (created.kind !== 'success') {
    throw new Error('Expected valid session fixture')
  }

  return created.value
}

function createInteractionFixture(): AIInteraction {
  return {
    protocolVersion: 1,
    interactionId: 'interaction:service:001',
    intent: 'EXPLAIN_INSIGHT',
    requiredCapabilities: ['TEXT_GENERATION'],
    policy: {
      policyId: 'conversation-preview',
      policyVersion: '1.0.0',
      purpose: 'EXPLAIN_INSIGHT',
      processingMode: 'LOCAL_ONLY',
    },
    status: 'CREATED',
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'CONVERSATION',
    },
  }
}

function createPolicyEngine(available: boolean) {
  const policy = createDeterministicInteractionPolicy({
    policyId: 'conversation-preview',
    policyVersion: '1.0.0',
    allowedIntents: ['EXPLAIN_INSIGHT', 'EDUCATIONAL_GUIDANCE'],
    allowedCapabilities: ['TEXT_GENERATION'],
    allowedProcessingModes: ['LOCAL_ONLY'],
    requireAuthorizedContext: false,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: false,
    featureAvailable: available,
  })

  return new AIInteractionPolicyEngine(new AIInteractionPolicyRegistry([policy]))
}

function createIdFactory() {
  const ids = {
    conversation: 0,
    interaction: 0,
    message: 0,
    session: 0,
  }

  return {
    create(kind: 'conversation' | 'interaction' | 'message' | 'session') {
      ids[kind] += 1
      return `${kind}:test:${String(ids[kind]).padStart(3, '0')}`
    },
  }
}

describe('AIConversationService', () => {
  it('starts a conversation session with empty history', () => {
    const service = createAIConversationService({
      idFactory: createIdFactory(),
      policyEngine: createPolicyEngine(true),
      now: () => '2026-07-22T10:00:00.000Z',
    })

    const started = service.startConversation({
      userDisplayName: 'Usuario',
      assistantDisplayName: 'Private Balance',
    })

    expect(started.kind).toBe('success')
    if (started.kind === 'success') {
      expect(started.value.messages).toHaveLength(0)
      expect(started.value.conversation.participants).toHaveLength(2)
      expect(started.value.status).toBe('CREATED')
    }
  })

  it('sends a message and appends an assistant reply through policy and lifecycle', async () => {
    const service = createAIConversationService({
      idFactory: createIdFactory(),
      policyEngine: createPolicyEngine(true),
      now: () => '2026-07-22T10:00:00.000Z',
    })

    const started = service.startConversation()
    if (started.kind !== 'success') {
      throw new Error('Expected conversation session fixture')
    }

    const result = await service.sendMessage({
      session: started.value,
      message: 'Necesito una explicacion simple.',
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.userMessage.role).toBe('USER')
      expect(result.value.assistantMessage.role).toBe('ASSISTANT')
      expect(result.value.session.messages).toHaveLength(2)
      expect(result.value.session.messages[1].content.value).toContain('Respuesta mock')
      expect(result.value.session.interaction?.lifecycleState).toBe('COMPLETED')
    }
  })

  it('fails when provider returns an error', async () => {
    const replyProvider: AIConversationReplyProvider = {
      async generateReply() {
        return {
          kind: 'failure',
          safeMessage: 'Provider unavailable.',
        }
      },
    }

    const service = createAIConversationService({
      idFactory: createIdFactory(),
      policyEngine: createPolicyEngine(true),
      replyProvider,
      now: () => '2026-07-22T10:00:00.000Z',
    })

    const started = service.startConversation()
    if (started.kind !== 'success') {
      throw new Error('Expected conversation session fixture')
    }

    const result = await service.sendMessage({
      session: started.value,
      message: 'Esto debe fallar.',
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INTERACTION_ERROR')
    }
  })

  it('fails when sending a message with an invalid session snapshot', async () => {
    const service = createAIConversationService({
      idFactory: createIdFactory(),
      policyEngine: createPolicyEngine(true),
      now: () => '2026-07-22T10:00:00.000Z',
    })

    const started = service.startConversation()
    if (started.kind !== 'success') {
      throw new Error('Expected conversation session fixture')
    }

    const invalidSession = {
      ...started.value,
      messages: [{ invalid: true }] as never,
    }

    const result = await service.sendMessage({
      session: invalidSession,
      message: 'Mensaje invalido.',
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_SESSION')
    }
  })

  it('creates conversation session in CREATED status', () => {
    const service = createAIConversationService()
    const result = service.createConversationSession({
      sessionId: 'session:service:created',
      conversation: createConversationFixture(),
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.value.status).toBe('CREATED')
    }
  })

  it('transitions session activate, pause, resume, complete and cancel', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()

    const active = service.activateConversationSession(created)
    expect(active.kind).toBe('success')
    if (active.kind !== 'success') return

    const paused = service.pauseConversationSession(active.value)
    expect(paused.kind).toBe('success')
    if (paused.kind !== 'success') return

    const resumed = service.resumeConversationSession(paused.value)
    expect(resumed.kind).toBe('success')
    if (resumed.kind !== 'success') return

    const completed = service.completeConversationSession(resumed.value)
    expect(completed.kind).toBe('success')
    if (completed.kind === 'success') {
      expect(completed.value.status).toBe('COMPLETED')
    }

    const cancelFromCreated = service.cancelConversationSession(created)
    expect(cancelFromCreated.kind).toBe('success')
    if (cancelFromCreated.kind === 'success') {
      expect(cancelFromCreated.value.status).toBe('CANCELLED')
    }
  })

  it('rejects invalid session transition deterministically', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()

    const invalid = service.pauseConversationSession(created)
    expect(invalid.kind).toBe('failure')
    if (invalid.kind === 'failure') {
      expect(invalid.code).toBe('INVALID_TRANSITION')
    }
  })

  it('creates user assistant and system messages', () => {
    const service = createAIConversationService()

    const user = service.createUserMessage({
      id: 'message:service:user:001',
      conversationId: 'conversation:service:001',
      sessionId: 'session:service:001',
      content: { value: 'User prompt' },
      sequence: 0,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: {
        generatedLocally: true,
      },
    })
    expect(user.kind).toBe('success')
    if (user.kind === 'success') {
      expect(user.value.role).toBe('USER')
    }

    const assistant = service.createAssistantMessage({
      id: 'message:service:assistant:001',
      conversationId: 'conversation:service:001',
      sessionId: 'session:service:001',
      content: { value: 'Assistant answer' },
      sequence: 1,
      createdAt: '2026-07-22T00:01:00.000Z',
      metadata: {
        generatedLocally: false,
        interactionId: 'interaction:service:001',
      },
    })
    expect(assistant.kind).toBe('success')
    if (assistant.kind === 'success') {
      expect(assistant.value.role).toBe('ASSISTANT')
    }

    const system = service.createSystemMessage({
      id: 'message:service:system:001',
      conversationId: 'conversation:service:001',
      sessionId: 'session:service:001',
      content: { value: 'System information' },
      sequence: 2,
      createdAt: '2026-07-22T00:02:00.000Z',
      metadata: {
        generatedLocally: true,
      },
    })
    expect(system.kind).toBe('success')
    if (system.kind === 'success') {
      expect(system.value.role).toBe('SYSTEM')
    }
  })

  it('appends messages preserving order and immutability', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()

    const message = service.createUserMessage({
      id: 'message:service:append:001',
      conversationId: created.conversation.conversationId,
      sessionId: created.sessionId,
      content: { value: 'append me' },
      sequence: 0,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: { generatedLocally: true },
    })
    if (message.kind !== 'success') {
      throw new Error('Expected valid message fixture')
    }

    const appended = service.appendMessage(created, message.value)
    expect(appended.kind).toBe('success')
    if (appended.kind === 'success') {
      expect(appended.value.messages).toHaveLength(1)
      expect(appended.value.messages[0].sequence).toBe(0)
      expect(Object.isFrozen(appended.value.messages)).toBe(true)
    }
  })

  it('rejects out-of-order and duplicated messages', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()

    const message = service.createUserMessage({
      id: 'message:service:dup:001',
      conversationId: created.conversation.conversationId,
      sessionId: created.sessionId,
      content: { value: 'first' },
      sequence: 0,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: { generatedLocally: true },
    })
    if (message.kind !== 'success') {
      throw new Error('Expected valid message fixture')
    }

    const appended = service.appendMessage(created, message.value)
    if (appended.kind !== 'success') {
      throw new Error('Expected first append to succeed')
    }

    const duplicateId = service.createAssistantMessage({
      id: 'message:service:dup:001',
      conversationId: created.conversation.conversationId,
      sessionId: created.sessionId,
      content: { value: 'same id different message' },
      sequence: 1,
      createdAt: '2026-07-22T00:01:00.000Z',
      metadata: { generatedLocally: true },
    })
    if (duplicateId.kind !== 'success') {
      throw new Error('Expected duplicate-id message fixture')
    }

    const duplicated = service.appendMessage(appended.value, duplicateId.value)
    expect(duplicated.kind).toBe('failure')
    if (duplicated.kind === 'failure') {
      expect(duplicated.code).toBe('DUPLICATE_MESSAGE')
    }

    const wrongSequence = service.createAssistantMessage({
      id: 'message:service:wrong-seq:001',
      conversationId: created.conversation.conversationId,
      sessionId: created.sessionId,
      content: { value: 'second' },
      sequence: 3,
      createdAt: '2026-07-22T00:01:00.000Z',
      metadata: { generatedLocally: true },
    })
    if (wrongSequence.kind !== 'success') {
      throw new Error('Expected valid message fixture')
    }

    const outOfOrder = service.appendMessage(appended.value, wrongSequence.value)
    expect(outOfOrder.kind).toBe('failure')
    if (outOfOrder.kind === 'failure') {
      expect(outOfOrder.code).toBe('INVALID_SEQUENCE')
    }
  })

  it('rejects appends on completed sessions', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()
    const active = service.activateConversationSession(created)
    if (active.kind !== 'success') {
      throw new Error('Expected active session')
    }

    const completed = service.completeConversationSession(active.value)
    if (completed.kind !== 'success') {
      throw new Error('Expected completed session')
    }

    const message = service.createUserMessage({
      id: 'message:service:closed:001',
      conversationId: completed.value.conversation.conversationId,
      sessionId: completed.value.sessionId,
      content: { value: 'late message' },
      sequence: 0,
      createdAt: '2026-07-22T00:02:00.000Z',
      metadata: { generatedLocally: true },
    })
    if (message.kind !== 'success') {
      throw new Error('Expected valid message fixture')
    }

    const appended = service.appendMessage(completed.value, message.value)
    expect(appended.kind).toBe('failure')
    if (appended.kind === 'failure') {
      expect(appended.code).toBe('SESSION_NOT_WRITABLE')
    }
  })

  it('returns immutable messages collection', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()
    const messages = service.getMessages(created)

    expect(messages.kind).toBe('success')
    if (messages.kind === 'success') {
      expect(Object.isFrozen(messages.value)).toBe(true)
      expect(() => {
        ;(messages.value as Array<unknown>).push('x')
      }).toThrow()
    }
  })

  it('returns participants and statuses from session', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()

    const participants = service.getParticipants(created)
    const conversationStatus = service.getConversationStatus(created)
    const sessionStatus = service.getSessionStatus(created)

    expect(participants.kind).toBe('success')
    expect(conversationStatus.kind).toBe('success')
    expect(sessionStatus.kind).toBe('success')

    if (participants.kind === 'success') {
      expect(participants.value).toHaveLength(2)
    }
    if (conversationStatus.kind === 'success') {
      expect(conversationStatus.value).toBe('OPEN')
    }
    if (sessionStatus.kind === 'success') {
      expect(sessionStatus.value).toBe('CREATED')
    }
  })

  it('integrates with policy engine and interaction lifecycle', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()
    const policyEngine = createPolicyEngine(true)

    const withPolicy = service.evaluateInteractionPolicy(
      created,
      createInteractionFixture(),
      policyEngine,
      {
        hasAuthorizedContext: true,
        hasUserConfirmation: true,
        containsSensitiveData: false,
        redactionApplied: true,
      },
    )

    expect(withPolicy.kind).toBe('success')
    if (withPolicy.kind !== 'success') return

    const moved = service.applyInteractionLifecycleEvent(withPolicy.value, 'VALIDATE')
    expect(moved.kind).toBe('success')
    if (moved.kind === 'success') {
      expect(moved.value.interaction?.lifecycleState).toBe('VALIDATED')
    }
  })

  it('fails closed when policy is denied', () => {
    const service = createAIConversationService()
    const created = createSessionFixture()

    const denied = service.evaluateInteractionPolicy(
      created,
      createInteractionFixture(),
      createPolicyEngine(false),
      {
        hasAuthorizedContext: true,
        hasUserConfirmation: true,
        containsSensitiveData: false,
        redactionApplied: true,
      },
    )

    expect(denied.kind).toBe('failure')
    if (denied.kind === 'failure') {
      expect(denied.code).toBe('POLICY_DENIED')
    }
  })

  it('rejects invalid message payloads', () => {
    const service = createAIConversationService()
    const invalid = service.createUserMessage({
      id: 'message:service:invalid:001',
      conversationId: 'conversation:service:001',
      sessionId: 'session:service:001',
      content: { value: '   ' },
      sequence: 0,
      createdAt: '2026-07-22T00:00:00.000Z',
      metadata: { generatedLocally: true },
    })

    expect(invalid.kind).toBe('failure')
    if (invalid.kind === 'failure') {
      expect(invalid.code).toBe('INVALID_MESSAGE')
    }
  })
})
