export type WalletUsageMode = 'basic'

/** A balance container ("Cuenta principal", "Efectivo en casa") — never an income/expense category. */
export interface Wallet {
  id: string
  name: string
  normalizedName: string
  usageMode: WalletUsageMode
  isDefault: boolean
  isArchived: boolean
  createdAt: string
  updatedAt: string
}
