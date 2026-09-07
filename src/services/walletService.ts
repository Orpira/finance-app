import { db } from '../database/db'
import type { Wallet } from '../types/wallet'
import type { CurrencyCode } from '../types/settings'
import {
  buildNormalizedWalletName,
  INVALID_WALLET_NAME_MESSAGE,
  MAX_WALLET_NAME_LENGTH,
  normalizeWalletName,
} from '../utils/walletName'
import { getStoredExpenseValue, getStoredIncomeValue } from '../utils/financeStats'

export {
  buildNormalizedWalletName,
  INVALID_WALLET_NAME_MESSAGE,
  MAX_WALLET_NAME_LENGTH,
  normalizeWalletName,
}

/** Mirrors the `finance-app:settings-changed` pattern so open selectors/lists
 * can refresh without a full reload after any mutation. */
export const WALLETS_CHANGED_EVENT = 'finance-app:wallets-changed'

function notifyWalletsChanged() {
  window.dispatchEvent(new CustomEvent(WALLETS_CHANGED_EVENT))
}

export function getWalletName(
  record: { walletId?: string },
  wallets: readonly Wallet[],
): string | undefined {
  if (!record.walletId) return undefined
  const wallet = wallets.find((item) => item.id === record.walletId)
  if (!wallet) return 'Wallet no disponible'
  return wallet.name
}

export type WalletListOptions = {
  archived?: 'active' | 'archived' | 'all'
}

export async function getWalletById(id: string) {
  return db.wallets.get(id)
}

export async function listWallets(options: WalletListOptions = {}): Promise<Wallet[]> {
  const { archived = 'active' } = options
  const wallets = await db.wallets.orderBy('name').toArray()

  if (archived === 'all') {
    return wallets
  }

  return wallets.filter((wallet) => {
    if (archived === 'active') return !wallet.isArchived
    return wallet.isArchived
  })
}

export async function getDefaultWallet(): Promise<Wallet | undefined> {
  const wallets = await db.wallets.toArray()
  return wallets.find((wallet) => wallet.isDefault && !wallet.isArchived)
}

export async function createWallet(input: { name: string; isDefault?: boolean }) {
  const name = normalizeWalletName(input.name)
  const normalizedName = buildNormalizedWalletName(name)
  const now = new Date().toISOString()

  const wallet = await db.transaction('rw', [db.wallets], async () => {
    const wallets = await db.wallets.toArray()
    const exists = wallets.some((existingWallet) => existingWallet.normalizedName === normalizedName)

    if (exists) {
      throw new Error('Ya existe una wallet con ese nombre.')
    }

    // The very first wallet becomes the default automatically, so the
    // "no wallet management required" onboarding path still has a sensible target.
    const shouldBeDefault = input.isDefault ?? wallets.length === 0

    if (shouldBeDefault) {
      await Promise.all(
        wallets
          .filter((existingWallet) => existingWallet.isDefault)
          .map((existingWallet) => db.wallets.put({ ...existingWallet, isDefault: false, updatedAt: now })),
      )
    }

    const newWallet: Wallet = {
      id: `wal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      normalizedName,
      usageMode: 'basic',
      isDefault: shouldBeDefault,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }

    await db.wallets.put(newWallet)
    return newWallet
  })
  notifyWalletsChanged()
  return wallet
}

export async function renameWallet(id: string, newName: string) {
  const name = normalizeWalletName(newName)
  const normalizedName = buildNormalizedWalletName(name)

  const updated = await db.transaction('rw', [db.wallets], async () => {
    const wallet = await db.wallets.get(id)
    if (!wallet) {
      throw new Error('La wallet no existe.')
    }

    const wallets = await db.wallets.toArray()
    const duplicate = wallets.some(
      (item) => item.id !== id && item.normalizedName === normalizedName,
    )

    if (duplicate) {
      throw new Error('Ya existe una wallet con ese nombre.')
    }

    const nextWallet: Wallet = {
      ...wallet,
      name,
      normalizedName,
      updatedAt: new Date().toISOString(),
    }

    await db.wallets.put(nextWallet)
    return nextWallet
  })
  notifyWalletsChanged()
  return updated
}

export async function setDefaultWallet(id: string) {
  const updated = await db.transaction('rw', [db.wallets], async () => {
    const wallet = await db.wallets.get(id)
    if (!wallet) throw new Error('La wallet no existe.')
    if (wallet.isArchived) throw new Error('No puedes marcar como predeterminada una wallet archivada.')

    const now = new Date().toISOString()
    const wallets = await db.wallets.toArray()
    await Promise.all(
      wallets
        .filter((existingWallet) => existingWallet.id !== id && existingWallet.isDefault)
        .map((existingWallet) => db.wallets.put({ ...existingWallet, isDefault: false, updatedAt: now })),
    )

    const nextWallet: Wallet = { ...wallet, isDefault: true, updatedAt: now }
    await db.wallets.put(nextWallet)
    return nextWallet
  })
  notifyWalletsChanged()
  return updated
}

export async function archiveWallet(id: string) {
  const updated = await db.transaction('rw', [db.wallets], async () => {
    const wallet = await db.wallets.get(id)
    if (!wallet) throw new Error('La wallet no existe.')

    const nextWallet: Wallet = {
      ...wallet,
      isDefault: false,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    }

    await db.wallets.put(nextWallet)
    return nextWallet
  })
  notifyWalletsChanged()
  return updated
}

export async function reactivateWallet(id: string) {
  const updated = await db.transaction('rw', [db.wallets], async () => {
    const wallet = await db.wallets.get(id)
    if (!wallet) throw new Error('La wallet no existe.')

    const nextWallet: Wallet = {
      ...wallet,
      isArchived: false,
      updatedAt: new Date().toISOString(),
    }

    await db.wallets.put(nextWallet)
    return nextWallet
  })
  notifyWalletsChanged()
  return updated
}

export async function countReferencesForWallet(walletId: string) {
  const [incomeCount, expenseCount, transferCount] = await Promise.all([
    db.services.where('walletId').equals(walletId).count(),
    db.expenses.where('walletId').equals(walletId).count(),
    db.internalTransfers.where('fromWalletId').equals(walletId).count(),
  ])
  const transferAsDestinationCount = await db.internalTransfers
    .where('toWalletId')
    .equals(walletId)
    .count()

  return incomeCount + expenseCount + transferCount + transferAsDestinationCount
}

export async function deleteWallet(id: string) {
  const result = await db.transaction(
    'rw',
    [db.wallets, db.services, db.expenses, db.internalTransfers],
    async () => {
      const wallet = await db.wallets.get(id)
      if (!wallet) {
        throw new Error('La wallet no existe.')
      }

      const count = await countReferencesForWallet(id)
      if (count > 0) {
        throw new Error(
          'Esta wallet tiene movimientos asociados y no puede eliminarse. Puedes archivarla.',
        )
      }

      await db.wallets.delete(id)
      return true
    },
  )
  notifyWalletsChanged()
  return result
}

/**
 * Derives a Wallet's balance purely from the financial ledger — never a cached
 * counter that could drift. Sums stored income/expense values (already amount-
 * signed for `ajuste` records, same convention as buildBalanceReport) plus
 * transfers in/out, all converted to `currency` the same way Home/Reports do.
 */
export async function getWalletBalance(walletId: string, currency: CurrencyCode): Promise<number> {
  const [incomes, expenses, transfersOut, transfersIn] = await Promise.all([
    db.services.where('walletId').equals(walletId).toArray(),
    db.expenses.where('walletId').equals(walletId).toArray(),
    db.internalTransfers.where('fromWalletId').equals(walletId).toArray(),
    db.internalTransfers.where('toWalletId').equals(walletId).toArray(),
  ])

  const incomeTotal = incomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, currency),
    0,
  )
  const expenseTotal = expenses.reduce(
    (total, expense) => total + getStoredExpenseValue(expense, currency),
    0,
  )
  const transfersOutTotal = transfersOut.reduce((total, transfer) => total + transfer.amount, 0)
  const transfersInTotal = transfersIn.reduce((total, transfer) => total + transfer.amount, 0)

  return incomeTotal - expenseTotal + transfersInTotal - transfersOutTotal
}

export interface WalletWithBalance extends Wallet {
  balance: number
}

export async function listWalletsWithBalances(
  currency: CurrencyCode,
  options: WalletListOptions = {},
): Promise<WalletWithBalance[]> {
  const wallets = await listWallets(options)
  const balances = await Promise.all(
    wallets.map((wallet) => getWalletBalance(wallet.id, currency)),
  )
  return wallets.map((wallet, index) => ({ ...wallet, balance: balances[index] }))
}
