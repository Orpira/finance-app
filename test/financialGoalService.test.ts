import { describe, expect, it, vi } from 'vitest'

import {
  calculateFinancialGoalProgress,
  createFinancialGoalService,
} from '../src/services/financialGoalService'
import type { FinancialGoal } from '../src/types/financialGoal'

const baseGoal: FinancialGoal = {
  id: 'goal-1',
  type: 'saving',
  name: 'Ahorro de agosto',
  targetAmount: 300,
  currency: 'EUR',
  period: 'monthly',
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  status: 'active',
  createdAt: '2026-08-02T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
}

const income = (amount: number) => ({
  date: '2026-08-02', duration: 60, totalAmount: amount, currency: 'EUR',
  percentage: 100, realGain: amount, eurValue: amount, copValue: amount * 5000,
  exchangeRateUsed: 5000,
})
const expense = (amount: number) => ({
  type: 'gasto' as const, date: '2026-08-02', category: 'Material', amount,
  currency: 'EUR', eurValue: amount, copValue: amount * 5000,
  createdAt: '2026-08-02T10:00:00.000Z',
})

describe('calculateFinancialGoalProgress', () => {
  it.each([
    ['saving', 200, 66.67, 'on_track'],
    ['income_target', 500, 100, 'achieved'],
    ['expense_limit', 300, 100, 'limit_reached'],
  ] as const)('calcula progreso determinista para %s', (type, currentAmount, percentage, state) => {
    const progress = calculateFinancialGoalProgress(
      { ...baseGoal, type },
      [income(500)],
      [expense(300)],
      'COP',
    )

    expect(progress).toEqual(expect.objectContaining({ currentAmount, percentage, state }))
    expect(progress.source).toBe('local-financial-domain')
  })

  it('marca un límite excedido sin alterar movimientos', () => {
    const progress = calculateFinancialGoalProgress(
      { ...baseGoal, type: 'expense_limit', targetAmount: 250 },
      [income(500)],
      [expense(300)],
      'COP',
    )
    expect(progress.state).toBe('limit_exceeded')
    expect(progress.remainingAmount).toBe(0)
  })

  it('ADR-035: la meta de Ingresos excluye Adicionales, igual que la meta de Ahorro', () => {
    const incomes = [{ ...income(50), additionalsTotal: 20 }]
    const expenses = [expense(10)]

    const saving = calculateFinancialGoalProgress(
      { ...baseGoal, type: 'saving' },
      incomes,
      expenses,
      'COP',
    )
    const incomeTarget = calculateFinancialGoalProgress(
      { ...baseGoal, type: 'income_target' },
      incomes,
      expenses,
      'COP',
    )

    expect(saving.currentAmount).toBe(40)
    expect(incomeTarget.currentAmount).toBe(50)
  })
})

describe('createFinancialGoalService', () => {
  it('crea, edita, pausa y cancela mediante el repositorio local', async () => {
    const records = new Map<string, FinancialGoal>()
    const repository = {
      add: vi.fn(async (goal: FinancialGoal) => { records.set(goal.id, goal) }),
      put: vi.fn(async (goal: FinancialGoal) => { records.set(goal.id, goal) }),
      get: vi.fn(async (id: string) => records.get(id)),
      toArray: vi.fn(async () => [...records.values()]),
    }
    const service = createFinancialGoalService({
      repository,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      createId: () => 'goal-created',
    })

    const created = await service.create({
      type: 'saving', name: 'Ahorro mensual', targetAmount: 300, currency: 'EUR',
      period: 'monthly', startDate: '2026-08-01', endDate: '2026-08-31',
    })
    expect(created.status).toBe('active')
    await service.update(created.id, { targetAmount: 350 })
    expect((await service.pause(created.id)).status).toBe('paused')
    expect((await service.cancel(created.id)).status).toBe('cancelled')
    expect(repository.add).toHaveBeenCalledOnce()
  })

  it('falla cerrado antes de persistir un objetivo inválido', async () => {
    const add = vi.fn()
    const service = createFinancialGoalService({
      repository: { add, put: vi.fn(), get: vi.fn(), toArray: vi.fn() },
    })
    await expect(service.create({
      type: 'saving', name: 'Inválido', targetAmount: 0, currency: 'EUR',
      period: 'monthly', startDate: '2026-08-31', endDate: '2026-08-01',
    })).rejects.toThrow('FINANCIAL_GOAL_INVALID_TARGET')
    expect(add).not.toHaveBeenCalled()
  })
})
