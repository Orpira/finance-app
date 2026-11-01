import { describe, expect, it } from 'vitest'
import { calculatePersonalHomeTotals } from '../src/pages/Home/personalHomeTotals'
import type { ServiceIncome } from '../src/types/service'
import type { Expense } from '../src/types/expense'

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return { id: 1, date: '2026-10-31', duration: 0, totalAmount: 100, realGain: 100,
    currency: 'EUR', percentage: 100, eurValue: 100, copValue: 440000,
    exchangeRateUsed: 4400, usageMode: 'basic', ...overrides }
}
function expense(overrides: Partial<Expense> = {}): Expense {
  return { id: 1, date: '2026-10-31', type: 'gasto', category: 'General', amount: 20,
    currency: 'EUR', eurValue: 20, copValue: 88000, usageMode: 'basic',
    createdAt: '2026-10-31T10:00:00Z', ...overrides }
}

describe('saldos de Inicio Personal', () => {
  it('conserva ingresos y gastos de meses y años anteriores al cambiar de mes', () => {
    const totals = calculatePersonalHomeTotals([
      income({ date: '2025-12-31' }), income({ date: '2026-10-31' }), income({ date: '2026-11-01' }),
    ], [expense({ date: '2025-12-31' }), expense({ date: '2026-11-01' })], 'EUR', 'COP')
    expect(totals.primaryIncome).toBe(300)
    expect(totals.primaryExpenses).toBe(40)
    expect(totals.primaryNet).toBe(260)
    expect(totals.secondaryNet).toBe(1144000)
  })
  it('excluye movimientos profesionales y reconoce registros históricos personales sin modo explícito', () => {
    const totals = calculatePersonalHomeTotals([
      income(), income({ usageMode: undefined }), income({ usageMode: 'professional', earningPeriodId: 7 }),
      income({ usageMode: undefined, seasonPeriodId: 8 }),
    ], [expense(), expense({ usageMode: 'professional', earningPeriodId: 7 })], 'EUR', 'COP')
    expect(totals.primaryIncome).toBe(200)
    expect(totals.primaryExpenses).toBe(20)
    expect(totals.primaryNet).toBe(180)
  })
  it('devuelve cero sin movimientos sin inventar saldos de wallets', () => {
    const totals = calculatePersonalHomeTotals([], [], 'EUR', 'COP')
    expect(totals.primaryNet).toBe(0)
    expect(totals.primaryIncome).toBe(0)
    expect(totals.primaryExpenses).toBe(0)
  })
})
