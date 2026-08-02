import { describe, expect, it, vi } from 'vitest'

import type { ChatMessage } from '../src/intelligence/mock-conversational-renderer/mockConversationalRenderer'
import {
  createConversationController,
  validateConversationUiState,
} from '../src/pages/Conversation/conversationController'

function createChatMessageFixture(input: {
  readonly messageId: string
  readonly text: string
  readonly responseId?: string
  readonly timestamp?: string
}): ChatMessage {
  const timestamp = input.timestamp ?? '2026-07-24T12:00:01.000Z'
  const responseId = input.responseId ?? 'conversation-response:test:001'

  return {
    protocolVersion: 1,
    messageId: input.messageId,
    type: 'assistant',
    origin: 'MOCK_RENDERER',
    timestamp,
    text: input.text,
    responseId,
    conversationResponse: {
      protocolVersion: 1,
      responseId,
      metadata: {
        createdAt: timestamp,
        blockCount: 1,
        failClosed: true,
      },
      execution: {
        executionId: 'execution:test:001',
        promptContextId: 'prompt-context:test:001',
        status: 'success',
        startedAt: '2026-07-24T12:00:00.000Z',
        finishedAt: timestamp,
      },
      blocks: [
        {
          kind: 'summary',
          summaryText: input.text,
          sourceStepIds: ['step-1'],
        },
      ],
      promptContext: {
        protocolVersion: 1,
        promptContextId: 'prompt-context:test:001',
        metadata: {
          createdAt: timestamp,
          schemaVersion: '1.0.0',
          source: 'AI_CONVERSATION_ORCHESTRATOR',
        },
        execution: {
          executionId: 'execution:test:001',
          status: 'success',
          startedAt: '2026-07-24T12:00:00.000Z',
          finishedAt: timestamp,
          summary: {
            totalSteps: 1,
            successfulSteps: 1,
            failedSteps: 0,
          },
        },
        steps: [
          {
            kind: 'success',
            stepId: 'step-1',
            order: 1,
            toolId: 'financial_balance',
            resolvedToolName: 'financial_balance',
            output: {
              summary: {
                netBalance: 1200,
              },
            },
            permission: 'read-only',
            durationMs: 1,
          },
        ],
      },
    },
    traceability: {
      executionId: 'execution:test:001',
      promptContextId: 'prompt-context:test:001',
    },
  }
}

describe('ConversationController initialize/send (PB-IS-013.8)', () => {
  it('inicializa en ready y sin historial', async () => {
    const controller = createConversationController({
      pipeline: {
        generateAssistantMessage: vi.fn(async () => ({
          kind: 'success',
          message: createChatMessageFixture({
            messageId: 'assistant-message-1',
            text: 'Tu balance disponible es de $1200.',
          }),
        })),
      },
      now: () => '2026-07-24T12:00:00.000Z',
    })

    await controller.initialize()

    expect(controller.getState()).toEqual({
      status: 'ready',
      messages: [],
      errorMessage: null,
      context: null,
    })
  })

  it('envia mensaje y renderiza respuesta del asistente usando ChatMessage', async () => {
    const controller = createConversationController({
      pipeline: {
        generateAssistantMessage: vi.fn(async () => ({
          kind: 'success',
          message: createChatMessageFixture({
            messageId: 'assistant-message-1',
            text: 'Tu balance disponible es de $1200.',
          }),
        })),
      },
      now: () => '2026-07-24T12:00:00.000Z',
    })

    await controller.initialize()
    await controller.sendMessage('Cuanto dinero tengo disponible?')

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.messages).toHaveLength(2)
    expect(state.messages[0].role).toBe('USER')
    expect(state.messages[0].text).toBe('Cuanto dinero tengo disponible?')
    expect(state.messages[1].role).toBe('ASSISTANT')
    expect(state.messages[1].text).toBe('Tu balance disponible es de $1200.')
    expect(validateConversationUiState(state)).toBeNull()
  })

  it('acumula historial local en multiples mensajes', async () => {
    const assistant = vi
      .fn()
      .mockResolvedValueOnce({
        kind: 'success',
        message: createChatMessageFixture({
          messageId: 'assistant-message-1',
          text: 'Encontré 3 transacciones.',
        }),
      })
      .mockResolvedValueOnce({
        kind: 'success',
        message: createChatMessageFixture({
          messageId: 'assistant-message-2',
          text: 'Actualmente tienes 2 objetivos financieros.',
          responseId: 'conversation-response:test:002',
          timestamp: '2026-07-24T12:00:02.000Z',
        }),
      })

    const controller = createConversationController({
      pipeline: {
        generateAssistantMessage: assistant,
      },
      now: () => '2026-07-24T12:00:00.000Z',
    })

    await controller.initialize()
    await controller.sendMessage('Dame mis transacciones')
    await controller.sendMessage('Y mis objetivos')

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(state.messages).toHaveLength(4)
    expect(state.messages.map((item) => item.role)).toEqual(['USER', 'ASSISTANT', 'USER', 'ASSISTANT'])
    expect(assistant).toHaveBeenCalledTimes(2)
  })

  it('maneja error devolviendo burbuja de asistente con safeMessage', async () => {
    const controller = createConversationController({
      pipeline: {
        generateAssistantMessage: vi.fn(async () => ({
          kind: 'failure',
          code: 'CONVERSATION_ORCHESTRATION_FAILED',
          safeMessage: 'No se pudo resolver la herramienta solicitada.',
        })),
      },
      now: () => '2026-07-24T12:00:00.000Z',
    })

    await controller.initialize()
    await controller.sendMessage('Necesito mi balance')

    const state = controller.getState()
    expect(state.status).toBe('error')
    expect(state.messages).toHaveLength(2)
    expect(state.messages[1].role).toBe('ASSISTANT')
    expect(state.messages[1].text).toContain('No fue posible procesar la solicitud.')
    expect(state.messages[1].text).toContain('No se pudo resolver la herramienta solicitada.')
    expect(state.errorMessage).toContain('No fue posible procesar la solicitud.')
  })
})
