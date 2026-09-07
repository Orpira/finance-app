import { buildNormalizedWalletName } from './walletName'

export type ImportedWallet = {
  id?: unknown
  name?: unknown
  normalizedName?: unknown
  usageMode?: unknown
  isDefault?: unknown
  isArchived?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export type ImportedWalletReference = {
  usageMode?: string
  walletId?: string
}

export type ImportedInternalTransfer = {
  id?: unknown
  fromWalletId?: unknown
  toWalletId?: unknown
  amount?: unknown
  currency?: unknown
  date?: unknown
  note?: unknown
  usageMode?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

/**
 * Fail-closed guard for backup restoration, mirrors assertPersonalIncomeCategoriesAreValid:
 * a corrupt or manipulated wallets payload (or an orphan walletId reference) must never
 * partially import. Must run before the destructive db.transaction clears local data.
 */
export function assertWalletsAreValid(
  wallets: ImportedWallet[],
  incomes: ImportedWalletReference[],
  expenses: ImportedWalletReference[],
) {
  const ids = new Set<string>()
  const normalizedNames = new Set<string>()
  let defaultCount = 0

  wallets.forEach((wallet) => {
    if (typeof wallet.id !== 'string' || !wallet.id) {
      throw new Error('WALLET_INVALID_ID')
    }
    if (typeof wallet.name !== 'string' || !wallet.name.trim()) {
      throw new Error('WALLET_INVALID_NAME')
    }
    if (wallet.usageMode !== 'basic') {
      throw new Error('WALLET_INVALID_USAGE_MODE')
    }
    if (wallet.isArchived !== undefined && typeof wallet.isArchived !== 'boolean') {
      throw new Error('WALLET_INVALID_IS_ARCHIVED')
    }
    if (wallet.isDefault !== undefined && typeof wallet.isDefault !== 'boolean') {
      throw new Error('WALLET_INVALID_IS_DEFAULT')
    }
    if (wallet.createdAt !== undefined && typeof wallet.createdAt !== 'string') {
      throw new Error('WALLET_INVALID_TIMESTAMP')
    }
    if (wallet.updatedAt !== undefined && typeof wallet.updatedAt !== 'string') {
      throw new Error('WALLET_INVALID_TIMESTAMP')
    }

    const canonicalNormalizedName = buildNormalizedWalletName(wallet.name)
    if (
      wallet.normalizedName !== undefined &&
      wallet.normalizedName !== canonicalNormalizedName
    ) {
      throw new Error('WALLET_NORMALIZED_NAME_MISMATCH')
    }

    if (ids.has(wallet.id)) {
      throw new Error('WALLET_DUPLICATE_ID')
    }
    ids.add(wallet.id)

    if (normalizedNames.has(canonicalNormalizedName)) {
      throw new Error('WALLET_DUPLICATE_NAME')
    }
    normalizedNames.add(canonicalNormalizedName)

    if (wallet.isDefault === true) defaultCount += 1
  })

  if (defaultCount > 1) {
    throw new Error('WALLET_MULTIPLE_DEFAULTS')
  }

  const assertReference = (record: ImportedWalletReference) => {
    if (!record.walletId) return
    if (record.usageMode !== 'basic') {
      throw new Error('WALLET_NOT_ALLOWED_FOR_PROFESSIONAL')
    }
    if (!ids.has(record.walletId)) {
      throw new Error('WALLET_ORPHAN_REFERENCE')
    }
  }

  incomes.forEach(assertReference)
  expenses.forEach(assertReference)
}

/**
 * Fail-closed guard for internalTransfers: both wallet references must resolve
 * to a wallet present in the same backup, mirroring assertExpenseAdjustmentIsValid's
 * "never partially restore" contract.
 */
export function assertInternalTransfersAreValid(
  transfers: ImportedInternalTransfer[],
  wallets: ImportedWallet[],
) {
  const walletIds = new Set(
    wallets
      .filter((wallet): wallet is ImportedWallet & { id: string } => typeof wallet.id === 'string')
      .map((wallet) => wallet.id),
  )
  const ids = new Set<string>()

  transfers.forEach((transfer) => {
    if (typeof transfer.id !== 'string' || !transfer.id) {
      throw new Error('INTERNAL_TRANSFER_INVALID_ID')
    }
    if (ids.has(transfer.id)) {
      throw new Error('INTERNAL_TRANSFER_DUPLICATE_ID')
    }
    ids.add(transfer.id)

    if (typeof transfer.fromWalletId !== 'string' || !walletIds.has(transfer.fromWalletId)) {
      throw new Error('INTERNAL_TRANSFER_INVALID_FROM_WALLET')
    }
    if (typeof transfer.toWalletId !== 'string' || !walletIds.has(transfer.toWalletId)) {
      throw new Error('INTERNAL_TRANSFER_INVALID_TO_WALLET')
    }
    if (transfer.fromWalletId === transfer.toWalletId) {
      throw new Error('INTERNAL_TRANSFER_SAME_WALLET')
    }
    if (
      typeof transfer.amount !== 'number' ||
      !Number.isFinite(transfer.amount) ||
      transfer.amount <= 0
    ) {
      throw new Error('INTERNAL_TRANSFER_INVALID_AMOUNT')
    }
    if (typeof transfer.currency !== 'string' || !transfer.currency) {
      throw new Error('INTERNAL_TRANSFER_INVALID_CURRENCY')
    }
    if (typeof transfer.date !== 'string' || !transfer.date) {
      throw new Error('INTERNAL_TRANSFER_INVALID_DATE')
    }
    if (transfer.usageMode !== 'basic') {
      throw new Error('INTERNAL_TRANSFER_INVALID_USAGE_MODE')
    }
    if (transfer.note !== undefined && typeof transfer.note !== 'string') {
      throw new Error('INTERNAL_TRANSFER_INVALID_NOTE')
    }
    if (transfer.createdAt !== undefined && typeof transfer.createdAt !== 'string') {
      throw new Error('INTERNAL_TRANSFER_INVALID_TIMESTAMP')
    }
    if (transfer.updatedAt !== undefined && typeof transfer.updatedAt !== 'string') {
      throw new Error('INTERNAL_TRANSFER_INVALID_TIMESTAMP')
    }
  })
}
