import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory fake of the small slice of the Dexie Table API walletService.ts
// and internalTransferService.ts actually use, following the pattern in
// test/hybridActivationDataIsolation.test.ts — real behavioral coverage
// (dedup, default reassignment, balance derivation) instead of call-count
// assertions on a hand-mocked chain.

interface WalletRow {
  id: string
  name: string
  normalizedName: string
  usageMode: 'basic'
  isDefault: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}

interface IncomeRow {
  id: number
  walletId?: string
  currency: string
  eurValue: number
}

interface ExpenseRow {
  id: number
  walletId?: string
  currency: string
  eurValue: number
}

interface TransferRow {
  id: string
  fromWalletId: string
  toWalletId: string
  amount: number
  currency: string
  date: string
  note?: string
  usageMode: 'basic'
  createdAt: string
  updatedAt: string
}

let wallets: WalletRow[]
let incomes: IncomeRow[]
let expenses: ExpenseRow[]
let transfers: TransferRow[]

function makeIndexedTable<T extends Record<string, unknown>>(
  getRows: () => T[],
  idField: keyof T,
) {
  return {
    async get(id: unknown) {
      return getRows().find((row) => row[idField] === id)
    },
    async toArray() {
      return [...getRows()]
    },
    orderBy(field: keyof T) {
      return {
        toArray: async () =>
          [...getRows()].sort((a, b) => String(a[field]).localeCompare(String(b[field]))),
      }
    },
    where(field: keyof T) {
      return {
        equals(value: unknown) {
          const matches = () => getRows().filter((row) => row[field] === value)
          return {
            count: async () => matches().length,
            toArray: async () => matches(),
          }
        },
      }
    },
    async put(row: T) {
      const rows = getRows()
      const index = rows.findIndex((existing) => existing[idField] === row[idField])
      if (index === -1) rows.push(row)
      else rows[index] = row
      return row[idField]
    },
    async delete(id: unknown) {
      const rows = getRows()
      const index = rows.findIndex((row) => row[idField] === id)
      if (index !== -1) rows.splice(index, 1)
    },
  }
}

vi.mock('../src/database/db', () => ({
  get db() {
    return {
      wallets: makeIndexedTable(() => wallets, 'id'),
      services: makeIndexedTable(() => incomes, 'id'),
      expenses: makeIndexedTable(() => expenses, 'id'),
      internalTransfers: makeIndexedTable(() => transfers, 'id'),
      async transaction(_mode: unknown, _tables: unknown, callback: () => unknown) {
        return callback()
      },
    }
  },
}))

vi.stubGlobal('window', { dispatchEvent: () => true })

const {
  archiveWallet,
  countReferencesForWallet,
  createWallet,
  deleteWallet,
  getDefaultWallet,
  getWalletBalance,
  listWallets,
  reactivateWallet,
  renameWallet,
  setDefaultWallet,
} = await import('../src/services/walletService')
const { createInternalTransfer } = await import('../src/services/internalTransferService')

vi.mock('../src/services/settingsService', () => ({
  getSettings: async () => ({ defaultCurrency: 'EUR', usageMode: 'basic' }),
}))

beforeEach(() => {
  wallets = []
  incomes = []
  expenses = []
  transfers = []
})

describe('walletService — CRUD', () => {
  it('crea la primera wallet como predeterminada automáticamente', async () => {
    const wallet = await createWallet({ name: 'Cuenta principal' })
    expect(wallet.isDefault).toBe(true)
  })

  it('la segunda wallet no es predeterminada salvo que se indique', async () => {
    await createWallet({ name: 'Cuenta principal' })
    const second = await createWallet({ name: 'Efectivo' })
    expect(second.isDefault).toBe(false)
  })

  it('rechaza nombres duplicados (insensible a mayúsculas/tildes/espacios)', async () => {
    await createWallet({ name: 'Cuenta principal' })
    await expect(createWallet({ name: '  CUENTA   PRINCIPAL  ' })).rejects.toThrow('Ya existe')
  })

  it('renombrar valida duplicados contra otras wallets', async () => {
    await createWallet({ name: 'Cuenta principal' })
    const second = await createWallet({ name: 'Efectivo' })
    await expect(renameWallet(second.id, 'Cuenta principal')).rejects.toThrow('Ya existe')
  })

  it('setDefaultWallet mueve la marca de predeterminada de una wallet a otra', async () => {
    const first = await createWallet({ name: 'Cuenta principal' })
    const second = await createWallet({ name: 'Efectivo' })

    await setDefaultWallet(second.id)

    const defaultWallet = await getDefaultWallet()
    expect(defaultWallet?.id).toBe(second.id)
    const reloadedFirst = wallets.find((wallet) => wallet.id === first.id)
    expect(reloadedFirst?.isDefault).toBe(false)
  })

  it('archivar quita la marca de predeterminada', async () => {
    const wallet = await createWallet({ name: 'Cuenta principal' })
    const archived = await archiveWallet(wallet.id)
    expect(archived.isDefault).toBe(false)
    expect(archived.isArchived).toBe(true)
  })

  it('reactivar una wallet archivada la vuelve a mostrar en la lista activa', async () => {
    const wallet = await createWallet({ name: 'Cuenta principal' })
    await archiveWallet(wallet.id)
    expect(await listWallets({ archived: 'active' })).toHaveLength(0)

    await reactivateWallet(wallet.id)
    expect(await listWallets({ archived: 'active' })).toHaveLength(1)
  })

  it('no elimina una wallet con movimientos asociados; permite archivarla', async () => {
    const wallet = await createWallet({ name: 'Cuenta principal' })
    incomes.push({ id: 1, walletId: wallet.id, currency: 'EUR', eurValue: 100 })

    expect(await countReferencesForWallet(wallet.id)).toBe(1)
    await expect(deleteWallet(wallet.id)).rejects.toThrow('movimientos asociados')
    await expect(archiveWallet(wallet.id)).resolves.toMatchObject({ isArchived: true })
  })

  it('elimina una wallet sin movimientos asociados', async () => {
    const wallet = await createWallet({ name: 'Cuenta principal' })
    await deleteWallet(wallet.id)
    expect(wallets).toHaveLength(0)
  })
})

describe('walletService — getWalletBalance (spec §9/§24)', () => {
  it('deriva el saldo únicamente del libro financiero: ingresos - egresos + transferencias entrantes - salientes', async () => {
    const principal = await createWallet({ name: 'Cuenta principal' })
    const casa = await createWallet({ name: 'Dinero en casa' })

    // Ingreso: +500 € → Cuenta principal
    incomes.push({ id: 1, walletId: principal.id, currency: 'EUR', eurValue: 500 })
    // Gasto: -100 € ← Cuenta principal
    expenses.push({ id: 1, walletId: principal.id, currency: 'EUR', eurValue: 100 })
    // Transferencia: 150 € Cuenta principal → Dinero en casa
    await createInternalTransfer({
      fromWalletId: principal.id,
      toWalletId: casa.id,
      amount: 150,
      date: '2026-01-05',
    })
    // Gasto: -30 € ← Dinero en casa
    expenses.push({ id: 2, walletId: casa.id, currency: 'EUR', eurValue: 30 })

    const principalBalance = await getWalletBalance(principal.id, 'EUR')
    const casaBalance = await getWalletBalance(casa.id, 'EUR')

    expect(principalBalance).toBe(250)
    expect(casaBalance).toBe(120)
    expect(principalBalance + casaBalance).toBe(370)
  })

  it('un ingreso o gasto sin walletId no afecta el saldo de ninguna wallet', async () => {
    const wallet = await createWallet({ name: 'Cuenta principal' })
    incomes.push({ id: 1, currency: 'EUR', eurValue: 500 })
    expenses.push({ id: 1, currency: 'EUR', eurValue: 100 })

    expect(await getWalletBalance(wallet.id, 'EUR')).toBe(0)
  })
})
