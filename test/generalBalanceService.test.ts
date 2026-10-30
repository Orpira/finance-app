import { describe, expect, it } from 'vitest'

import { buildFinancialBalanceAsOf } from '../src/services/financialBalanceService'
import {
  buildGeneralBalanceBlocks,
  buildGeneralBalanceHtml,
  buildGeneralBalanceText,
  buildTemplateOptions,
  defaultDetailOptions,
  normalizeReportOptions,
  selectMovements,
  type GeneralBalanceReportOptions,
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

function opts(
  usageMode: 'basic' | 'professional',
  sections: GeneralBalanceReportOptions['sections'],
  detail: Partial<GeneralBalanceReportOptions['detail']> = {},
): GeneralBalanceReportOptions {
  return { sections, detail: { ...defaultDetailOptions(usageMode), ...detail } }
}

const money = (value: number) => value.toFixed(2)

describe('niveles, plantillas y exportación', () => {
  it('cada nivel incluye las secciones de los niveles anteriores', () => {
    expect(getSectionsForLevel(1, 'professional')).toEqual([])
    expect(getSectionsForLevel(2, 'professional')).toEqual(['components'])
    expect(getSectionsForLevel(3, 'professional')).toEqual(
      ['components', 'incomeBreakdown', 'expenseBreakdown', 'seasons', 'reportStatus', 'activity'],
    )
    expect(getSectionsForLevel(4, 'basic')).toContain('wallets')
    expect(getSectionsForLevel(4, 'basic')).toContain('movements')
  })

  it('las plantillas escalan de ejecutivo a auditoría', () => {
    expect(buildTemplateOptions('executive', 'basic').sections).toEqual(['components'])
    expect(buildTemplateOptions('analysis', 'basic').sections).not.toContain('movements')
    const audit = buildTemplateOptions('audit', 'basic')
    expect(audit.sections).toContain('movements')
    expect(audit.detail.columns).toEqual(['category', 'wallet', 'paymentType', 'location', 'reportStatus', 'notes'])
    expect(audit.detail.groupBy).toBe('category')
    expect(audit.detail.showTransfers).toBe(true)
    expect(buildTemplateOptions('audit', 'professional').detail.groupBy).toBe('season')
  })

  it('normaliza opciones que no existen en el modo activo', () => {
    const normalized = normalizeReportOptions(
      opts('professional', ['wallets', 'movements'], { groupBy: 'wallet', columns: ['wallet', 'notes'], showTransfers: true, walletIds: ['x'] }),
      'professional',
    )
    expect(normalized.sections).toEqual(['movements'])
    expect(normalized.detail.groupBy).toBe('none')
    expect(normalized.detail.columns).toEqual(['notes'])
    expect(normalized.detail.showTransfers).toBe(false)
    expect(normalized.detail.walletIds).toBeNull()
  })

  it('la exportación solo incluye las secciones elegidas con las mismas cifras', () => {
    const result = buildGeneralBalance(proInput({ from: '2026-06-01' }))
    const text = buildGeneralBalanceText(result, opts('professional', ['components']), money)
    expect(text).toContain('Saldo inicial: 1500.00')
    expect(text).toContain('Saldo final: 4000.00')
    expect(text).toContain('COMPONENTES')
    expect(text).not.toContain('TEMPORADAS')
    expect(text).not.toContain('-0.00')

    const html = buildGeneralBalanceHtml(result, opts('professional', ['seasons', 'movements']), money)
    expect(html).toContain('Temporadas')
    expect(html).toContain('Movimientos')
    expect(html).not.toContain('<h2>Componentes')
  })

  it('escapa el texto de los registros en el HTML', () => {
    const result = buildGeneralBalance(proInput({
      expenses: [expense({ id: 5, type: 'ajuste', date: '2026-05-01', amount: 10, eurValue: 10, notes: '<script>x</script>' })],
    }))
    const html = buildGeneralBalanceHtml(result, opts('professional', ['adjustments', 'movements'], { columns: ['notes'] }), (value) => String(value))
    expect(html).not.toContain('<script>x')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('detalle parametrizable · Personal', () => {
  const wallets = [wallet('w-main', 'Principal', { isDefault: true }), wallet('w-save', 'Ahorro')]
  const incomes = [
    income({ id: 20, usageMode: 'basic', date: '2026-02-01', realGain: 1000, eurValue: 1000, walletId: 'w-main', personalCategoryId: 'c-salary', personalName: 'Nómina enero', notes: 'Incluye horas extra' }),
    income({ id: 21, usageMode: 'basic', date: '2026-03-01', realGain: 200, eurValue: 200, walletId: 'w-save', personalCategoryId: 'c-gift', personalName: 'Regalo' }),
  ]
  const expenses = [
    expense({ id: 20, usageMode: 'basic', date: '2026-02-10', amount: 300, eurValue: 300, walletId: 'w-main', personalCategoryId: 'e-food', category: 'Comida', personalName: 'Supermercado', notes: 'Compra mensual' }),
    expense({ id: 21, usageMode: 'basic', date: '2026-03-05', amount: 50, eurValue: 50, walletId: 'w-main', personalCategoryId: 'e-fun', category: 'Ocio', personalName: 'Cine' }),
  ]
  const transfers: InternalTransfer[] = [
    { id: 't1', fromWalletId: 'w-main', toWalletId: 'w-save', amount: 100, currency: 'EUR', date: '2026-02-15', note: 'Ahorro mensual', usageMode: 'basic', createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-02-15T10:00:00Z' },
  ]
  const category = (id: string, name: string) => ({ id, name, normalizedName: name.toLowerCase(), usageMode: 'basic' as const, isArchived: false, createdAt: '', updatedAt: '' })
  const result = buildGeneralBalance({
    incomes, expenses, transfers, wallets, seasons: [],
    personalIncomeCategories: [category('c-salary', 'Nómina'), category('c-gift', 'Regalos')],
    personalExpenseCategories: [category('e-food', 'Alimentación'), category('e-fun', 'Ocio')],
    currency: 'EUR', usageMode: 'basic', from: null, to: '2026-10-30',
  })

  it('cada movimiento lleva categoría, wallet y notas', () => {
    const nomina = result.movements.find((movement) => movement.id === 20 && movement.origin === 'income')!
    expect(nomina).toMatchObject({ categoryLabel: 'Nómina', walletName: 'Principal', notes: 'Incluye horas extra', label: 'Nómina enero' })
    expect(result.transfers).toEqual([
      expect.objectContaining({ fromWalletName: 'Principal', toWalletName: 'Ahorro', amount: 100, notes: 'Ahorro mensual' }),
    ])
    expect(result.facets.wallets.map((facet) => facet.label)).toEqual(['Ahorro', 'Principal'])
    expect(result.facets.categories.map((facet) => facet.label)).toEqual(['Alimentación', 'Nómina', 'Ocio', 'Regalos'])
  })

  it('agrupa por categoría con subtotales y sin repetir la categoría en cada fila', () => {
    const block = buildGeneralBalanceBlocks(result, opts('basic', ['movements'], { groupBy: 'category', columns: ['category', 'wallet', 'notes'] }), money)
      .find((item) => item.id === 'movements')!
    const food = block.groups.find((group) => group.subtitle === 'Alimentación · egreso')!
    expect(food.summary).toBe('1 registro · -300.00')
    expect(food.rows[0]).toMatchObject({ value: '-300.00', secondary: ['Principal'], note: 'Compra mensual' })
  })

  it('agrupa por wallet y respeta el filtro de wallets y de tipos', () => {
    const byWallet = selectMovements(result, { ...defaultDetailOptions('basic'), walletIds: ['w-save'] })
    expect(byWallet.map((movement) => movement.id)).toEqual([21])
    const onlyExpenses = selectMovements(result, { ...defaultDetailOptions('basic'), kinds: ['expense'] })
    expect(onlyExpenses.every((movement) => movement.kind === 'expense')).toBe(true)
  })

  it('los filtros acotan el detalle pero no los saldos y lo indican', () => {
    const options = opts('basic', ['movements'], { categoryKeys: ['ex:personal:e-food'] })
    const blocks = buildGeneralBalanceBlocks(result, options, money)
    const summary = blocks.find((item) => item.id === 'summary')!
    expect(summary.headline).toBe(`Saldo final ${money(result.closing.balance)}`)
    expect(result.closing.balance).toBe(850)
    const movements = blocks.find((item) => item.id === 'movements')!
    expect(movements.note).toContain('Detalle filtrado: 1 de 4 registros')
  })

  it('oculta notas y atributos cuando no se eligen columnas', () => {
    const block = buildGeneralBalanceBlocks(result, opts('basic', ['movements'], { columns: [] }), money)
      .find((item) => item.id === 'movements')!
    expect(block.groups[0].rows.every((row) => row.secondary === undefined && row.note === undefined)).toBe(true)
  })

  it('ordena por importe y lista transferencias con notas solo si se piden', () => {
    const sorted = selectMovements(result, { ...defaultDetailOptions('basic'), sort: 'amountDesc' })
    expect(sorted.map((movement) => Math.abs(movement.amount))).toEqual([1000, 300, 200, 50])

    const withTransfers = buildGeneralBalanceBlocks(result, opts('basic', ['wallets'], { showTransfers: true, columns: ['notes'] }), money)
    const transfersBlock = withTransfers.find((item) => item.id === 'transfers')!
    expect(transfersBlock.groups[0].rows[0]).toMatchObject({ label: '2026-02-15 · Principal → Ahorro', note: 'Ahorro mensual' })
    expect(buildGeneralBalanceBlocks(result, opts('basic', ['wallets']), money).some((item) => item.id === 'transfers')).toBe(false)
  })

  it('muestra porcentajes sobre el total en los desgloses', () => {
    const block = buildGeneralBalanceBlocks(result, opts('basic', ['expenseBreakdown'], { showShares: true }), money)
      .find((item) => item.id === 'expenseBreakdown')!
    expect(block.groups[0].rows[0].value).toBe('300.00 · 85.7 %')
  })

  it('el PDF describe la configuración y lleva notas y atributos', () => {
    const text = buildGeneralBalanceText(result, buildTemplateOptions('audit', 'basic'), money)
    expect(text).toContain('Detalle: agrupado por categoría')
    expect(text).toContain('Nota: Incluye horas extra')
    expect(text).toContain('TRANSFERENCIAS INTERNAS')
    expect(text).toContain('Nota: Ahorro mensual')
  })
})

describe('legibilidad', () => {
  it('omite el desglose por ubicación cuando ningún registro la tiene', () => {
    const result = buildGeneralBalance(proInput({
      incomes: [income({ id: 1, date: '2026-03-01', realGain: 100, eurValue: 100 })],
      expenses: [],
    }))
    const block = buildGeneralBalanceBlocks(result, opts('professional', ['incomeBreakdown']), money)
      .find((item) => item.id === 'incomeBreakdown')!
    expect(block.groups.map((group) => group.subtitle)).toEqual(['Por tipo', 'Por tipo de pago'])
  })

  it('el estado de reporte solo lista estados con registros', () => {
    const result = buildGeneralBalance(proInput())
    const block = buildGeneralBalanceBlocks(result, opts('professional', ['reportStatus']), money)
      .find((item) => item.id === 'reportStatus')!
    expect(block.groups[0].rows.map((row) => row.label)).toEqual([
      'Reportado · ingresos (1)',
      'Pendiente · ingresos (1)',
      'Pendiente · egresos (1)',
    ])
    expect(block.headline).toBe('2 registros sin reportar')
  })

  it('al agrupar por categoría, ingresos primero, luego egresos y ajustes al final', () => {
    const result = buildGeneralBalance(proInput())
    const block = buildGeneralBalanceBlocks(result, opts('professional', ['movements'], { groupBy: 'category' }), money)
      .find((item) => item.id === 'movements')!
    expect(block.groups.map((group) => group.subtitle)).toEqual(['Servicio · ingreso', 'Alojamiento · egreso', 'Ajuste · egreso'])
  })
})
