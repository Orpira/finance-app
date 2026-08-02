import { describe, expect, it, vi } from 'vitest'

import { createCopilotActionProposalService } from '../src/services/copilotActionProposalService'

const pending = (id: number, date: string, amount: number) => ({
  id, date, duration: 60, totalAmount: amount, currency: 'EUR', percentage: 100,
  realGain: amount, eurValue: amount, copValue: amount * 5000, exchangeRateUsed: 5000,
  reportStatusCode: 'unreviewed' as const,
})

describe('copilotActionProposalService', () => {
  it('prepara un único ingreso pendiente sin modificarlo', async () => {
    const getPendingIncomes = vi.fn().mockResolvedValue([pending(7, '2026-07-30', 120)])
    const service = createCopilotActionProposalService({
      getPendingIncomes,
      now: () => new Date('2026-08-02T10:00:00.000Z'),
    })
    const result = await service.prepare('Marca como reportado el ingreso del 30 de julio', { defaultCurrency: 'EUR' })

    expect(result).toEqual(expect.objectContaining({ kind: 'proposal' }))
    if (result.kind !== 'proposal') throw new Error('expected proposal')
    expect(result.proposal).toEqual(expect.objectContaining({
      kind: 'mark_income_reported', status: 'awaiting_confirmation',
      fields: expect.objectContaining({ incomeId: 7, date: '2026-07-30', amount: 120, currentStatus: 'Sin revisar' }),
    }))
    expect(getPendingIncomes).toHaveBeenCalledOnce()
  })

  it('expone la ambigüedad sin crear una propuesta ni ejecutar una acción masiva', async () => {
    const service = createCopilotActionProposalService({
      getPendingIncomes: vi.fn().mockResolvedValue([pending(7, '2026-07-30', 120), pending(8, '2026-07-30', 80)]),
      now: () => new Date('2026-08-02T10:00:00.000Z'),
    })
    const result = await service.prepare('Marca como reportado el ingreso del 30 de julio', { defaultCurrency: 'EUR' })
    expect(result).toEqual(expect.objectContaining({ kind: 'message', text: expect.stringContaining('dos ingresos') }))
  })

  it('prepara PDF mensual y objetivo de ahorro como propuestas editables', async () => {
    const service = createCopilotActionProposalService({
      now: () => new Date('2026-08-02T10:00:00.000Z'),
      loadSnapshot: vi.fn().mockResolvedValue({
        currency: 'EUR', currentMonth: { income: 500, expenses: 180, incomeCount: 3, expenseCount: 4 },
      }),
    })
    const report = await service.prepare('Prepara un PDF de este mes', { defaultCurrency: 'EUR' })
    const goal = await service.prepare('Quiero ahorrar 300 euros este mes', { defaultCurrency: 'EUR' })
    expect(report).toEqual(expect.objectContaining({ kind: 'proposal', proposal: expect.objectContaining({ kind: 'generate_report' }) }))
    if (report.kind !== 'proposal' || report.proposal.kind !== 'generate_report') throw new Error('expected report')
    expect(report.proposal.fields.includedData).toContain('500,00')
    expect(goal).toEqual(expect.objectContaining({ kind: 'proposal', proposal: expect.objectContaining({ kind: 'create_financial_goal', fields: expect.objectContaining({ goalType: 'saving', targetAmount: 300 }) }) }))
  })
})
