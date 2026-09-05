import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import {
  canMarkAsReported,
  getReportedCountByUsageMode,
  toggleReportStatus,
} from '../src/utils/reportStatus'
import { toUnifiedMovements } from '../src/pages/Movements/movementPresentation'

const expense = (usageMode: 'basic' | 'professional') => ({
  id: 8,
  type: 'gasto',
  usageMode,
  date: '2026-09-04',
  category: 'Transporte',
  amount: 20,
  currency: 'EUR',
  eurValue: 20,
  copValue: 80_000,
  createdAt: '2026-09-04T10:00:00.000Z',
  reportStatusCode: 'reported',
  reportStatusLabel: 'Reportado',
  reportedAt: '2026-09-04T11:00:00.000Z',
} as Expense)

const income = (usageMode: 'basic' | 'professional') => ({
  id: 7,
  type: 'ingreso',
  usageMode,
  date: '2026-09-04',
  duration: 60,
  totalAmount: 100,
  currency: 'EUR',
  percentage: 100,
  realGain: 100,
  eurValue: 100,
  copValue: 400_000,
  exchangeRateUsed: 4_000,
} as ServiceIncome)

describe('HYB-003 expense reporting boundary', () => {
  it.each(['basic', 'professional'] as const)('allows income but rejects expense in %s', (mode) => {
    expect(canMarkAsReported(income(mode), mode)).toBe(true)
    expect(canMarkAsReported(expense(mode), mode)).toBe(false)
    expect(() => toggleReportStatus(expense(mode), mode)).toThrow()
  })

  it('never counts historical reported fields on expenses', () => {
    expect(getReportedCountByUsageMode([expense('basic')], 'basic')).toBe(0)
    expect(getReportedCountByUsageMode([expense('professional')], 'professional')).toBe(0)
  })

  it('does not project historical expense reporting fields into Todos', () => {
    const movement = toUnifiedMovements([], [expense('basic')])[0]
    expect(movement.kind).toBe('expense')
    expect(movement.reportBadge).toBeUndefined()
    expect(movement.reported).toBeUndefined()
  })

  it('contains no report UI or mutation in the expense list', () => {
    const source = readFileSync(
      new URL('../src/pages/Expenses/ExpenseListPage.tsx', import.meta.url),
      'utf8',
    )
    expect(source).not.toContain('Marcar como reportado')
    expect(source).not.toContain('getRecordReportBadge')
    expect(source).not.toContain('toggleReportStatus')
    expect(source).not.toContain('reportStatusCode')
  })
})
