import { describe, expect, it, vi } from 'vitest'

import { createConversationController } from '../src/pages/Conversation/conversationController'

describe('conversationController local financial copilot', () => {
  it('usa la respuesta determinista antes del pipeline externo', async () => {
    const generateAssistantMessage = vi.fn()
    const answerLocalQuery = vi.fn().mockResolvedValue({
      intent: 'monthly-income',
      text: 'Este mes registraste 120,00 € en ingresos.',
      explanation: 'El total corresponde a un ingreso del mes actual.',
      period: 'current_month',
      category: null,
    })
    const controller = createConversationController({
      pipeline: { generateAssistantMessage },
      answerLocalQuery,
      now: () => '2026-08-02T10:00:00.000Z',
    })

    await controller.initialize()
    await controller.sendMessage('¿Cuánto gané este mes?')

    expect(answerLocalQuery).toHaveBeenCalledWith('¿Cuánto gané este mes?')
    expect(generateAssistantMessage).not.toHaveBeenCalled()
    expect(controller.getState().messages.at(-1)?.text).toBe(
      'Este mes registraste 120,00 € en ingresos.\n\nEl total corresponde a un ingreso del mes actual.',
    )
  })

  it('expone y limpia manualmente el contexto RAM del copiloto', async () => {
    const clearLocalContext = vi.fn()
    const getLocalContext = vi.fn()
      .mockReturnValueOnce({ currency: 'EUR', period: 'current_month', lastCategory: 'Transporte' })
      .mockReturnValue(null)
    const controller = createConversationController({
      pipeline: { generateAssistantMessage: vi.fn() },
      answerLocalQuery: vi.fn().mockResolvedValue({
        intent: 'monthly-expenses', text: '40 €', explanation: 'Suma local.',
        period: 'current_month', category: 'Transporte', metric: 'expenses',
      }),
      clearLocalContext,
      getLocalContext,
    })

    await controller.initialize()
    await controller.sendMessage('¿Cuánto gasté?')
    expect(controller.getState().context).toEqual(expect.objectContaining({ period: 'current_month' }))

    controller.clearContext()
    expect(clearLocalContext).toHaveBeenCalledOnce()
    expect(controller.getState().context).toBeNull()
  })
})
