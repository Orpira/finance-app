import { describe, expect, it, vi } from 'vitest'

import {
  createConversationController,
} from '../src/pages/Conversation/conversationController'

describe('ConversationController local history behavior (PB-IS-013.8)', () => {
  it('ignora mensajes vacios y no invoca el pipeline', async () => {
    const pipeline = {
      generateAssistantMessage: vi.fn(async () => ({
        kind: 'failure' as const,
        code: 'UNEXPECTED',
        safeMessage: 'No deberia ejecutarse',
      })),
    }

    const controller = createConversationController({
      pipeline,
      now: () => '2026-07-24T12:00:00.000Z',
    })

    await controller.initialize()
    await controller.sendMessage('   ')

    expect(controller.getState().messages).toHaveLength(0)
    expect(pipeline.generateAssistantMessage).not.toHaveBeenCalled()
  })

  it('si ocurre excepcion inesperada, responde en fail-closed con burbuja de error', async () => {
    const controller = createConversationController({
      pipeline: {
        generateAssistantMessage: vi.fn(async () => {
          throw new Error('transport broken')
        }),
      },
      now: () => '2026-07-24T12:00:00.000Z',
    })

    await controller.initialize()
    await controller.sendMessage('Dame mi reporte')

    const state = controller.getState()
    expect(state.status).toBe('error')
    expect(state.messages).toHaveLength(2)
    expect(state.messages[1].role).toBe('ASSISTANT')
    expect(state.messages[1].text).toContain('No fue posible procesar la solicitud.')
  })

  it('reanuda emisiones despues de dispose y nueva suscripcion (strict mode safe)', async () => {
    const controller = createConversationController({
      pipeline: {
        generateAssistantMessage: vi.fn(async () => ({
          kind: 'failure' as const,
          code: 'UNEXPECTED',
          safeMessage: 'No usado en este caso',
        })),
      },
      now: () => '2026-07-24T12:00:00.000Z',
    })

    const firstStates: string[] = []
    const unsubscribe = controller.subscribe((next) => {
      firstStates.push(next.status)
    })

    unsubscribe()
    controller.dispose()

    const secondStates: string[] = []
    controller.subscribe((next) => {
      secondStates.push(next.status)
    })

    await controller.initialize()

    expect(firstStates[0]).toBe('idle')
    expect(secondStates).toContain('loading')
    expect(secondStates).toContain('ready')
  })
})
