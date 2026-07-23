import { describe, expect, it, vi } from 'vitest'

import type {
  AIConversationApplicationResult,
  AIConversationApplicationSendResponse,
  AIConversationApplicationService,
} from '../src/application/ai-conversation'
import {
  AIInteractionPolicyEngine,
  AIInteractionPolicyRegistry,
  createDeterministicInteractionPolicy,
} from '../src/intelligence/ai-interaction/policies'
import {
  createAIConversationService,
} from '../src/intelligence/ai-conversation/service'
import type { AIConversationSessionSnapshot } from '../src/intelligence/ai-conversation/session'
import { createConversationController } from '../src/pages/Conversation/conversationController'

function createPolicyEngine() {
  const policy = createDeterministicInteractionPolicy({
    policyId: 'conversation-preview',
    policyVersion: '1.0.0',
    allowedIntents: ['EDUCATIONAL_GUIDANCE'],
    allowedCapabilities: ['TEXT_GENERATION'],
    allowedProcessingModes: ['LOCAL_ONLY'],
    requireAuthorizedContext: false,
    requireUserConfirmation: false,
    requireRedactionForSensitiveData: false,
    featureAvailable: true,
  })

  return new AIInteractionPolicyEngine(new AIInteractionPolicyRegistry([policy]))
}

function createSessionFixture(): AIConversationSessionSnapshot {
  const service = createAIConversationService({
    policyEngine: createPolicyEngine(),
  })

  const started = service.startConversation({
    userDisplayName: 'Usuario',
    assistantDisplayName: 'Private Balance AI',
  })

  if (started.kind !== 'success') {
    throw new Error('Expected a valid session fixture')
  }

  return started.value
}

function createSendMessageFailureResult(): AIConversationApplicationResult<AIConversationApplicationSendResponse> {
  return {
    kind: 'failure',
    code: 'SEND_MESSAGE_FAILED',
    retryable: false,
    safeMessage: 'No-op para pruebas de initialize.',
  }
}

function createApplicationServiceMock(input: {
  readonly startConversation: AIConversationApplicationService['startConversation']
  readonly loadSession?: AIConversationApplicationService['loadSession']
  readonly saveSession?: AIConversationApplicationService['saveSession']
}): AIConversationApplicationService {
  return {
    startConversation: input.startConversation,
    sendMessage: vi.fn(async () => createSendMessageFailureResult()),
    loadSession: input.loadSession ?? vi.fn(async () => ({
      kind: 'failure',
      code: 'SESSION_NOT_FOUND',
      retryable: false,
      safeMessage: 'No se encontro una sesion conversacional en memoria local.',
    })),
    saveSession: input.saveSession ?? vi.fn(async (request) => ({
      kind: 'success',
      value: {
        session: request.session,
        retention: {
          evictionStrategy: 'KEEP_MOST_RECENT',
          maxSessions: 25,
          maxMessagesPerSession: 300,
          evictedSessionIds: [],
          evictedCount: 0,
          messagesTruncated: false,
        },
      },
    })),
    listSessions: vi.fn(async () => ({ kind: 'success', value: [] })),
    deleteSession: vi.fn(async () => ({ kind: 'success', value: { deleted: false } })),
    clearMemory: vi.fn(async () => ({ kind: 'success', value: { deletedCount: 0 } })),
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve
  })

  return {
    promise,
    resolve,
  }
}

describe('ConversationController.initialize', () => {
  it('recupera una sesion existente y no crea una nueva', async () => {
    const existingSession = createSessionFixture()
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createSessionFixture(),
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession: vi.fn(async () => ({ kind: 'success', value: existingSession })),
      }),
    })

    await controller.initialize()

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.session?.sessionId).toBe(existingSession.sessionId)
    expect(state.messages).toEqual(existingSession.messages)
    expect(startConversation).not.toHaveBeenCalled()
  })

  it('crea una sesion nueva solo cuando loadSession retorna SESSION_NOT_FOUND', async () => {
    const createdSession = createSessionFixture()
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createdSession,
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession: vi.fn(async () => ({
          kind: 'failure',
          code: 'SESSION_NOT_FOUND',
          retryable: false,
          safeMessage: 'No se encontro una sesion conversacional en memoria local.',
        })),
      }),
    })

    await controller.initialize()

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.session?.sessionId).toBe(createdSession.sessionId)
    expect(state.messages).toEqual(createdSession.messages)
    expect(startConversation).toHaveBeenCalledTimes(1)
  })

  it('si loadSession falla con MEMORY_READ_FAILED, publica memory-error y no crea sesion nueva', async () => {
    const createdSession = createSessionFixture()
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createdSession,
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession: vi.fn(async () => ({
          kind: 'failure',
          code: 'MEMORY_READ_FAILED',
          retryable: true,
          safeMessage: 'Read failed',
        })),
      }),
    })

    await controller.initialize()

    const state = controller.getState()
    expect(state.status).toBe('memory-error')
    expect(state.session).toBeNull()
    expect(startConversation).not.toHaveBeenCalled()
  })

  it('si loadSession falla con MEMORY_CORRUPTED, no crea sesion nueva', async () => {
    const createdSession = createSessionFixture()
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createdSession,
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession: vi.fn(async () => ({
          kind: 'failure',
          code: 'MEMORY_CORRUPTED',
          retryable: false,
          safeMessage: 'Corrupted session',
        })),
      }),
    })

    await controller.initialize()

    expect(controller.getState().status).toBe('memory-error')
    expect(startConversation).not.toHaveBeenCalled()
  })

  it('si loadSession falla con MEMORY_VERSION_UNSUPPORTED, no crea sesion nueva', async () => {
    const createdSession = createSessionFixture()
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createdSession,
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession: vi.fn(async () => ({
          kind: 'failure',
          code: 'MEMORY_VERSION_UNSUPPORTED',
          retryable: false,
          safeMessage: 'Unsupported version',
        })),
      }),
    })

    await controller.initialize()

    expect(controller.getState().status).toBe('memory-error')
    expect(startConversation).not.toHaveBeenCalled()
  })

  it('evita doble inicializacion concurrente y ejecuta una sola vez', async () => {
    const createdSession = createSessionFixture()
    const gate = deferred<void>()
    const loadSession = vi.fn(async () => {
      await gate.promise
      return {
        kind: 'failure' as const,
        code: 'SESSION_NOT_FOUND',
        retryable: false,
        safeMessage: 'No se encontro una sesion conversacional en memoria local.',
      }
    })
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createdSession,
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession,
      }),
    })

    const initA = controller.initialize()
    const initB = controller.initialize()

    expect(loadSession).toHaveBeenCalledTimes(1)

    gate.resolve()
    await Promise.all([initA, initB])

    expect(startConversation).toHaveBeenCalledTimes(1)
    expect(controller.getState().status).toBe('ready')
  })

  it('no deja promise rejection sin manejar cuando initialize se invoca sin await', async () => {
    const startConversation = vi.fn(() => {
      throw new Error('unexpected startup failure')
    })

    const controller = createConversationController({
      service: createApplicationServiceMock({ startConversation }),
    })

    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason)
    }

    process.on('unhandledRejection', onUnhandled)
    try {
      void controller.initialize()
      await Promise.resolve()
      await new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 0)
      })
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }

    expect(unhandled).toHaveLength(0)
    expect(controller.getState().status).toBe('error')
    expect(controller.getState().errorMessage).toBe('No se pudo iniciar la sesion de conversacion.')
  })

  it('reanuda emisiones tras dispose y nueva suscripcion (compatible con StrictMode)', async () => {
    const createdSession = createSessionFixture()
    const startConversation = vi.fn(() => ({
      kind: 'success' as const,
      value: createdSession,
    }))

    const controller = createConversationController({
      service: createApplicationServiceMock({
        startConversation,
        loadSession: vi.fn(async () => ({
          kind: 'failure',
          code: 'SESSION_NOT_FOUND',
          retryable: false,
          safeMessage: 'No se encontro una sesion conversacional en memoria local.',
        })),
      }),
    })

    const firstStates: string[] = []
    const unsubscribe = controller.subscribe((nextState) => {
      firstStates.push(nextState.status)
    })

    unsubscribe()
    controller.dispose()

    const secondStates: string[] = []
    controller.subscribe((nextState) => {
      secondStates.push(nextState.status)
    })

    await controller.initialize()

    expect(secondStates).toContain('loading-memory')
    expect(secondStates).toContain('ready')
    expect(controller.getState().status).toBe('ready')
    expect(firstStates[0]).toBe('idle')
  })
})
