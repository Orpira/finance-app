import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceIncome } from '../src/types/service'
import type { Expense } from '../src/types/expense'
import type { InternalTransfer } from '../src/types/internalTransfer'

// Exercise the actual mutation services against a rollback-capable in-memory ledger.
const state = vi.hoisted(() => ({ rows: {} as Record<string, Record<string, unknown>[]>, locked: new Set<string>(), active: false }))
vi.mock('../src/database/db', () => {
  const table = (name: string) => ({
    name,
    check() { if (state.active && !state.locked.has(name)) throw new Error(`Missing transaction table: ${name}`) },
    async get(id: unknown) { this.check(); return state.rows[name].find((row) => row.id === id) },
    async toArray() { this.check(); return [...state.rows[name]] },
    async add(row: Record<string, unknown>) {
      this.check(); const id = row.id ?? Math.max(0, ...state.rows[name].map((item) => typeof item.id === 'number' ? item.id : 0)) + 1
      state.rows[name].push({ ...row, id }); return id
    },
    async put(row: Record<string, unknown>) {
      this.check(); state.rows[name] = [...state.rows[name].filter((item) => item.id !== row.id), { ...row }]; return row.id
    },
    async update(id: unknown, updates: Record<string, unknown>) {
      this.check(); state.rows[name] = state.rows[name].map((row) => row.id === id ? { ...row, ...updates } : row)
    },
    async delete(id: unknown) { this.check(); state.rows[name] = state.rows[name].filter((item) => item.id !== id) },
    where(field: string) {
      this.check()
      return { equals: (value: unknown) => {
        let predicate = (row: Record<string, unknown>) => row[field] === value
        const collection = {
          and(filter: (row: Record<string, unknown>) => boolean) { const previous = predicate; predicate = (row: Record<string, unknown>) => previous(row) && filter(row); return collection },
          async first() { return state.rows[name].find(predicate) },
          async toArray() { return state.rows[name].filter(predicate) },
          async delete() { state.rows[name] = state.rows[name].filter((row) => !predicate(row)) },
        }
        return collection
      } }
    },
  })
  const tables = Object.fromEntries(['services', 'expenses', 'wallets', 'internalTransfers', 'incomeAdditionals', 'personalIncomeCategories', 'personalExpenseCategories', 'earningPeriods', 'automationOutbox'].map((name) => [name, table(name)]))
  return { db: { ...tables, async transaction(_mode: string, locked: { name: string }[], callback: () => Promise<unknown>) {
    const before = structuredClone(state.rows)
    state.locked = new Set(locked.map((item) => item.name)); state.active = true
    try { return await callback() } catch (error) { state.rows = before; throw error } finally { state.active = false }
  } } }
})
vi.mock('../src/services/settingsService', () => ({ getSettings: async () => ({ usageMode: 'basic', defaultCurrency: 'EUR' }) }))
vi.mock('../src/services/automationOutboxService', () => ({ createAutomationOutboxRecord: vi.fn(), enqueueAutomationEvent: vi.fn(), scheduleAutomationOutboxFlush: vi.fn() }))
vi.mock('../src/services/earningPeriodService', () => ({ getActiveEarningPeriod: vi.fn(), getEarningPeriodById: vi.fn(), assertRecordIsMutable: vi.fn() }))
vi.stubGlobal('window', { dispatchEvent: vi.fn() })
const { createExpense, updateExpense, deleteExpense } = await import('../src/services/expenseService')
const { createServiceIncome, updateServiceIncome, deleteServiceIncome } = await import('../src/services/incomeService')
const { createInternalTransfer, updateInternalTransfer, deleteInternalTransfer } = await import('../src/services/internalTransferService')
const { deleteIncomeAdditional } = await import('../src/services/incomeAdditionalService')
const { assertWalletMutationAllowed } = await import('../src/services/walletPaymentValidation')

function income(value: number, walletId = 'a', id = 1): ServiceIncome {
  return { id, walletId, usageMode: 'basic', type: 'ingreso', status: 'FINALIZADO', date: '2026-11-01', duration: 0, totalAmount: value, realGain: value, percentage: 100, currency: 'EUR', eurValue: value, copValue: value * 4000, exchangeRateUsed: 4000 }
}
function expense(value: number, walletId = 'a', id = 1): Expense {
  return { id, walletId, usageMode: 'basic', type: 'gasto', category: 'Otros', date: '2026-11-01', amount: value, currency: 'EUR', eurValue: value, copValue: value * 4000 }
}
function transfer(value: number, fromWalletId = 'a', toWalletId = 'b', id = 't1'): InternalTransfer {
  return { id, fromWalletId, toWalletId, amount: value, currency: 'EUR', usageMode: 'basic', date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-01T10:00:00Z' }
}
function seed(table: string, ...rows: object[]) { state.rows[table].push(...rows.map((row) => ({ ...row }))) }
beforeEach(() => {
  state.rows = Object.fromEntries(['services', 'expenses', 'wallets', 'internalTransfers', 'incomeAdditionals', 'personalIncomeCategories', 'personalExpenseCategories', 'earningPeriods', 'automationOutbox'].map((name) => [name, []]))
  seed('wallets', { id: 'a', name: 'Obligaciones', usageMode: 'basic', isArchived: false }, { id: 'b', name: 'General', usageMode: 'basic', isArchived: false }, { id: 'c', name: 'Casa', usageMode: 'basic', isArchived: false })
})

describe('wallet payment consistency through mutation services', () => {
  it('blocks the 150 → 157.30 expense edit after the remaining 2.63 was transferred, keeping all records unchanged', async () => {
    seed('services', income(742))
    seed('expenses', expense(100, 'a', 1), expense(100, 'a', 2), expense(279.37, 'a', 3), expense(150, 'a', 4), expense(110, 'a', 5))
    seed('internalTransfers', transfer(2.63))
    const before = structuredClone(state.rows)
    await expect(updateExpense(4, { amount: 157.30, eurValue: 157.30 })).rejects.toThrow(/Obligaciones.*7,30/)
    expect(state.rows).toEqual(before)
  })
  it('blocks creation above available funds and accepts the exact balance including decimal residue', async () => {
    seed('services', income(20)); seed('expenses', expense(17.37))
    await expect(createExpense(expense(2.64, 'a', 2))).rejects.toThrow('0,01')
    expect(state.rows.expenses).toHaveLength(1)
    await createExpense(expense(2.63, 'a', 2))
    expect(state.rows.expenses).toHaveLength(2)
  })
  it('validates the new source on expense reassignment without touching the original', async () => {
    seed('services', income(100)); seed('expenses', expense(60))
    await expect(updateExpense(1, { walletId: 'b' })).rejects.toThrow('General')
    expect(state.rows.expenses[0].walletId).toBe('a')
  })
  it('blocks income reduction, deletion, or reassignment after funds have been spent', async () => {
    seed('services', income(100)); seed('expenses', expense(90))
    await expect(updateServiceIncome(1, { totalAmount: 80, realGain: 80, eurValue: 80 })).rejects.toThrow('10,00')
    await expect(deleteServiceIncome(1)).rejects.toThrow('90,00')
    await expect(updateServiceIncome(1, { walletId: 'b' })).rejects.toThrow('90,00')
    expect(state.rows.services).toEqual([income(100)])
  })
  it('permits deleting an unused income', async () => {
    seed('services', income(100)); await deleteServiceIncome(1); expect(state.rows.services).toHaveLength(0)
  })
  it('blocks deleting or reducing a received transfer after the destination spent it', async () => {
    seed('services', income(100)); seed('internalTransfers', transfer(60)); seed('expenses', expense(55, 'b'))
    const before = structuredClone(state.rows)
    await expect(deleteInternalTransfer('t1')).rejects.toThrow('General')
    await expect(updateInternalTransfer('t1', transfer(40), transfer(60).updatedAt)).rejects.toThrow('15,00')
    expect(state.rows).toEqual(before)
  })
  it('permits deleting a transfer when the destination still has enough funds', async () => {
    seed('services', income(100)); seed('internalTransfers', transfer(60))
    await deleteInternalTransfer('t1'); expect(state.rows.internalTransfers).toHaveLength(0)
  })
  it('reports all wallets affected by a transfer reassignment', async () => {
    seed('services', income(100)); seed('internalTransfers', transfer(60)); seed('expenses', expense(60, 'b'))
    await expect(updateInternalTransfer('t1', transfer(60, 'c', 'a'), transfer(60).updatedAt)).rejects.toThrow(/General.*Casa/)
  })
  it('allows repairing an existing deficit in instalments, but never increasing it', async () => {
    seed('services', income(100), income(50, 'b', 2)); seed('expenses', expense(107.30))
    await updateExpense(1, { amount: 105, eurValue: 105 })
    await createInternalTransfer(transfer(5, 'b', 'a'))
    await expect(createExpense(expense(1, 'a', 2))).rejects.toThrow('saldo negativo')
    expect(state.rows.expenses).toHaveLength(1)
  })
  it('allows metadata and paid-marker edits while a legacy deficit remains', async () => {
    seed('services', income(100)); seed('expenses', expense(107.30))
    await updateExpense(1, { isPhysicallyPaid: true, notes: 'Revisado' })
    expect(state.rows.expenses[0].isPhysicallyPaid).toBe(true)
  })
  it('blocks deleting a negative adjustment that financed later spending', async () => {
    seed('services', income(10)); seed('expenses', { ...expense(-10), type: 'ajuste' }, expense(20, 'a', 2))
    await expect(deleteExpense(1)).rejects.toThrow('10,00')
    expect(state.rows.expenses).toHaveLength(2)
  })
  it('preserves records without a wallet', async () => {
    await createExpense({ ...expense(1000), walletId: undefined })
    expect(state.rows.expenses).toHaveLength(1)
    await assertWalletMutationAllowed({ kind: 'expense', after: { ...expense(1000), walletId: undefined } }, 'EUR')
  })
  it('blocks reducing additionals already used by the wallet and rolls back the child deletion', async () => {
    seed('services', { ...income(100), additionalsTotal: 20 }); seed('expenses', expense(115))
    seed('incomeAdditionals', { id: 1, incomeId: 1, amount: 20 })
    const before = structuredClone(state.rows)
    await expect(deleteIncomeAdditional(1, 1)).rejects.toThrow('15,00')
    expect(state.rows).toEqual(before)
  })
  it('rejects invalid monetary values before any write', async () => {
    seed('services', income(100))
    await expect(createExpense(expense(Number.NaN))).rejects.toThrow('importe no es válido')
    expect(state.rows.expenses).toHaveLength(0)
  })
  it('allows creating income to repair a deficit', async () => {
    seed('expenses', expense(7.30))
    await createServiceIncome(income(7.30))
    expect(state.rows.services).toHaveLength(1)
  })
})

it('rechaza validar una salida si existen transferencias en otra moneda sin valoración histórica', async () => {
  seed('services', income(100)); seed('internalTransfers', { ...transfer(20), currency: 'COP' })
  await expect(createExpense(expense(10))).rejects.toThrow('otra moneda')
  expect(state.rows.expenses).toHaveLength(0)
})
