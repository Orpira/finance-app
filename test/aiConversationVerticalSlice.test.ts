import { describe, expect, it, vi } from 'vitest'

import type {
  AIConversationService,
  AIConversationServiceResult,
} from '../src/intelligence/ai-conversation/service'
import {
  AIInteractionPolicyEngine,
  AIInteractionPolicyRegistry,
  createDeterministicInteractionPolicy,
} from '../src/intelligence/ai-interaction/policies'
import {
  createAIConversationService,
} from '../src/intelligence/ai-conversation/service'
import type { AIConversationReplyProvider } from '../src/intelligence/ai-conversation/service'
import type { AIConversationSessionSnapshot } from '../src/intelligence/ai-conversation/session'
import {
  createConversationController,
} from '../src/pages/Conversation/conversationController'

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

function createService(input: {
  readonly replyProvider?: AIConversationReplyProvider
} = {}): AIConversationService {
  return createAIConversationService({
    policyEngine: createPolicyEngine(),
    ...(input.replyProvider === undefined
      ? {}
      : { replyProvider: input.replyProvider }),
  })
}

function createStartedSession(service: AIConversationService): AIConversationSessionSnapshot {
  const started = service.startConversation({
    userDisplayName: 'Usuario',
    assistantDisplayName: 'Private Balance AI',
  })

  if (started.kind !== 'success') {
    throw new Error('Expected started session fixture')
  }

  return started.value
}

function createMockFailureResult(): AIConversationServiceResult<never> {
  return {
    kind: 'failure',
    code: 'INVALID_SESSION',
    retryable: false,
    safeMessage: 'Sesion invalida.',
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

describe('AI Conversation Vertical Slice controller (Milestone 9H)', () => {
  it('estado inicial', () => {
    const controller = createConversationController({
      service: createService(),
    })

    expect(controller.getState()).toEqual({
      status: 'idle',
      session: null,
      messages: [],
      errorMessage: null,
    })
  })

  it('crea sesion e inicia con historial vacio', async () => {
    const controller = createConversationController({
      service: createService(),
    })

    await controller.initialize()

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.session).not.toBeNull()
    expect(state.messages).toHaveLength(0)
  })

  it('envia mensaje, crea USER y ASSISTANT, y actualiza historial', async () => {
    const controller = createConversationController({
      service: createService(),
    })

    await controller.initialize()
    await controller.sendMessage('Necesito una explicacion simple')

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].role).toBe('USER')
    expect(state.messages[1].role).toBe('ASSISTANT')
    expect(state.messages[1].content.value).toContain('Respuesta mock')
  })

  it('expone estado de carga durante envio', async () => {
    const startedService = createService()
    const session = createStartedSession(startedService)
    const pending = deferred<Awaited<ReturnType<AIConversationService['sendMessage']>>>()

    const service: AIConversationService = {
      ...startedService,
      startConversation: vi.fn(() => ({
        kind: 'success',
        value: session,
      })),
      sendMessage: vi.fn(async () => pending.promise),
    }

    const controller = createConversationController({ service })
    await controller.initialize()

    const sendPromise = controller.sendMessage('Hola')
    expect(controller.getState().status).toBe('sending')

    const successResponse = await startedService.sendMessage({
      session,
      message: 'Hola',
    })
    pending.resolve(successResponse)

    await sendPromise
    expect(controller.getState().status).toBe('ready')
  })

  it('maneja error del proveedor', async () => {
    const service = createService({
      replyProvider: {
        async generateReply() {
          return {
            kind: 'failure',
            safeMessage: 'Proveedor no disponible.',
          }
        },
      },
    })

    const controller = createConversationController({ service })
    await controller.initialize()
    await controller.sendMessage('Hola')

    const state = controller.getState()
    expect(state.status).toBe('error')
    expect(state.errorMessage).toContain('Proveedor no disponible.')
  })

  it('maneja sesion invalida al enviar', async () => {
    const baseService = createService()
    const session = createStartedSession(baseService)

    const service: AIConversationService = {
      ...baseService,
      startConversation: vi.fn(() => ({
        kind: 'success',
        value: session,
      })),
      sendMessage: vi.fn(async () => createMockFailureResult()),
    }

    const controller = createConversationController({ service })
    await controller.initialize()
    await controller.sendMessage('Hola')

    const state = controller.getState()
    expect(state.status).toBe('error')
    expect(state.errorMessage).toBe('Sesion invalida.')
  })
})
