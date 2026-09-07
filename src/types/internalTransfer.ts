export type InternalTransferUsageMode = 'basic'

/**
 * A movement of money between two Wallets. Never an income or expense: it must
 * never be summed into incomeGrossTotal/expenseTotal, goals or reports.
 */
export interface InternalTransfer {
  id: string
  fromWalletId: string
  toWalletId: string
  amount: number
  currency: string
  date: string
  note?: string
  usageMode: InternalTransferUsageMode
  createdAt: string
  updatedAt: string
}
