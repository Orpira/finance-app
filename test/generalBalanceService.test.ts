import { describe, expect, it } from 'vitest'

import { buildFinancialBalanceAsOf } from '../src/services/financialBalanceService'
import {
  buildGeneralBalanceHtml,
  buildGeneralBalanceText,
} from '../src/services/generalBalanceExport'
import {
  buildGeneralBalance,
  getAvailableSections,
  getSectionsForLevel,
  GeneralBalanceIntegrityError,
  type GeneralBalanceInput,
} from '../src/services/generalBalanceService'
import type { EarningPeriod } from '../src/types/earningPeriod'
import type { Expense } from '../src/types/expense'
import type { InternalTransfer } from '../src/types/internalTransfer'
import type { ServiceIncome } from '../src/types/service'
import type { Wallet } from '../src/types/wallet'

function income(partial: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    date: '2026-01-10',
    duration: 60,
    totalAmount: 0,
    currency: 'EUR',
    percentage: 0,
    realGain: 0,
    eurValue: 0,
    copValue: 0,
    exchangeRateUsed: 1,
    usageMode: 'professional',
    ...partial,
  }
}

function expense(partial: Partial<Expense> = {}): Expense {
  return {
    type: 'gasto',
    date: '2026-01-10',
    category: 'General',
    amount: 0,
    currency: 'EUR',
    eurValue: 0,
    copValue: 0,
    usageMode: 'professional',
    createdAt: '2026-01-10T10:00:00.000Z',
    ...partial,
  }
}

function wallet(id: string, name: string, partial: Partial<Wallet> = {}): Wallet {
  return {
    id,
    name,
    normalizedName: name.toLowerCase(),
    usageMode: 'basic',
    isDefault: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

const seasons: EarningPeriod[] = [
  { id: 1, name: 'Invierno', percentage: 50, startDate: '2026-01-01', endDate: '2026-05-31', status: 'closed', economicGoal: 5000, createdAt: '2026-01-01' },
  { id: 2, name: 'Otoño', percentage: 50, startDate: '2026-06-01', status: 'active', createdAt: '2026-06-01' },
]

// Profesional: P = 5200, A = 1000, E = 2100, ajustes = -100 → 4000
const proIncomes: ServiceIncome[] = [
  income({ id: 1, date: '2026-03-01', realGain: 3000, eurValue: 3000, additionalsTotal: 600, paymentType: 'cash', country: 'ES', city: 'Bilbao', earningPeriodId: 1, duration: 120, reportStatusCode: 'reported' }),
  income({ id: 2, date: '2026-09-15', realGain: 2200, eurValue: 2200, additionalsTotal: 400, paymentType: 'bizum', country: 'ES', city: 'Madrid', earningPeriodId: 2, duration: 60 }),
  // Otro modo: nunca debe contar
  income({ id: 3, date: '2026-09-20', realGain: 999, eurValue: 999, usageMode: 'basic' }),
]
const proExpenses: Expense[] = [
  expense({ id: 1, date: '2026-04-01', amount: 2100, eurValue: 2100, category: 'Alojamiento', earningPeriodId: 1 }),
  expense({ id: 2, date: '2026-10-01', type: 'ajuste', amount: -100, eurValue: -100, earningPeriodId: 2 }),
  expense({ id: 3, date: '2026-11-15', amount: 500, eurValue: 500, earningPeriodId: 2 }), // posterior al corte
]

function proInput(partial: Partial<GeneralBalanceInput> = {}): GeneralBalanceInput {
  return {
    incomes: proIncomes,
    expenses: proExpenses,
    transfers: [],
    wallets: [],
    seasons,
    personalIncomeCategories: [],
    personalExpenseCategories: [],
    currency: 'EUR',
    usageMode: 'professional',
    from: null,
    to: '2026-10-30',
    ...partial,
  }
}

describe('generalBalanceService · Profesional', () => {
  it('todo el historial coincide con el Balance Financiero al mismo corte', () => {
    const result = buildGeneralBalance(proInput())
    const financial = buildFinancialBalanceAsOf({
      incomes: proIncomes, expenses: proExpenses, currency: 'EUR', usageMode: 'professional', cutoff: '2026-10-30',
    })
    expect(result.closing.balance).toBe(4000)
    expect(result.closing.balance).toBe(financial.report.generalBalance)
    expect(result.opening.balance).toBe(0)
    expect(result.period.principalIncome).toBe(5200)
    expect(result.period.additionalIncome).toBe(1000)
    expect(result.period.expenses).toBe(2100)
    expect(result.period.adjustmentImpact).toBe(-100)
  })

  it('saldo inicial + variación del periodo = saldo final', () => {
    const result = buildGeneralBalance(proInput({ from: '2026-06-01' }))
    expect(result.opening.balance).toBe(1500) // 3600 - 2100
    expect(result.period.balance).toBe(2500) // 2600 - 100
    expect(result.closing.balance).toBe(4000)
  })

  it('excluye movimientos posteriores al corte y de otros modos', () => {
    const result = buildGeneralBalance(proInput())
    expect(result.movements.some((movement) => movement.date > '2026-10-30')).toBe(false)
    expect(result.movements.some((movement) => movement.id === 3 && movement.kind === 'income')).toBe(false)
  })

  it('los desgloses de ingresos suman el total recibido y los de egresos el total de egresos', () => {
    const result = buildGeneralBalance(proInput())
    const sum = (rows: readonly { total: number }[]) => Math.round(rows.reduce((total, row) => total + row.total, 0) * 100) / 100
    expect(sum(result.incomesByType)).toBe(result.period.totalReceived)
    expect(sum(result.incomesByPaymentType)).toBe(result.period.totalReceived)
    expect(sum(result.incomesByLocation)).toBe(result.period.totalReceived)
    expect(sum(result.expensesByCategory)).toBe(result.period.expenses)
    expect(sum(result.expensesByLocation)).toBe(result.period.expenses)
    expect(result.incomesByCategory).toEqual([])
    expect(result.incomesByLocation.map((row) => row.label)).toContain('España · Bilbao')
  })

  it('reparte el periodo por temporada y la suma coincide con el balance', () => {
    const result = buildGeneralBalance(proInput())
    expect(result.seasons.map((season) => season.name)).toEqual(['Otoño', 'Invierno'])
    const invierno = result.seasons.find((season) => season.seasonId === 1)!
    expect(invierno.totals.balance).toBe(1500)
    expect(invierno.goal).toBe(5000)
    // Meta usa el resultado realizado (principal - gastos): 3000 - 2100
    expect(invierno.goalResult).toBe(900)
    expect(invierno.goalPercentage).toBe(18)
    const otono = result.seasons.find((season) => season.seasonId === 2)!
    expect(otono.totals.balance).toBe(2500)
    expect(otono.goal).toBeNull()
  })

  it('agrupa por estado de reporte y calcula actividad', () => {
    const result = buildGeneralBalance(proInput())
    const reported = result.reportStatus.find((row) => row.code === 'reported')!
    expect(reported.incomeTotal).toBe(3600)
    expect(result.activity.serviceCount).toBe(2)
    expect(result.activity.scheduledMinutes).toBe(180)
    expect(result.wallets).toBeNull()
  })

  it('aplica cada ajuste exactamente una vez', () => {
    const result = buildGeneralBalance(proInput())
    expect(result.adjustments).toHaveLength(1)
    expect(result.movements.filter((movement) => movement.kind === 'adjustment')).toHaveLength(1)
  })

  it('rechaza rangos inválidos (fail-closed)', () => {
    expect(() => buildGeneralBalance(proInput({ to: '2026-02-30' }))).toThrow(GeneralBalanceIntegrityError)
    expect(() => buildGeneralBalance(proInput({ from: '2026-11-01', to: '2026-10-30' }))).toThrow('GENERAL_BALANCE_FROM_AFTER_TO')
  })

  it('no modifica los registros de entrada', () => {
    const before = structuredClone({ proIncomes, proExpenses })
    buildGeneralBalance(proInput({ from: '2026-06-01' }))
    expect({ proIncomes, proExpenses }).toEqual(before)
  })
})

describe('generalBalanceService · Básico con wallets', () => {
  const wallets = [wallet('w-main', 'Principal', { isDefault: true }), wallet('w-save', 'Ahorro')]
  const incomes = [
    income({ id: 10, usageMode: 'basic', date: '2026-02-01', realGain: 1000, eurValue: 1000, walletId: 'w-main', personalCategoryId: 'c-salary' }),
    income({ id: 11, usageMode: 'basic', date: '2026-09-01', realGain: 500, eurValue: 500 }), // sin wallet
  ]
  const expenses = [
    expense({ id: 10, usageMode: 'basic', date: '2026-09-10', amount: 200, eurValue: 200, walletId: 'w-main', personalCategoryId: 'e-food', category: 'Comida' }),
  ]
  const transfers: InternalTransfer[] = [
    { id: 't1', fromWalletId: 'w-main', toWalletId: 'w-save', amount: 300, currency: 'EUR', date: '2026-09-05', usageMode: 'basic', createdAt: '2026-09-05T10:00:00Z', updatedAt: '2026-09-05T10:00:00Z' },
  ]

  function basicInput(partial: Partial<GeneralBalanceInput> = {}): GeneralBalanceInput {
    return {
      incomes, expenses, transfers, wallets, seasons: [],
      personalIncomeCategories: [{ id: 'c-salary', name: 'Nómina', normalizedName: 'nomina', usageMode: 'basic', isArchived: false, createdAt: '', updatedAt: '' }],
      personalExpenseCategories: [{ id: 'e-food', name: 'Alimentación', normalizedName: 'alimentacion', usageMode: 'basic', isArchived: false, createdAt: '', updatedAt: '' }],
      currency: 'EUR', usageMode: 'basic', from: null, to: '2026-10-30',
      ...partial,
    }
  }

  it('las transferencias no alteran el balance general', () => {
    const result = buildGeneralBalance(basicInput())
    const withoutTransfers = buildGeneralBalance(basicInput({ transfers: [] }))
    expect(result.closing.balance).toBe(1300)
    expect(withoutTransfers.closing.balance).toBe(1300)
  })

  it('concilia la suma de wallets con el saldo final y muestra lo no asignado', () => {
    const result = buildGeneralBalance(basicInput())
    const byName = new Map(result.wallets!.wallets.map((section) => [section.walletName, section]))
    expect(byName.get('Principal')!.closingBalance).toBe(500) // 1000 - 300 - 200
    expect(byName.get('Ahorro')!.closingBalance).toBe(300)
    expect(result.walletReconciliation).toEqual({
      walletsTotal: 800,
      generalClosing: 1300,
      unassignedDifference: 500,
      hasCurrencyMismatchTransfers: false,
    })
  })

  it('usa las categorías personales y no ofrece temporadas ni actividad', () => {
    const result = buildGeneralBalance(basicInput())
    expect(result.incomesByCategory.map((row) => row.label).sort()).toEqual(['Nómina', 'Sin categoría'])
    expect(result.expensesByCategory.map((row) => row.label)).toEqual(['Alimentación'])
    expect(result.seasons).toEqual([])
    expect(getAvailableSections('basic').map((section) => section.id)).not.toContain('seasons')
    expect(getAvailableSections('professional').map((section) => section.id)).not.toContain('wallets')
  })
})

describe('niveles y exportación', () => {
  it('cada nivel incluye las secciones de los niveles anteriores', () => {
    expect(getSectionsForLevel(1, 'professional')).toEqual([])
    expect(getSectionsForLevel(2, 'professional')).toEqual(['components'])
    expect(getSectionsForLevel(3, 'professional')).toEqual(
      ['components', 'incomeBreakdown', 'expenseBreakdown', 'seasons', 'reportStatus', 'activity'],
    )
    expect(getSectionsForLevel(4, 'basic')).toContain('wallets')
    expect(getSectionsForLevel(4, 'basic')).toContain('movements')
  })

  it('la exportación solo incluye las secciones elegidas con las mismas cifras', () => {
    const result = buildGeneralBalance(proInput({ from: '2026-06-01' }))
    const money = (value: number) => value.toFixed(2)
    const text = buildGeneralBalanceText(result, ['components'], money)
    expect(text).toContain('Saldo inicial: 1500.00')
    expect(text).toContain('Saldo final: 4000.00')
    expect(text).toContain('COMPONENTES')
    expect(text).not.toContain('TEMPORADAS')

    const html = buildGeneralBalanceHtml(result, ['seasons', 'movements'], money)
    expect(html).toContain('Temporadas')
    expect(html).toContain('Movimientos')
    expect(html).not.toContain('Componentes')
  })

  it('escapa el texto de los registros en el HTML', () => {
    const result = buildGeneralBalance(proInput({
      expenses: [expense({ id: 5, type: 'ajuste', date: '2026-05-01', amount: 10, eurValue: 10, notes: '<script>x</script>' })],
    }))
    const html = buildGeneralBalanceHtml(result, ['adjustments'], (value) => String(value))
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('formato de importes que restan', () => {
  it('no muestra -0 cuando el importe es cero', () => {
    const result = buildGeneralBalance(proInput({ from: '2026-06-01' }))
    const text = buildGeneralBalanceText(result, ['components'], (value) => value.toFixed(2))
    expect(text).toContain('Egresos (E): 0.00')
    expect(text).not.toContain('-0.00')
  })
})
