import { beforeEach, describe, expect, it, vi } from 'vitest'

interface WalletRow {
  id: string
  name: string
  usageMode: 'basic' | 'professional'
  isArchived: boolean
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
let transfers: TransferRow[]
let incomes: Array<{ walletId?: string; eurValue: number; currency: string }>
let expenses: Array<{ walletId?: string; eurValue: number; currency: string }>
let settingsRow: { defaultCurrency: string; usageMode: 'basic' | 'professional' | 'hybrid'; activeContext?: 'basic' | 'professional' }

vi.mock('../src/database/db', () => ({
  get db() {
    return {
      wallets: {
        async get(id: string) {
          return wallets.find((wallet) => wallet.id === id)
        },
      },
      services: {
        async toArray() {
          return [...incomes]
        },
      },
      expenses: {
        async toArray() {
          return [...expenses]
        },
      },
      internalTransfers: {
        async get(id: string) {
          return transfers.find((transfer) => transfer.id === id)
        },
        async put(row: TransferRow) {
          const index = transfers.findIndex((existing) => existing.id === row.id)
          if (index === -1) transfers.push(row)
          else transfers[index] = row
        },
        async delete(id: string) {
          const index = transfers.findIndex((transfer) => transfer.id === id)
          if (index !== -1) transfers.splice(index, 1)
        },
        async toArray() {
          return [...transfers]
        },
        orderBy() {
          return { reverse: () => ({ toArray: async () => [...transfers] }) }
        },
      },
      async transaction(_mode: unknown, _tables: unknown, callback: () => unknown) {
        return callback()
      },
    }
  },
}))

vi.mock('../src/services/settingsService', () => ({
  getSettings: async () => settingsRow,
}))

vi.stubGlobal('window', { dispatchEvent: () => true })

const { createInternalTransfer, deleteInternalTransfer, listInternalTransfers } = await import(
  '../src/services/internalTransferService'
)

beforeEach(() => {
  wallets = [
    { id: 'wal-1', name: 'Cuenta principal', usageMode: 'basic', isArchived: false },
    { id: 'wal-2', name: 'Efectivo', usageMode: 'basic', isArchived: false },
    { id: 'wal-archived', name: 'Vieja', usageMode: 'basic', isArchived: true },
  ]
  transfers = []
  incomes = []
  expenses = []
  settingsRow = { defaultCurrency: 'EUR', usageMode: 'basic' }
})

describe('createInternalTransfer — invariantes (spec §20)', () => {
  it('crea una transferencia válida sin tocar ingresos/egresos', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 500, currency: 'EUR' })
    const transfer = await createInternalTransfer({
      fromWalletId: 'wal-1',
      toWalletId: 'wal-2',
      amount: 150,
      date: '2026-01-05',
    })
    expect(transfer.amount).toBe(150)
    expect(transfer.currency).toBe('EUR')
    expect(transfers).toHaveLength(1)
  })

  it('rechaza una transferencia que dejaría saldo negativo en el origen', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 100, currency: 'EUR' })

    await expect(
      createInternalTransfer({
        fromWalletId: 'wal-1',
        toWalletId: 'wal-2',
        amount: 100.01,
        date: '2026-01-05',
      }),
    ).rejects.toThrow('saldo negativo')
    expect(transfers).toHaveLength(0)
  })

  it('rechaza origen y destino iguales', async () => {
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-1', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('no pueden ser la misma')
  })

  it('rechaza importe cero o negativo', async () => {
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 0, date: '2026-01-05' }),
    ).rejects.toThrow('mayor que cero')
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: -5, date: '2026-01-05' }),
    ).rejects.toThrow('mayor que cero')
  })

  it('rechaza una wallet de origen o destino inexistente', async () => {
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-x', toWalletId: 'wal-2', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('origen no es válida')
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-x', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('destino no es válida')
  })

  it('rechaza una wallet archivada como origen o destino', async () => {
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-archived', toWalletId: 'wal-2', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('origen no es válida')
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-archived', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('destino no es válida')
  })

  it('rechaza una wallet que no pertenece al contexto Personal', async () => {
    wallets[0].usageMode = 'professional'

    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('origen no es válida')
  })

  it('rechaza transferencias fuera del modo Personal', async () => {
    settingsRow = { defaultCurrency: 'EUR', usageMode: 'professional' }
    await expect(
      createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 10, date: '2026-01-05' }),
    ).rejects.toThrow('modo Personal')
  })
})

describe('listInternalTransfers / deleteInternalTransfer', () => {
  it('filtra por wallet (origen o destino)', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 100, currency: 'EUR' })
    incomes.push({ walletId: 'wal-2', eurValue: 20, currency: 'EUR' })
    await createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 10, date: '2026-01-05' })
    await createInternalTransfer({ fromWalletId: 'wal-2', toWalletId: 'wal-1', amount: 20, date: '2026-01-06' })
    wallets.push({ id: 'wal-3', name: 'Otra', usageMode: 'basic', isArchived: false })
    await createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-3', amount: 5, date: '2026-01-07' })

    const forWal2 = await listInternalTransfers({ walletId: 'wal-2' })
    expect(forWal2).toHaveLength(2)
  })

  it('elimina una transferencia existente', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 10, currency: 'EUR' })
    const transfer = await createInternalTransfer({
      fromWalletId: 'wal-1',
      toWalletId: 'wal-2',
      amount: 10,
      date: '2026-01-05',
    })
    await deleteInternalTransfer(transfer.id)
    expect(transfers).toHaveLength(0)
  })

  it('rechaza eliminar una transferencia inexistente', async () => {
    await expect(deleteInternalTransfer('itx-nope')).rejects.toThrow('no existe')
  })
})
