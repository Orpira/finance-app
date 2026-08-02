import { describe, expect, it } from 'vitest'

import {
  buildFinancialCopilot,
  answerFinancialCopilotQuery,
  type FinancialCopilotSnapshot,
} from '../src/intelligence/deterministic-copilot/financialCopilotEngine'
import { createFinancialCopilotSessionMemory } from '../src/intelligence/deterministic-copilot/financialCopilotSessionMemory'

const SNAPSHOT: FinancialCopilotSnapshot = {
  asOfDate: '2026-08-02',
  currency: 'EUR',
  currentMonth: {
    income: 1840,
    expenses: 620,
    incomeCount: 18,
    expenseCount: 42,
  },
  previousMonth: {
    income: 1640,
    expenses: 700,
    incomeCount: 16,
    expenseCount: 38,
  },
  expenseCategories: [
    { category: 'Transporte', amount: 310, count: 8 },
    { category: 'Material', amount: 190, count: 5 },
    { category: 'Otros', amount: 120, count: 29 },
  ],
  pendingIncome: { count: 2, overdueCount: 1 },
  appointments: {
    todayPendingCount: 1,
    nextPendingDateTime: '2026-08-02T18:30:00.000Z',
    lastDateTime: '2026-08-01T16:00:00.000Z',
  },
  yesterdayIncome: { amount: 120, count: 1 },
}

describe('buildFinancialCopilot', () => {
  it('genera insights breves, explicables y accionables solo con el snapshot', () => {
    const result = buildFinancialCopilot(SNAPSHOT)

    expect(result.insights).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'income-growth', tone: 'positive' }),
      expect.objectContaining({ id: 'expense-reduction', tone: 'positive' }),
      expect.objectContaining({ id: 'pending-income', action: { label: 'Revisar ingresos', to: '/income/pendientes' } }),
      expect.objectContaining({ id: 'top-expense-category', explanation: expect.stringContaining('310') }),
    ]))
    expect(result.insights.every((insight) => insight.message.length <= 120)).toBe(true)
  })

  it('muestra solo prioridades actuales y ordena primero la cita de hoy', () => {
    const result = buildFinancialCopilot(SNAPSHOT)

    expect(result.todayPriorities.map((priority) => priority.id)).toEqual([
      'today-appointments',
      'overdue-pending-income',
    ])
  })

  it('clasifica la salud con estados comprensibles y reglas explícitas', () => {
    expect(buildFinancialCopilot(SNAPSHOT).financialHealth).toEqual(expect.objectContaining({
      state: 'stable',
      label: 'Estable',
    }))

    expect(buildFinancialCopilot({
      ...SNAPSHOT,
      currentMonth: { ...SNAPSHOT.currentMonth, income: 500, expenses: 900 },
    }).financialHealth.state).toBe('needs_attention')

    expect(buildFinancialCopilot({
      ...SNAPSHOT,
      pendingIncome: { count: 0, overdueCount: 0 },
    }).financialHealth.state).toBe('very_stable')
  })

  it('construye un resumen natural sin inventar datos', () => {
    const result = buildFinancialCopilot(SNAPSHOT)

    expect(result.summary).toContain('18 ingresos y 42 gastos')
    expect(result.summary).toContain('aumentaron un 12,2 %')
    expect(result.summary).toContain('2 ingresos sin reportar')
  })

  it('sugiere acciones relevantes sin duplicar prioridades', () => {
    const result = buildFinancialCopilot(SNAPSHOT)

    expect(result.suggestedActions).toEqual(expect.arrayContaining([
      { id: 'weekly-summary', label: 'Consultar resumen mensual', to: '/resumen-completo' },
      { id: 'ask-assistant', label: 'Consultar al asistente', to: '/conversation' },
    ]))
    expect(new Set(result.suggestedActions.map((action) => action.id)).size).toBe(result.suggestedActions.length)
  })
})

describe('answerFinancialCopilotQuery', () => {
  it.each([
    ['¿Cuánto gané este mes?', '1840,00', 'monthly-income'],
    ['¿Cuánto gasté?', '620,00', 'monthly-expenses'],
    ['¿Qué categoría tuvo más gastos?', 'Transporte', 'top-expense-category'],
    ['¿Cuántos ingresos faltan por reportar?', '2 ingresos', 'pending-income-count'],
    ['¿Cuándo fue mi última cita?', '1 ago 2026', 'last-appointment'],
    ['¿Qué ingresos registré ayer?', '120,00', 'yesterday-income'],
  ])('responde localmente a %s', (query, expectedText, intent) => {
    const result = answerFinancialCopilotQuery(query, SNAPSHOT)

    expect(result).toEqual(expect.objectContaining({ intent, text: expect.stringContaining(expectedText) }))
    expect(result?.explanation.length).toBeGreaterThan(0)
  })

  it('devuelve null cuando no reconoce la consulta y nunca inventa una respuesta', () => {
    expect(answerFinancialCopilotQuery('Recomiéndame una inversión', SNAPSHOT)).toBeNull()
  })
})

describe('financialCopilotSessionMemory', () => {
  it('recuerda contexto durante la instancia y puede borrarse sin persistencia', () => {
    const memory = createFinancialCopilotSessionMemory({ currency: 'EUR' })

    memory.remember({
      period: 'current_month',
      lastQuery: '¿Cuánto gasté?',
      lastCategory: 'Transporte',
    })

    expect(memory.getSnapshot()).toEqual({
      currency: 'EUR',
      period: 'current_month',
      lastQuery: '¿Cuánto gasté?',
      lastCategory: 'Transporte',
    })

    memory.clear()
    expect(memory.getSnapshot()).toEqual({
      currency: 'EUR',
      period: 'current_month',
      lastQuery: null,
      lastCategory: null,
    })
  })
})
