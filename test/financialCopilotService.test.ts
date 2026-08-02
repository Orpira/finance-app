import { describe, expect, it, vi } from 'vitest'

import {
  buildFinancialCopilotSnapshot,
  createLocalFinancialCopilotQueryHandler,
} from '../src/services/financialCopilotService'
import type { AppSettings } from '../src/types/settings'

const settings = {
  defaultCurrency: 'EUR',
  secondaryCurrency: 'COP',
} as AppSettings

describe('buildFinancialCopilotSnapshot', () => {
  it('proyecta totales almacenados, categorías, citas e ingresos de ayer', () => {
    const snapshot = buildFinancialCopilotSnapshot({
      asOfDate: '2026-08-02',
      settings,
      currentIncomes: [
        {
          id: 1,
          date: '2026-08-01',
          duration: 60,
          totalAmount: 120,
          currency: 'EUR',
          percentage: 100,
          realGain: 120,
          eurValue: 120,
          copValue: 600000,
          exchangeRateUsed: 5000,
        },
      ],
      previousIncomes: [],
      currentExpenses: [
        {
          id: 2,
          type: 'gasto',
          date: '2026-08-02',
          category: 'Transporte',
          amount: 30,
          currency: 'EUR',
          eurValue: 30,
          copValue: 150000,
          createdAt: '2026-08-02T09:00:00.000Z',
        },
      ],
      previousExpenses: [],
      pendingIncome: { count: 1, overdueCount: 0 },
      appointments: [
        {
          id: 3,
          dateTime: '2026-08-02T18:30:00.000Z',
          duration: 60,
          expectedAmount: 80,
          currency: 'EUR',
          reminders: [],
          completed: false,
        },
        {
          id: 4,
          dateTime: '2026-07-31T10:00:00.000Z',
          duration: 60,
          expectedAmount: 50,
          currency: 'EUR',
          reminders: [],
          completed: true,
        },
      ],
    })

    expect(snapshot.currentMonth).toEqual(expect.objectContaining({
      income: 120,
      expenses: 30,
      incomeCount: 1,
      expenseCount: 1,
    }))
    expect(snapshot.expenseCategories).toEqual([
      { category: 'Transporte', amount: 30, count: 1 },
    ])
    expect(snapshot.appointments).toEqual({
      todayPendingCount: 1,
      nextPendingDateTime: '2026-08-02T18:30:00.000Z',
      lastDateTime: '2026-07-31T10:00:00.000Z',
    })
    expect(snapshot.yesterdayIncome).toEqual({ amount: 120, count: 1 })
    expect(snapshot.currentWeek).toEqual({ income: 120, expenses: 30, incomeCount: 1, expenseCount: 1 })
    expect(snapshot.movementDates.currentIncome).toEqual(['2026-08-01'])
    expect(snapshot).toEqual(expect.objectContaining({
      source: 'local-financial-domain',
      calculatedAt: expect.stringMatching(/^2026-08-02T/),
      period: {
        current: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' },
        previous: { start: '2026-07-01', end: '2026-07-31', label: 'julio de 2026' },
      },
      limitations: [],
    }))
  })
})

describe('createLocalFinancialCopilotQueryHandler', () => {
  it('responde con datos locales y mantiene memoria solo en la instancia', async () => {
    const loadSnapshot = vi.fn().mockResolvedValue({
      asOfDate: '2026-08-02',
      calculatedAt: '2026-08-02T10:00:00.000Z',
      source: 'local-financial-domain',
      period: {
        current: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' },
        previous: { start: '2026-07-01', end: '2026-07-31', label: 'julio de 2026' },
      },
      limitations: [],
      currency: 'EUR',
      currentMonth: { income: 100, expenses: 0, incomeCount: 1, expenseCount: 0 },
      previousMonth: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      currentWeek: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      previousWeek: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      movementDates: { currentIncome: [], currentExpenses: [], previousIncome: [], previousExpenses: [] },
      expenseCategories: [],
      pendingIncome: { count: 0, overdueCount: 0 },
      appointments: { todayPendingCount: 0, nextPendingDateTime: null, lastDateTime: null },
      yesterdayIncome: { amount: 0, count: 0 },
    })
    const handler = createLocalFinancialCopilotQueryHandler({ loadSnapshot })

    const answer = await handler.answer('¿Cuánto gané este mes?')

    expect(answer?.text).toContain('100,00')
    expect(handler.getMemory()).toEqual({
      currency: 'EUR',
      period: 'current_month',
      lastQuery: '¿Cuánto gané este mes?',
      lastCategory: null,
      lastMetric: 'income',
      lastResult: expect.objectContaining({ intent: 'monthly-income' }),
      lastFilter: { type: 'income' },
      lastEntity: null,
      pendingProposal: null,
      lastReport: null,
      hiddenFilters: [],
    })
    expect(typeof localStorage === 'undefined' || localStorage.getItem('financial-copilot-memory') === null).toBe(true)
  })

  it('no carga datos cuando la consulta no pertenece al copiloto local', async () => {
    const loadSnapshot = vi.fn()
    const handler = createLocalFinancialCopilotQueryHandler({ loadSnapshot })

    await expect(handler.answer('Dame mis transacciones')).resolves.toBeNull()
    expect(loadSnapshot).not.toHaveBeenCalled()
  })

  it('resuelve seguimientos con la métrica previa y permite limpiar el contexto', async () => {
    const loadSnapshot = vi.fn().mockResolvedValue({
      asOfDate: '2026-08-02',
      calculatedAt: '2026-08-02T10:00:00.000Z',
      source: 'local-financial-domain',
      period: {
        current: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' },
        previous: { start: '2026-07-01', end: '2026-07-31', label: 'julio de 2026' },
      },
      limitations: [],
      currency: 'EUR',
      currentMonth: { income: 100, expenses: 40, incomeCount: 1, expenseCount: 2 },
      previousMonth: { income: 80, expenses: 30, incomeCount: 1, expenseCount: 1 },
      currentWeek: { income: 100, expenses: 40, incomeCount: 1, expenseCount: 2 },
      previousWeek: { income: 60, expenses: 20, incomeCount: 1, expenseCount: 1 },
      movementDates: { currentIncome: ['2026-08-01'], currentExpenses: ['2026-08-01', '2026-08-02'], previousIncome: ['2026-07-05'], previousExpenses: ['2026-07-06'] },
      expenseCategories: [{ category: 'Transporte', amount: 25, count: 1 }],
      pendingIncome: { count: 0, overdueCount: 0 },
      appointments: { todayPendingCount: 0, nextPendingDateTime: null, lastDateTime: null },
      yesterdayIncome: { amount: 0, count: 0 },
    })
    const handler = createLocalFinancialCopilotQueryHandler({ loadSnapshot })

    await handler.answer('¿Cuánto gasté este mes?')
    const previous = await handler.answer('¿Y el mes anterior?')
    expect(previous).toEqual(expect.objectContaining({
      intent: 'previous-period',
      text: expect.stringContaining('30,00'),
      period: 'previous_month',
    }))
    const dates = await handler.answer('¿Qué fechas?')
    expect(dates?.text).toContain('6 jul 2026')
    const week = await handler.answer('Compáralo con la semana anterior')
    expect(week).toEqual(expect.objectContaining({ intent: 'previous-week-comparison' }))

    handler.clearMemory()
    expect(handler.getMemory()).toEqual(expect.objectContaining({ lastMetric: null, lastResult: null }))
    const missing = await handler.answer('¿Y el mes anterior?')
    expect(missing?.text).toBe('No tengo suficiente contexto para responder. Indica el periodo o la métrica que deseas consultar.')
  })

  it('retiene seguimientos reconocidos en local y nunca invoca una red o pipeline', async () => {
    const loadSnapshot = vi.fn().mockResolvedValue({
      asOfDate: '2026-08-02', calculatedAt: '2026-08-02T10:00:00.000Z', source: 'local-financial-domain',
      period: { current: { start: '2026-08-01', end: '2026-08-31', label: 'agosto de 2026' }, previous: { start: '2026-07-01', end: '2026-07-31', label: 'julio de 2026' } },
      limitations: [], currency: 'EUR',
      currentMonth: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      previousMonth: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      currentWeek: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 }, previousWeek: { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
      movementDates: { currentIncome: [], currentExpenses: [], previousIncome: [], previousExpenses: [] },
      expenseCategories: [], pendingIncome: { count: 0, overdueCount: 0 },
      appointments: { todayPendingCount: 0, nextPendingDateTime: null, lastDateTime: null }, yesterdayIncome: { amount: 0, count: 0 },
    })
    const handler = createLocalFinancialCopilotQueryHandler({ loadSnapshot })

    for (const query of ['¿Por qué?', '¿Cuántos movimientos fueron?', '¿Qué fechas?', '¿Qué puedo hacer?', 'Crear una acción a partir de esto']) {
      await expect(handler.answer(query)).resolves.toEqual(expect.objectContaining({ intent: 'insufficient-context' }))
    }
    expect(loadSnapshot).toHaveBeenCalledTimes(5)
  })
})
