import { describe, expect, it, vi } from 'vitest'

import type { FinancialCopilotSnapshot } from '../src/intelligence/deterministic-copilot'
import { createConversationController } from '../src/pages/Conversation/conversationController'
import { QUICK_SUGGESTIONS } from '../src/pages/Conversation/quickSuggestions'
import { createLocalFinancialCopilotQueryHandler } from '../src/services/financialCopilotService'

const SNAPSHOT: FinancialCopilotSnapshot = {
  asOfDate: '2026-08-22',
  calculatedAt: '2026-08-22T10:00:00.000Z',
  source: 'local-financial-domain',
  period: {
    current: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' },
    previous: { start: '2026-07-01', end: '2026-07-31', label: 'julio de 2026' },
  },
  limitations: [],
  currency: 'EUR',
  currentMonth: { income: 1_200, expenses: 350, incomeCount: 4, expenseCount: 3 },
  previousMonth: { income: 900, expenses: 400, incomeCount: 3, expenseCount: 4 },
  currentWeek: { income: 500, expenses: 125, incomeCount: 2, expenseCount: 1 },
  previousWeek: { income: 300, expenses: 80, incomeCount: 1, expenseCount: 1 },
  movementDates: {
    currentIncome: ['2026-08-18', '2026-08-21'],
    currentExpenses: ['2026-08-20'],
    previousIncome: ['2026-07-10'],
    previousExpenses: ['2026-07-12'],
  },
  goalProgress: [],
  expenseCategories: [{ category: 'Transporte', amount: 125, count: 1 }],
  pendingIncome: { count: 2, overdueCount: 1 },
  appointments: { todayPendingCount: 0, nextPendingDateTime: null, lastDateTime: null },
  yesterdayIncome: { amount: 0, count: 0 },
}

function createQuickActionController() {
  const pipeline = {
    generateAssistantMessage: vi.fn().mockResolvedValue({
      kind: 'failure' as const,
      code: 'UNEXPECTED_PIPELINE_CALL',
      safeMessage: 'La quick action no debía llegar al pipeline genérico.',
    }),
  }
  const localCopilot = createLocalFinancialCopilotQueryHandler({
    loadSnapshot: async () => SNAPSHOT,
  })
  const controller = createConversationController({
    pipeline,
    getAssistantContext: async () => ({ defaultCurrency: 'EUR', usageMode: 'professional' }),
    answerLocalQuery: (message) => localCopilot.answer(message),
    getLocalContext: () => localCopilot.getMemory(),
    now: () => '2026-08-22T10:00:00.000Z',
  })

  return { controller, pipeline }
}

describe('ConversationController - Quick Actions', () => {
  it('mantiene la matriz de siete sugerencias auditadas', () => {
    expect(QUICK_SUGGESTIONS).toEqual([
      'Registrar un ingreso',
      'Registrar un gasto',
      'Crear una cita',
      'Ver resumen semanal',
      'Ingresos sin reportar',
      'Comparar este mes con el anterior',
      'Comparar esta temporada con la anterior',
    ])
  })

  it.each([
    ['Registrar un ingreso', 'register_income', ['amount']],
    ['Registrar un gasto', 'register_expense', ['amount', 'category']],
    ['Crear una cita', 'create_appointment', ['time', 'expectedAmount']],
  ] as const)('%s produce una propuesta confirmable sin consultar tools', async (message, kind, missingFields) => {
    const { controller, pipeline } = createQuickActionController()

    await controller.sendMessage(message)

    const assistantMessage = controller.getState().messages.at(-1)
    expect(assistantMessage?.responseType).toBe('pending-proposal')
    expect(assistantMessage?.proposal).toEqual(expect.objectContaining({
      kind,
      status: 'awaiting_confirmation',
      missingRequiredFields: [...missingFields],
    }))
    expect(pipeline.generateAssistantMessage).not.toHaveBeenCalled()
    expect(assistantMessage?.text).not.toContain('transacciones')
  })

  it.each([
    ['Ver resumen semanal', 'weekly-summary', 'semana actual'],
    ['Ingresos sin reportar', 'pending-income-count', 'Tienes 2 ingresos sin reportar'],
    ['Comparar este mes con el anterior', 'monthly-comparison', 'julio de 2026'],
  ] as const)('%s se resuelve localmente sin fallback genérico', async (message, intent, expectedText) => {
    const { controller, pipeline } = createQuickActionController()

    await controller.sendMessage(message)

    const assistantMessage = controller.getState().messages.at(-1)
    expect(assistantMessage?.responseType).toBe('local-calculation')
    expect(assistantMessage?.text).toContain(expectedText)
    expect(assistantMessage?.sections?.explanation).toBeTruthy()
    expect(controller.getState().context?.lastResult?.intent).toBe(intent)
    expect(pipeline.generateAssistantMessage).not.toHaveBeenCalled()
  })

  it('"Comparar esta temporada con la anterior" NO se resuelve con los cálculos locales mensuales: cae al pipeline completo (financial_insights/season-comparison)', async () => {
    const { controller, pipeline } = createQuickActionController()

    await controller.sendMessage('Comparar esta temporada con la anterior')

    expect(pipeline.generateAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: 'Comparar esta temporada con la anterior' }),
    )
  })
})
