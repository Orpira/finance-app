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

const { createInternalTransfer, deleteInternalTransfer, listInternalTransfers, updateInternalTransfer } = await import(
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


describe('updateInternalTransfer', () => {
  async function seed(amount = 60) {
    incomes.push({ walletId: 'wal-1', eurValue: 100, currency: 'EUR' })
    return createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount, date: '2026-10-31' })
  }
  it('reemplaza sin duplicar, conserva identidad, moneda y creación y no toca ingresos/egresos', async () => {
    const original = await seed()
    settingsRow.defaultCurrency = 'COP'
    const updated = await updateInternalTransfer(original.id, {
      fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 80, date: '2026-11-01', note: ' Nueva nota ',
    }, original.updatedAt)
    expect(updated).toMatchObject({ id: original.id, createdAt: original.createdAt, currency: 'EUR', amount: 80, note: 'Nueva nota' })
    expect(updated.updatedAt).not.toBe(original.updatedAt)
    expect(transfers).toHaveLength(1)
    expect(incomes).toHaveLength(1)
    expect(expenses).toHaveLength(0)
  })
  it('rechaza aumentos por encima del saldo disponible sin cambiar el registro', async () => {
    const original = await seed()
    await expect(updateInternalTransfer(original.id, { ...original, amount: 101 }, original.updatedAt)).rejects.toThrow('saldo negativo')
    expect(transfers[0]).toEqual(original)
  })
  it('rechaza reducir el destino cuando ese dinero ya se gastó', async () => {
    const original = await seed()
    expenses.push({ walletId: 'wal-2', eurValue: 50, currency: 'EUR' })
    await expect(updateInternalTransfer(original.id, { ...original, amount: 40 }, original.updatedAt)).rejects.toThrow('saldo negativo')
    expect(transfers[0]).toEqual(original)
  })
  it('permite cambiar ambas wallets, retirando primero el efecto anterior', async () => {
    const original = await seed()
    wallets.push({ id: 'wal-3', name: 'Otra', usageMode: 'basic', isArchived: false })
    incomes.push({ walletId: 'wal-2', eurValue: 20, currency: 'EUR' })
    const updated = await updateInternalTransfer(original.id, { ...original, fromWalletId: 'wal-2', toWalletId: 'wal-3', amount: 20 }, original.updatedAt)
    expect(updated).toMatchObject({ fromWalletId: 'wal-2', toWalletId: 'wal-3', amount: 20 })
    expect(transfers).toHaveLength(1)
  })
  it('rechaza una edición obsoleta y una transferencia eliminada', async () => {
    const original = await seed()
    await updateInternalTransfer(original.id, { ...original, note: 'Nueva' }, original.updatedAt)
    await expect(updateInternalTransfer(original.id, original, original.updatedAt)).rejects.toThrow('cambió')
    await deleteInternalTransfer(original.id)
    await expect(updateInternalTransfer(original.id, original, original.updatedAt)).rejects.toThrow('no existe')
  })
  it('rechaza Profesional y acepta el contexto Personal de Híbrido', async () => {
    const original = await seed()
    settingsRow.usageMode = 'professional'
    await expect(updateInternalTransfer(original.id, original, original.updatedAt)).rejects.toThrow('modo Personal')
    settingsRow = { defaultCurrency: 'EUR', usageMode: 'hybrid', activeContext: 'basic' }
    expect(await updateInternalTransfer(original.id, { ...original, note: 'Híbrido' }, original.updatedAt)).toMatchObject({ note: 'Híbrido' })
  })
  it('rechaza importes inválidos, fecha inválida, wallets iguales o ajenas', async () => {
    const original = await seed()
    for (const amount of [0, -1, NaN, Infinity, 0.001]) {
      await expect(updateInternalTransfer(original.id, { ...original, amount }, original.updatedAt)).rejects.toThrow('mayor que cero')
    }
    await expect(updateInternalTransfer(original.id, { ...original, date: '2026-02-30' }, original.updatedAt)).rejects.toThrow('fecha válida')
    await expect(updateInternalTransfer(original.id, { ...original, toWalletId: 'wal-1' }, original.updatedAt)).rejects.toThrow('misma')
    await expect(updateInternalTransfer(original.id, { ...original, toWalletId: 'missing' }, original.updatedAt)).rejects.toThrow('destino no es válida')
    await expect(updateInternalTransfer(original.id, { ...original, toWalletId: 'wal-archived' }, original.updatedAt)).rejects.toThrow('destino no es válida')
  })
  it('permite conservar wallets archivadas ya asignadas', async () => {
    const original = await seed()
    wallets[1].isArchived = true
    expect(await updateInternalTransfer(original.id, { ...original, note: 'Nota' }, original.updatedAt)).toMatchObject({ note: 'Nota' })
  })
})


describe('transferir el saldo completo con precisión de céntimos', () => {
  it('acepta 2,63 aunque la resta interna produzca 2,629999999999999', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 20, currency: 'EUR' })
    expenses.push({ walletId: 'wal-1', eurValue: 17.37, currency: 'EUR' })
    const transfer = await createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 2.63, date: '2026-11-02' })
    expect(transfer.amount).toBe(2.63)
    expect(transfers).toHaveLength(1)
  })
  it('rechaza un céntimo de más sin persistir la transferencia', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 20, currency: 'EUR' })
    expenses.push({ walletId: 'wal-1', eurValue: 17.37, currency: 'EUR' })
    await expect(createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 2.64, date: '2026-11-02' })).rejects.toThrow('saldo negativo')
    expect(transfers).toHaveLength(0)
  })
  it('rechaza importes que redondean a cero y guarda importes a dos decimales', async () => {
    incomes.push({ walletId: 'wal-1', eurValue: 20, currency: 'EUR' })
    await expect(createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 0.001, date: '2026-11-02' })).rejects.toThrow('mayor que cero')
    const transfer = await createInternalTransfer({ fromWalletId: 'wal-1', toWalletId: 'wal-2', amount: 2.629999999999999, date: '2026-11-02' })
    expect(transfer.amount).toBe(2.63)
  })
})
