import { describe, expect, it } from 'vitest'

import {
  buildFinancialCopilot,
  answerFinancialCopilotQuery,
  type FinancialCopilotSnapshot,
} from '../src/intelligence/deterministic-copilot/financialCopilotEngine'
import { createFinancialCopilotSessionMemory } from '../src/intelligence/deterministic-copilot/financialCopilotSessionMemory'

const SNAPSHOT: FinancialCopilotSnapshot = {
  asOfDate: '2026-08-02',
  calculatedAt: '2026-08-02T10:00:00.000Z',
  source: 'local-financial-domain',
  period: {
    current: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' },
    previous: { start: '2026-07-01', end: '2026-07-31', label: 'julio de 2026' },
  },
  limitations: [],
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
  currentWeek: { income: 320, expenses: 90, incomeCount: 3, expenseCount: 4 },
  previousWeek: { income: 280, expenses: 120, incomeCount: 2, expenseCount: 5 },
  movementDates: {
    currentIncome: ['2026-08-01', '2026-08-02'],
    currentExpenses: ['2026-08-01', '2026-08-02'],
    previousIncome: ['2026-07-03'],
    previousExpenses: ['2026-07-04'],
  },
  goalProgress: [{
    goalId: 'goal-1', goalName: 'Ahorro mensual', goalType: 'saving', goalStatus: 'active',
    currentAmount: 200, targetAmount: 300, remainingAmount: 100, percentage: 66.67,
    state: 'on_track', period: { start: '2026-08-01', end: '2026-08-31' },
    currency: 'EUR', source: 'local-financial-domain', calculatedAt: '2026-08-02T10:00:00.000Z', limitations: [],
  }],
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
    expect(result.insights.every((insight) => insight.evidence.length > 0)).toBe(true)
    expect(result.insights.find((insight) => insight.id === 'income-growth')?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'income',
          currentValue: 1840,
          previousValue: 1640,
          period: 'agosto de 2026',
          source: 'local-financial-domain',
        }),
      ]),
    )
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
      calculatedAt: SNAPSHOT.calculatedAt,
      activeRules: expect.arrayContaining(['balance_covers_expenses']),
      reasons: expect.arrayContaining(['Los ingresos cubren los gastos del periodo.']),
      evidence: expect.arrayContaining([
        expect.objectContaining({ metric: 'balance', currentValue: 1220 }),
      ]),
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

  it('proyecta todos los read models con metadatos trazables comunes', () => {
    const readModels = buildFinancialCopilot(SNAPSHOT).readModels
    expect(Object.keys(readModels)).toEqual([
      'periodSummary', 'periodComparison', 'categoryBreakdown', 'pendingIncome',
      'upcomingAppointments', 'todayPriorities', 'financialHealth', 'recentActivity', 'goalProgress',
    ])
    for (const model of Object.values(readModels)) {
      expect(model).toEqual(expect.objectContaining({
        period: expect.any(String), currency: 'EUR', source: 'local-financial-domain',
        calculatedAt: SNAPSHOT.calculatedAt, metrics: expect.anything(), limitations: expect.any(Array),
      }))
    }
  })

  it('sugiere acciones relevantes sin duplicar prioridades', () => {
    const result = buildFinancialCopilot(SNAPSHOT)

    expect(result.suggestedActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'review-pending-income', evidenceId: 'pending-income', to: expect.stringContaining('reported=unreported') }),
      expect.objectContaining({ id: 'review-top-category', evidenceId: 'top-expense-category', to: expect.stringContaining('category=Transporte') }),
    ]))
    expect(result.suggestedActions).toHaveLength(3)
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
    ['¿Cómo va mi objetivo?', 'Ahorro mensual', 'financial-goal-progress'],
    ['Ver resumen semanal', 'Esta semana', 'weekly-summary'],
    ['Comparar este mes con el anterior', 'julio de 2026', 'monthly-comparison'],
  ])('responde localmente a %s', (query, expectedText, intent) => {
    const result = answerFinancialCopilotQuery(query, SNAPSHOT)

    expect(result).toEqual(expect.objectContaining({ intent, text: expect.stringContaining(expectedText) }))
    expect(result?.explanation.length).toBeGreaterThan(0)
  })

  it('resume exclusivamente la semana actual', () => {
    const result = answerFinancialCopilotQuery('Ver resumen semanal', SNAPSHOT)

    expect(result).toEqual(expect.objectContaining({
      intent: 'weekly-summary',
      period: 'current_week',
      metric: 'balance',
    }))
    expect(result?.text).toContain('ingresos')
    expect(result?.text).toContain('gastos')
    expect(result?.text).toContain('balance')
  })

  it('compara ingresos, gastos y balance del mes actual con el anterior', () => {
    const result = answerFinancialCopilotQuery('Comparar este mes con el anterior', SNAPSHOT)

    expect(result).toEqual(expect.objectContaining({
      intent: 'monthly-comparison',
      period: 'current_month',
      metric: 'balance',
      text: expect.stringContaining(SNAPSHOT.period.current.label),
    }))
    expect(result?.text).toContain(SNAPSHOT.period.previous.label)
    expect(result?.text).toContain('ingresos')
    expect(result?.text).toContain('gastos')
    expect(result?.text).toContain('balance')
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
      lastMetric: 'expenses',
      lastResult: {
        intent: 'monthly-expenses',
        text: 'Gastaste 620 €.',
        explanation: 'Suma local.',
      },
      lastFilter: { type: 'expense', category: 'Transporte' },
      lastEntity: { type: 'expense-category', label: 'Transporte' },
      pendingProposal: 'proposal:1',
      lastReport: { period: 'current_month', format: 'pdf' },
      hiddenFilters: [],
    })

    expect(memory.getSnapshot()).toEqual({
      currency: 'EUR',
      period: 'current_month',
      lastQuery: '¿Cuánto gasté?',
      lastCategory: 'Transporte',
      lastMetric: 'expenses',
      lastResult: {
        intent: 'monthly-expenses',
        text: 'Gastaste 620 €.',
        explanation: 'Suma local.',
      },
      lastFilter: { type: 'expense', category: 'Transporte' },
      lastEntity: { type: 'expense-category', label: 'Transporte' },
      pendingProposal: 'proposal:1',
      lastReport: { period: 'current_month', format: 'pdf' },
      hiddenFilters: [],
    })

    memory.clear()
    expect(memory.getSnapshot()).toEqual({
      currency: 'EUR',
      period: 'current_month',
      lastQuery: null,
      lastCategory: null,
      lastMetric: null,
      lastResult: null,
      lastFilter: null,
      lastEntity: null,
      pendingProposal: null,
      lastReport: null,
      hiddenFilters: [],
    })

    memory.remember({ lastCategory: 'Transporte' })
    memory.removeFilter('category')
    expect(memory.getSnapshot()).toEqual(expect.objectContaining({
      lastCategory: null,
      hiddenFilters: ['category'],
    }))
  })
})
