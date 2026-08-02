import { beforeEach, describe, expect, it, vi } from 'vitest'

const interpretAssistantMessageMock = vi.fn()
const applyProposalEditsMock = vi.fn()
const executeAssistantProposalMock = vi.fn()
const recordAssistantAuditMock = vi.fn()

vi.mock('../src/intelligence/assistant', () => ({
  interpretAssistantMessage: (...args: unknown[]) => interpretAssistantMessageMock(...args),
  applyProposalEdits: (...args: unknown[]) => applyProposalEditsMock(...args),
  executeAssistantProposal: (...args: unknown[]) => executeAssistantProposalMock(...args),
  recordAssistantAudit: (...args: unknown[]) => recordAssistantAuditMock(...args),
}))

const { createConversationController } = await import('../src/pages/Conversation/conversationController')

function baseProposal(overrides: Record<string, unknown> = {}) {
  return {
    proposalId: 'assistant-proposal:register_income:1',
    kind: 'register_income',
    status: 'awaiting_confirmation',
    createdAt: '2026-08-01T00:00:00.000Z',
    sourceText: 'Hoy recibí 120 euros por un servicio',
    missingRequiredFields: [],
    fields: { amount: 120, currency: 'EUR', date: '2026-08-01', description: null },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConversationController - flujo de propuestas del Asistente', () => {
  it('detecta una acción y muestra la propuesta sin llamar al pipeline de consulta', async () => {
    interpretAssistantMessageMock.mockReturnValue({ kind: 'proposal', proposal: baseProposal() })
    const pipeline = { generateAssistantMessage: vi.fn() }
    const controller = createConversationController({
      pipeline,
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })

    await controller.sendMessage('Hoy recibí 120 euros por un servicio')

    const state = controller.getState()
    expect(pipeline.generateAssistantMessage).not.toHaveBeenCalled()
    expect(state.status).toBe('ready')
    const lastMessage = state.messages.at(-1)
    expect(lastMessage?.proposal?.kind).toBe('register_income')
  })

  it('prioriza una propuesta contextual local y no llama al pipeline externo', async () => {
    const proposal = baseProposal({ kind: 'generate_report', fields: { periodStart: '2026-08-01', periodEnd: '2026-08-31', format: 'pdf', includedData: 'Resumen' } })
    const pipeline = { generateAssistantMessage: vi.fn() }
    const controller = createConversationController({
      pipeline,
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
      prepareContextualAction: vi.fn().mockResolvedValue({ kind: 'proposal', proposal }),
    })
    await controller.sendMessage('Prepara un PDF de este mes')
    expect(pipeline.generateAssistantMessage).not.toHaveBeenCalled()
    expect(interpretAssistantMessageMock).not.toHaveBeenCalled()
    expect(controller.getState().messages.at(-1)?.proposal?.kind).toBe('generate_report')
  })

  it('sigue el camino de consulta existente cuando no hay acción detectada', async () => {
    interpretAssistantMessageMock.mockReturnValue({ kind: 'no-action' })
    const pipeline = {
      generateAssistantMessage: vi.fn().mockResolvedValue({
        kind: 'success',
        message: { messageId: 'm1', text: 'Tu balance es...', timestamp: '2026-08-01T00:00:01.000Z' },
      }),
    }
    const controller = createConversationController({
      pipeline,
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })

    await controller.sendMessage('¿Cuánto gané esta semana?')

    expect(pipeline.generateAssistantMessage).toHaveBeenCalledTimes(1)
    expect(controller.getState().messages.at(-1)?.text).toBe('Tu balance es...')
  })

  it('sin getAssistantContext, nunca intenta interpretar una acción (retrocompatible)', async () => {
    const pipeline = {
      generateAssistantMessage: vi.fn().mockResolvedValue({
        kind: 'success',
        message: { messageId: 'm1', text: 'ok', timestamp: '2026-08-01T00:00:01.000Z' },
      }),
    }
    const controller = createConversationController({ pipeline })

    await controller.sendMessage('Hoy recibí 120 euros por un servicio')

    expect(interpretAssistantMessageMock).not.toHaveBeenCalled()
    expect(pipeline.generateAssistantMessage).toHaveBeenCalledTimes(1)
  })

  it('confirmProposal ejecuta y marca la propuesta como completada', async () => {
    interpretAssistantMessageMock.mockReturnValue({ kind: 'proposal', proposal: baseProposal() })
    executeAssistantProposalMock.mockResolvedValue({ ok: true, recordId: 42 })
    const controller = createConversationController({
      pipeline: { generateAssistantMessage: vi.fn() },
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })
    await controller.sendMessage('Hoy recibí 120 euros por un servicio')
    const proposalMessageId = controller.getState().messages.at(-1)!.id

    await controller.confirmProposal({ messageId: proposalMessageId })

    const state = controller.getState()
    expect(state.status).toBe('ready')
    expect(executeAssistantProposalMock).toHaveBeenCalledTimes(1)
    expect(executeAssistantProposalMock.mock.calls[0][0].status).toBe('confirmed')
    const proposalMessage = state.messages.find((message) => message.id === proposalMessageId)
    expect(proposalMessage?.proposal?.status).toBe('completed')
    expect(proposalMessage?.proposal?.executedRecordId).toBe(42)
    expect(state.messages.at(-1)?.text).toContain('registré')
  })

  it('confirmProposal con campos incompletos no ejecuta y mantiene el estado editable', async () => {
    interpretAssistantMessageMock.mockReturnValue({
      kind: 'proposal',
      proposal: baseProposal({ missingRequiredFields: ['amount'], fields: { amount: null, currency: 'EUR', date: '2026-08-01', description: null } }),
    })
    applyProposalEditsMock.mockReturnValue(
      baseProposal({ missingRequiredFields: ['amount'], fields: { amount: null, currency: 'EUR', date: '2026-08-01', description: null } }),
    )
    const controller = createConversationController({
      pipeline: { generateAssistantMessage: vi.fn() },
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })
    await controller.sendMessage('Hoy recibí dinero')
    const proposalMessageId = controller.getState().messages.at(-1)!.id

    await controller.confirmProposal({ messageId: proposalMessageId, edits: {} })

    expect(executeAssistantProposalMock).not.toHaveBeenCalled()
    const proposalMessage = controller.getState().messages.find((message) => message.id === proposalMessageId)
    expect(proposalMessage?.proposal?.status).toBe('awaiting_confirmation')
  })

  it('confirmProposal aplica ediciones y ejecuta cuando quedan completas', async () => {
    interpretAssistantMessageMock.mockReturnValue({
      kind: 'proposal',
      proposal: baseProposal({ missingRequiredFields: ['amount'], fields: { amount: null, currency: 'EUR', date: '2026-08-01', description: null } }),
    })
    applyProposalEditsMock.mockReturnValue(baseProposal({ missingRequiredFields: [] }))
    executeAssistantProposalMock.mockResolvedValue({ ok: true, recordId: 1 })
    const controller = createConversationController({
      pipeline: { generateAssistantMessage: vi.fn() },
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })
    await controller.sendMessage('Hoy recibí dinero')
    const proposalMessageId = controller.getState().messages.at(-1)!.id

    await controller.confirmProposal({ messageId: proposalMessageId, edits: { amount: 120 } })

    expect(applyProposalEditsMock).toHaveBeenCalledWith(expect.anything(), { amount: 120 })
    expect(executeAssistantProposalMock).toHaveBeenCalledTimes(1)
  })

  it('confirmProposal marca la propuesta como fallida cuando el motor financiero rechaza la operación', async () => {
    interpretAssistantMessageMock.mockReturnValue({ kind: 'proposal', proposal: baseProposal() })
    executeAssistantProposalMock.mockResolvedValue({
      ok: false,
      safeMessage: 'No hay una temporada activa.',
    })
    const controller = createConversationController({
      pipeline: { generateAssistantMessage: vi.fn() },
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })
    await controller.sendMessage('Hoy recibí 120 euros por un servicio')
    const proposalMessageId = controller.getState().messages.at(-1)!.id

    await controller.confirmProposal({ messageId: proposalMessageId })

    const state = controller.getState()
    expect(state.status).toBe('error')
    const proposalMessage = state.messages.find((message) => message.id === proposalMessageId)
    expect(proposalMessage?.proposal?.status).toBe('failed')
    expect(proposalMessage?.proposal?.failureReason).toBe('No hay una temporada activa.')
  })

  it('cancelProposal cancela sin ejecutar nada y registra auditoría', async () => {
    interpretAssistantMessageMock.mockReturnValue({ kind: 'proposal', proposal: baseProposal() })
    const controller = createConversationController({
      pipeline: { generateAssistantMessage: vi.fn() },
      getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    })
    await controller.sendMessage('Hoy recibí 120 euros por un servicio')
    const proposalMessageId = controller.getState().messages.at(-1)!.id

    controller.cancelProposal({ messageId: proposalMessageId })

    expect(executeAssistantProposalMock).not.toHaveBeenCalled()
    expect(recordAssistantAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled', kind: 'register_income' }),
    )
    const state = controller.getState()
    const proposalMessage = state.messages.find((message) => message.id === proposalMessageId)
    expect(proposalMessage?.proposal?.status).toBe('cancelled')
    expect(state.messages.at(-1)?.text).toContain('no se registró')
  })
})
