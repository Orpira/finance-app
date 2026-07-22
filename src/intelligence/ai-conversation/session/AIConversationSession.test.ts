import { describe, expect, it } from 'vitest'
import { createAIConversation } from '../aiConversationFactory'
import { createAIConversationMessage } from '../message/AIConversationMessageFactory'
import { AIConversationSession } from './AIConversationSession'
import { createAIConversationSession } from './AIConversationSessionFactory'
import {
  AIInteractionPolicyEngine,
  AIInteractionPolicyRegistry,
  createDeterministicInteractionPolicy,
} from '../../ai-interaction/policies'
import type { AIInteraction } from '../../ai-interaction/aiInteractionContracts'

function createValidConversation() {
  const result = createAIConversation({
    conversationId: 'conversation:session:001',
    status: 'OPEN',
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
    ],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (result.kind !== 'success') {
    throw new Error('Expected a valid conversation fixture.')
  }

  return result.conversation
}

function createAggregate(status: 'CREATED' | 'ACTIVE' | 'PAUSED' = 'CREATED') {
  const messageResult = createAIConversationMessage({
    id: 'message:main:001',
    conversationId: 'conversation:session:001',
    sessionId: 'session:main:001',
    role: 'USER',
    content: {
      value: 'Hello session',
    },
    sequence: 0,
    createdAt: '2026-07-22T00:00:00.000Z',
    metadata: {
      contractVersion: 1,
      generatedLocally: true,
    },
  })

  if (messageResult.kind !== 'success') {
    throw new Error('Expected a valid message fixture.')
  }

  const result = createAIConversationSession({
    sessionId: 'session:main:001',
    conversation: createValidConversation(),
    status,
    messages: [messageResult.message],
    metadata: {
      createdAt: '2026-07-22T00:00:00.000Z',
      source: 'APPLICATION',
    },
  })

  if (result.kind !== 'success') {
    throw new Error('Expected a valid session fixture.')
  }

  return new AIConversationSession(result.session)
}

function createPolicyEngine(allow: boolean) {
  const policy = createDeterministicInteractionPolicy({
    policyId: 'session-policy',
    policyVersion: '1.0.0',
    allowedIntents: ['EXPLAIN_INSIGHT'],
    allowedCapabilities: ['TEXT_GENERATION'],
    allowedProcessingModes: ['LOCAL_ONLY'],
    requireAuthorizedContext: false,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: false,
    featureAvailable: allow,
  })

  return new AIInteractionPolicyEngine(new AIInteractionPolicyRegistry([policy]))
}

function createInteraction(): AIInteraction {
  return {
    protocolVersion: 1,
    interactionId: 'interaction:001',
    intent: 'EXPLAIN_INSIGHT',
    requiredCapabilities: ['TEXT_GENERATION'],
    policy: {
      policyId: 'session-policy',
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

describe('AIConversationSession aggregate', () => {
  it('creates a valid session', () => {
    const result = createAIConversationSession({
      sessionId: 'session:main:001',
      conversation: createValidConversation(),
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.session.status).toBe('CREATED')
      expect(result.session.participants).toHaveLength(2)
    }
  })

  it('activates a created session', () => {
    const result = createAggregate('CREATED').activate()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.session.status).toBe('ACTIVE')
    }
  })

  it('pauses an active session', () => {
    const result = createAggregate('ACTIVE').pause()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.session.status).toBe('PAUSED')
    }
  })

  it('resumes a paused session', () => {
    const result = createAggregate('PAUSED').resume()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.session.status).toBe('ACTIVE')
    }
  })

  it('completes an active session', () => {
    const result = createAggregate('ACTIVE').complete()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.session.status).toBe('COMPLETED')
    }
  })

  it('cancels a session', () => {
    const result = createAggregate('CREATED').cancel()
    expect(result.kind).toBe('success')
    if (result.kind === 'success') {
      expect(result.session.status).toBe('CANCELLED')
    }
  })

  it('rejects invalid transitions deterministically', () => {
    const result = createAggregate('CREATED').pause()
    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_SESSION_TRANSITION')
      expect(result.retryable).toBe(false)
    }
  })

  it('rejects invalid session id', () => {
    const result = createAIConversationSession({
      sessionId: 'bad-id',
      conversation: createValidConversation(),
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_SESSION_ID')
    }
  })

  it('rejects invalid metadata', () => {
    const result = createAIConversationSession({
      sessionId: 'session:main:001',
      conversation: createValidConversation(),
      metadata: {
        createdAt: '',
        source: 'APPLICATION',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_SESSION')
    }
  })

  it('rejects invalid status', () => {
    const result = createAIConversationSession({
      sessionId: 'session:main:001',
      conversation: createValidConversation(),
      status: 'RUNNING' as 'CREATED',
      metadata: {
        createdAt: '2026-07-22T00:00:00.000Z',
        source: 'APPLICATION',
      },
    })

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('INVALID_SESSION')
    }
  })

  it('is observably immutable', () => {
    const aggregate = createAggregate('CREATED')
    const snapshot = aggregate.getSnapshot()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.messages)).toBe(true)
    expect(() => {
      ;(snapshot.messages as Array<unknown>).push('message:2')
    }).toThrow()
  })

  it('integrates policy engine and interaction lifecycle', () => {
    const aggregate = createAggregate('ACTIVE')
    const policyResult = aggregate.evaluateInteractionPolicy(
      createInteraction(),
      createPolicyEngine(true),
      {
        hasAuthorizedContext: true,
        hasUserConfirmation: true,
        containsSensitiveData: false,
        redactionApplied: true,
      },
    )

    expect(policyResult.kind).toBe('success')
    if (policyResult.kind === 'success') {
      const withInteraction = new AIConversationSession(policyResult.session)
      const lifecycleResult = withInteraction.applyInteractionLifecycleEvent('VALIDATE')
      expect(lifecycleResult.kind).toBe('success')
      if (lifecycleResult.kind === 'success') {
        expect(lifecycleResult.session.interaction?.lifecycleState).toBe('VALIDATED')
      }
    }
  })

  it('fails closed when policy does not allow interaction', () => {
    const result = createAggregate('ACTIVE').evaluateInteractionPolicy(
      createInteraction(),
      createPolicyEngine(false),
      {
        hasAuthorizedContext: true,
        hasUserConfirmation: true,
        containsSensitiveData: false,
        redactionApplied: true,
      },
    )

    expect(result.kind).toBe('failure')
    if (result.kind === 'failure') {
      expect(result.code).toBe('POLICY_DENIED')
    }
  })
})
