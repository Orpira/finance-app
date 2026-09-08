import { describe, expect, it } from 'vitest'

import {
  buildWalletReportModel,
  WalletReportIntegrityError,
  type BuildWalletReportModelInput,
} from '../src/services/walletReportService'
import type { Wallet } from '../src/types/wallet'
import type { ServiceIncome } from '../src/types/service'
import type { Expense } from '../src/types/expense'
import type { InternalTransfer } from '../src/types/internalTransfer'

const wallet = (overrides: Partial<Wallet>): Wallet => ({
  id: overrides.id ?? 'wal-1',
  name: overrides.name ?? 'Cuenta principal',
  normalizedName: overrides.normalizedName ?? 'cuenta principal',
  usageMode: 'basic',
  isDefault: overrides.isDefault ?? false,
  isArchived: overrides.isArchived ?? false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

let incomeIdCounter = 0
const income = (overrides: Partial<ServiceIncome>): ServiceIncome => {
  incomeIdCounter += 1
  return {
    id: overrides.id ?? incomeIdCounter,
    walletId: overrides.walletId,
    date: overrides.date ?? '2026-09-05',
    duration: 60,
    totalAmount: overrides.totalAmount ?? 100,
    currency: overrides.currency ?? 'EUR',
    percentage: 100,
    realGain: overrides.realGain ?? overrides.totalAmount ?? 100,
    eurValue: overrides.eurValue ?? 100,
    copValue: (overrides.eurValue ?? 100) * 4300,
    exchangeRateUsed: 4300,
    type: overrides.type,
    additionalsTotal: overrides.additionalsTotal,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? `${overrides.date ?? '2026-09-05'}T00:00:00.000Z`,
  }
}

let expenseIdCounter = 0
const expense = (overrides: Partial<Expense>): Expense => {
  expenseIdCounter += 1
  return {
    id: overrides.id ?? expenseIdCounter,
    type: overrides.type ?? 'gasto',
    walletId: overrides.walletId,
    date: overrides.date ?? '2026-09-05',
    category: overrides.category ?? 'Varios',
    amount: overrides.amount ?? 10,
    currency: overrides.currency ?? 'EUR',
    eurValue: overrides.eurValue ?? overrides.amount ?? 10,
    copValue: (overrides.eurValue ?? overrides.amount ?? 10) * 4300,
    notes: overrides.notes,
    createdAt: overrides.createdAt ?? `${overrides.date ?? '2026-09-05'}T00:00:00.000Z`,
  }
}

let transferIdCounter = 0
const transfer = (overrides: Partial<InternalTransfer>): InternalTransfer => {
  transferIdCounter += 1
  return {
    id: overrides.id ?? `itx-${transferIdCounter}`,
    fromWalletId: overrides.fromWalletId ?? 'wal-1',
    toWalletId: overrides.toWalletId ?? 'wal-2',
    amount: overrides.amount ?? 10,
    currency: overrides.currency ?? 'EUR',
    date: overrides.date ?? '2026-09-05',
    note: overrides.note,
    usageMode: 'basic',
    createdAt: overrides.createdAt ?? `${overrides.date ?? '2026-09-05'}T00:00:00.000Z`,
    updatedAt: overrides.createdAt ?? `${overrides.date ?? '2026-09-05'}T00:00:00.000Z`,
  }
}

function baseInput(overrides: Partial<BuildWalletReportModelInput> = {}): BuildWalletReportModelInput {
  return {
    currency: 'EUR',
    period: null,
    wallets: [],
    incomes: [],
    expenses: [],
    transfers: [],
    ...overrides,
  }
}

function section(model: ReturnType<typeof buildWalletReportModel>, walletId: string) {
  const found = model.wallets.find((entry) => entry.walletId === walletId)
  if (found === undefined) throw new Error(`Wallet ${walletId} not in model`)
  return found
}

describe('buildWalletReportModel — invariantes básicas (spec §37)', () => {
  it('un ingreso externo aumenta externalIncomeTotal y closingBalance, nunca transferReceivedTotal', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 350 })],
    }))
    const s = section(model, 'wal-1')
    expect(s.externalIncomeTotal).toBe(350)
    expect(s.transferReceivedTotal).toBe(0)
    expect(s.closingBalance).toBe(350)
  })

  it('una transferencia recibida aumenta transferReceivedTotal, nunca externalIncomeTotal', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2', name: 'Comida', normalizedName: 'comida' })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 10 })],
    }))
    const s = section(model, 'wal-2')
    expect(s.transferReceivedTotal).toBe(10)
    expect(s.externalIncomeTotal).toBe(0)
    expect(s.closingBalance).toBe(10)
  })

  it('un egreso aumenta expenseTotal', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 100 })],
      expenses: [expense({ walletId: 'wal-1', eurValue: 30 })],
    }))
    const s = section(model, 'wal-1')
    expect(s.expenseTotal).toBe(30)
    expect(s.closingBalance).toBe(70)
  })

  it('una transferencia enviada aumenta transferSentTotal', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 100 })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 40 })],
    }))
    const s = section(model, 'wal-1')
    expect(s.transferSentTotal).toBe(40)
    expect(s.closingBalance).toBe(60)
  })

  it('un ajuste positivo aumenta adjustmentTotal y un ajuste negativo lo reduce', () => {
    const positive = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      incomes: [income({ walletId: 'wal-1', type: 'ajuste', eurValue: 5, realGain: 5 })],
    }))
    expect(section(positive, 'wal-1').adjustmentTotal).toBe(5)
    expect(section(positive, 'wal-1').closingBalance).toBe(5)

    const negative = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      expenses: [expense({ walletId: 'wal-1', type: 'ajuste', eurValue: -3, amount: -3 })],
    }))
    expect(section(negative, 'wal-1').adjustmentTotal).toBe(-3)
    expect(section(negative, 'wal-1').closingBalance).toBe(-3)
  })

  it('el saldo final cumple exactamente la fórmula del modelo', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 500 })],
      expenses: [expense({ walletId: 'wal-2', eurValue: 20 })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 80 })],
    }))
    for (const s of model.wallets) {
      expect(s.closingBalance).toBeCloseTo(
        s.openingBalance + s.externalIncomeTotal + s.transferReceivedTotal - s.expenseTotal - s.transferSentTotal + s.adjustmentTotal,
        6,
      )
    }
  })

  it('las transferencias no cambian el total general disponible', () => {
    const withoutTransfer = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 350 })],
    }))
    const withTransfer = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 350 })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 70 })],
    }))
    expect(withoutTransfer.totalAvailable).toBe(350)
    expect(withTransfer.totalAvailable).toBe(350)
  })
})

describe('buildWalletReportModel — perspectiva de la transferencia (spec §38)', () => {
  it('la misma transferencia se ve enviada desde el origen y recibida desde el destino, sin duplicar el registro', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-A', name: 'A', normalizedName: 'a' }), wallet({ id: 'wal-B', name: 'B', normalizedName: 'b' })],
      transfers: [transfer({ fromWalletId: 'wal-A', toWalletId: 'wal-B', amount: 150 })],
    }))
    const a = section(model, 'wal-A')
    const b = section(model, 'wal-B')

    expect(a.transferSentTotal).toBe(150)
    expect(a.sentTransfers).toHaveLength(1)
    expect(a.receivedTransfers).toHaveLength(0)
    expect(a.closingBalance).toBe(-150)

    expect(b.transferReceivedTotal).toBe(150)
    expect(b.receivedTransfers).toHaveLength(1)
    expect(b.sentTransfers).toHaveLength(0)
    expect(b.closingBalance).toBe(150)

    expect(model.transferCount).toBe(1)
    expect(model.totalMoved).toBe(150)
    expect(a.sentTransfers[0].id).toBe(b.receivedTransfers[0].id)
  })
})

describe('buildWalletReportModel — periodos (spec §39)', () => {
  it('separa correctamente movimiento anterior, dentro y posterior al periodo', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      incomes: [
        income({ walletId: 'wal-1', date: '2026-08-15', eurValue: 50 }), // anterior
        income({ walletId: 'wal-1', date: '2026-09-10', eurValue: 999 }), // posterior, no debe contar
      ],
      period: { start: '2026-09-01', end: '2026-09-08' },
    }))
    const s = section(model, 'wal-1')
    expect(s.openingBalance).toBe(50)
    expect(s.externalIncomeTotal).toBe(0)
  })

  it('conserva el ejemplo del §39: saldo inicial 50, transferencia recibida 20, egreso 10, transferencia enviada 5 → saldo final 55', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' }), wallet({ id: 'wal-3' })],
      incomes: [income({ walletId: 'wal-1', date: '2026-08-15', eurValue: 50 })],
      expenses: [expense({ walletId: 'wal-1', date: '2026-09-05', eurValue: 10 })],
      transfers: [
        transfer({ fromWalletId: 'wal-2', toWalletId: 'wal-1', date: '2026-09-03', amount: 20 }),
        transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-3', date: '2026-09-06', amount: 5 }),
      ],
      period: { start: '2026-09-01', end: '2026-09-30' },
    }))
    const s = section(model, 'wal-1')
    expect(s.openingBalance).toBe(50)
    expect(s.transferReceivedTotal).toBe(20)
    expect(s.expenseTotal).toBe(10)
    expect(s.transferSentTotal).toBe(5)
    expect(s.closingBalance).toBe(55)
  })

  it('sin periodo (todo el historial), el saldo inicial siempre es 0', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      incomes: [income({ walletId: 'wal-1', date: '2020-01-01', eurValue: 999 })],
      period: null,
    }))
    expect(section(model, 'wal-1').openingBalance).toBe(0)
  })
})

describe('buildWalletReportModel — ingresos adicionales (spec §40)', () => {
  it('el saldo de la wallet incluye principal + adicionales, y el detalle concilia esa misma cifra', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      incomes: [income({ walletId: 'wal-1', eurValue: 100, additionalsTotal: 20, realGain: 100 })],
    }))
    const s = section(model, 'wal-1')
    expect(s.closingBalance).toBe(120)
    expect(s.externalIncomeTotal).toBe(120)
    expect(s.externalIncomes[0]).toEqual(expect.objectContaining({ principal: 100, additional: 20, total: 120 }))
  })
})

describe('buildWalletReportModel — moneda (spec §41)', () => {
  it('excluye del total una transferencia en otra moneda y lo marca explícitamente, sin tratarla como cero', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 100, currency: 'USD' })],
      currency: 'EUR',
    }))
    const from = section(model, 'wal-1')
    const to = section(model, 'wal-2')
    expect(from.transferSentTotal).toBe(0)
    expect(to.transferReceivedTotal).toBe(0)
    expect(from.hasCurrencyMismatchTransfers).toBe(true)
    expect(to.hasCurrencyMismatchTransfers).toBe(true)
    expect(model.hasCurrencyMismatchTransfers).toBe(true)
  })

  it('el efecto agregado de cada transferencia en la moneda correcta es exactamente cero', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' }), wallet({ id: 'wal-2' })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 33.5 })],
    }))
    expect(section(model, 'wal-1').closingBalance + section(model, 'wal-2').closingBalance).toBe(0)
  })
})

describe('buildWalletReportModel — wallets archivadas y saldos negativos (spec §27/§28)', () => {
  it('incluye una wallet archivada con saldo o actividad, pero omite una archivada vacía', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [
        wallet({ id: 'wal-1' }),
        wallet({ id: 'wal-archived-with-balance', isArchived: true, name: 'Vieja', normalizedName: 'vieja' }),
        wallet({ id: 'wal-archived-empty', isArchived: true, name: 'Cerrada', normalizedName: 'cerrada' }),
      ],
      incomes: [income({ walletId: 'wal-archived-with-balance', eurValue: 40 })],
    }))
    expect(model.wallets.map((s) => s.walletId).sort()).toEqual(['wal-1', 'wal-archived-with-balance'])
  })

  it('conserva un saldo negativo tal cual, sin convertirlo en cero', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      expenses: [expense({ walletId: 'wal-1', eurValue: 30 })],
    }))
    expect(section(model, 'wal-1').closingBalance).toBe(-30)
    expect(model.totalAvailable).toBe(-30)
  })
})

describe('buildWalletReportModel — escenario real del criterio de aceptación (spec §42/§52)', () => {
  it('+350 → Depósitos, 10 Depósitos→Comida, -10 Comida→Proteína', () => {
    const model = buildWalletReportModel(baseInput({
      wallets: [
        wallet({ id: 'wal-deposito', name: 'Depósitos', normalizedName: 'depositos', isDefault: true }),
        wallet({ id: 'wal-comida', name: 'Comida', normalizedName: 'comida' }),
      ],
      incomes: [income({ walletId: 'wal-deposito', eurValue: 350 })],
      expenses: [expense({ walletId: 'wal-comida', category: 'Proteína', eurValue: 10 })],
      transfers: [transfer({ fromWalletId: 'wal-deposito', toWalletId: 'wal-comida', amount: 10 })],
    }))

    const deposito = section(model, 'wal-deposito')
    expect(deposito.externalIncomeTotal).toBe(350)
    expect(deposito.transferReceivedTotal).toBe(0)
    expect(deposito.expenseTotal).toBe(0)
    expect(deposito.transferSentTotal).toBe(10)
    expect(deposito.closingBalance).toBe(340)

    const comida = section(model, 'wal-comida')
    expect(comida.externalIncomeTotal).toBe(0)
    expect(comida.transferReceivedTotal).toBe(10)
    expect(comida.expenseTotal).toBe(10)
    expect(comida.transferSentTotal).toBe(0)
    expect(comida.closingBalance).toBe(0)

    expect(model.totalAvailable).toBe(340)
  })
})

describe('buildWalletReportModel — validación fail-closed (spec §36)', () => {
  it('rechaza una wallet que no pertenece al espacio Personal en vez de generar un reporte parcial', () => {
    expect(() => buildWalletReportModel(baseInput({
      wallets: [{ ...wallet({ id: 'wal-1' }), usageMode: 'professional' as never }],
    }))).toThrow(WalletReportIntegrityError)
  })

  it('rechaza una transferencia que referencia una wallet inexistente en vez de inventar el nombre', () => {
    expect(() => buildWalletReportModel(baseInput({
      wallets: [wallet({ id: 'wal-1' })],
      transfers: [transfer({ fromWalletId: 'wal-1', toWalletId: 'wal-ghost' })],
    }))).toThrow(WalletReportIntegrityError)
  })
})
