import { db } from '../database/db'
import type { InternalTransfer } from '../types/internalTransfer'
import { getSettings } from './settingsService'
import { resolveActiveUsageMode } from '../utils/usageMode'

/** Mirrors WALLETS_CHANGED_EVENT: open balances/movements refresh without a full reload. */
export const INTERNAL_TRANSFERS_CHANGED_EVENT = 'finance-app:internal-transfers-changed'

function notifyInternalTransfersChanged() {
  window.dispatchEvent(new CustomEvent(INTERNAL_TRANSFERS_CHANGED_EVENT))
}

export type CreateInternalTransferInput = {
  fromWalletId: string
  toWalletId: string
  amount: number
  date: string
  note?: string
}

export type InternalTransferListOptions = {
  walletId?: string
}

/**
 * TRANSFERENCIA INTERNA (spec §3/§20): moving money between Wallets must never
 * create an income or expense record. This never touches db.services/db.expenses.
 */
export async function createInternalTransfer(input: CreateInternalTransferInput) {
  const settings = await getSettings()
  const activeUsageMode = resolveActiveUsageMode(settings)
  if (activeUsageMode !== 'basic') {
    throw new Error('Las transferencias entre wallets solo están disponibles en el modo Personal.')
  }

  if (input.fromWalletId === input.toWalletId) {
    throw new Error('La wallet de origen y destino no pueden ser la misma.')
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error('El importe de la transferencia debe ser mayor que cero.')
  }
  if (!input.date) {
    throw new Error('Debes indicar la fecha de la transferencia.')
  }

  const now = new Date().toISOString()
  const transfer = await db.transaction('rw', [db.wallets, db.internalTransfers], async () => {
    const [fromWallet, toWallet] = await Promise.all([
      db.wallets.get(input.fromWalletId),
      db.wallets.get(input.toWalletId),
    ])
    if (!fromWallet || fromWallet.usageMode !== 'basic' || fromWallet.isArchived) {
      throw new Error('La wallet de origen no es válida.')
    }
    if (!toWallet || toWallet.usageMode !== 'basic' || toWallet.isArchived) {
      throw new Error('La wallet de destino no es válida.')
    }

    const newTransfer: InternalTransfer = {
      id: `itx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fromWalletId: input.fromWalletId,
      toWalletId: input.toWalletId,
      amount: input.amount,
      currency: settings.defaultCurrency,
      date: input.date,
      note: input.note?.trim() || undefined,
      usageMode: 'basic',
      createdAt: now,
      updatedAt: now,
    }

    await db.internalTransfers.put(newTransfer)
    return newTransfer
  })
  notifyInternalTransfersChanged()
  return transfer
}

export async function getInternalTransferById(id: string) {
  return db.internalTransfers.get(id)
}

export async function listInternalTransfers(
  options: InternalTransferListOptions = {},
): Promise<InternalTransfer[]> {
  const transfers = (await db.internalTransfers.orderBy('date').reverse().toArray())
    .filter((transfer) => transfer.usageMode === 'basic')
  if (!options.walletId) return transfers
  return transfers.filter(
    (transfer) => transfer.fromWalletId === options.walletId || transfer.toWalletId === options.walletId,
  )
}

export async function deleteInternalTransfer(id: string) {
  const result = await db.transaction('rw', [db.internalTransfers], async () => {
    const transfer = await db.internalTransfers.get(id)
    if (!transfer) throw new Error('La transferencia no existe.')
    await db.internalTransfers.delete(id)
    return true
  })
  notifyInternalTransfersChanged()
  return result
}
