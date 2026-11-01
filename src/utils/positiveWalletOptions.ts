import type { WalletWithBalance } from '../services/walletService'

/** Selectable wallets for Personal income/expense registration. */
export function positiveWalletOptions(wallets: readonly WalletWithBalance[]) {
  return wallets.filter((wallet) => !wallet.isArchived && Number.isFinite(wallet.balance) && wallet.balance > 0)
}
