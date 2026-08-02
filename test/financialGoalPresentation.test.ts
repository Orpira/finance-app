import { describe, expect, it } from 'vitest'

import { buildFinancialGoalPresentation } from '../src/services/financialGoalPresentation'
import type { FinancialGoal } from '../src/types/financialGoal'

const goal: FinancialGoal = {
  id: 'goal-1', type: 'saving', name: 'Reserva', targetAmount: 500, currency: 'EUR',
  period: 'monthly', startDate: '2026-08-01', endDate: '2026-08-31', status: 'active',
  createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-05T10:00:00.000Z',
}

describe('financial goal presentation', () => {
  it('adds remaining time, status, update date and a useful recommendation', () => {
    expect(buildFinancialGoalPresentation(goal, {
      currentAmount: 200,
      targetAmount: 500,
      remainingAmount: 300,
      percentage: 40,
      state: 'on_track',
    }, '2026-08-10')).toEqual(expect.objectContaining({
      daysRemaining: 21,
      statusLabel: 'En progreso',
      updatedAtLabel: '5 ago 2026',
    }))
    expect(buildFinancialGoalPresentation(goal, {
      currentAmount: 200, targetAmount: 500, remainingAmount: 300, percentage: 40, state: 'on_track',
    }, '2026-08-10').recommendation).toContain('300,00')
  })

  it('does not recommend more spending when an expense limit is exceeded', () => {
    const presentation = buildFinancialGoalPresentation(
      { ...goal, type: 'expense_limit' },
      { currentAmount: 550, targetAmount: 500, remainingAmount: 0, percentage: 110, state: 'limit_exceeded' },
      '2026-08-10',
    )
    expect(presentation.statusLabel).toBe('Límite excedido')
    expect(presentation.recommendation).toContain('Revisa los gastos')
  })
})
