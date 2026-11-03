import { db } from '../database/db'
import type { ServiceIncome } from '../types/service'
import type { Expense } from '../types/expense'
import type { InternalTransfer } from '../types/internalTransfer'
import type { CurrencyCode } from '../types/settings'
import { formatCurrency, roundMoney } from '../utils/currency'
import { getStoredExpenseValue, getStoredIncomeValue } from '../utils/financeStats'

export type WalletLedgerMutation =
  | { kind: 'income'; before?: ServiceIncome; after?: ServiceIncome }
  | { kind: 'expense'; before?: Expense; after?: Expense }
  | { kind: 'transfer'; before?: InternalTransfer; after?: InternalTransfer }

/** Validate a proposed replacement, including removal of the original effect.
 * Call inside the SAME rw transaction as the mutation, locking wallets,
 * services, expenses and internalTransfers. Never rewrites existing records.
 */
export async function assertWalletMutationAllowed(
  mutation: WalletLedgerMutation,
  currency: CurrencyCode,
): Promise<void> {
  const deltas = new Map<string, number>()
  function add(walletId: string | undefined, amount: number) {
    if (!walletId) return
    if (!Number.isFinite(amount)) {
      throw new Error('No se puede validar el saldo de la wallet: el importe no es válido.')
    }
    deltas.set(walletId, (deltas.get(walletId) ?? 0) + amount)
  }
  if (mutation.kind === 'income') {
    if (mutation.before) add(mutation.before.walletId, -getStoredIncomeValue(mutation.before, currency))
    if (mutation.after) add(mutation.after.walletId, getStoredIncomeValue(mutation.after, currency))
  } else if (mutation.kind === 'expense') {
    if (mutation.before) add(mutation.before.walletId, getStoredExpenseValue(mutation.before, currency))
    if (mutation.after) add(mutation.after.walletId, -getStoredExpenseValue(mutation.after, currency))
  } else {
    if (mutation.before) {
      add(mutation.before.fromWalletId, mutation.before.amount)
      add(mutation.before.toWalletId, -mutation.before.amount)
    }
    if (mutation.after) {
      add(mutation.after.fromWalletId, -mutation.after.amount)
      add(mutation.after.toWalletId, mutation.after.amount)
    }
  }
  // Credits and metadata-only edits cannot create or worsen a deficit.
  const debited = [...deltas].filter(([, amount]) => amount < 0)
  if (debited.length === 0) return
  const [incomes, expenses, transfers] = await Promise.all([
    db.services.toArray(), db.expenses.toArray(), db.internalTransfers.toArray(),
  ])
  const problems: string[] = []
  for (const [walletId, delta] of debited) {
    const wallet = await db.wallets.get(walletId)
    if (!wallet || wallet.usageMode !== 'basic') {
      throw new Error('No se puede validar el saldo: la wallet afectada no existe o no pertenece a Personal.')
    }
    if (transfers.some((item) => (item.fromWalletId === walletId || item.toWalletId === walletId) && item.currency !== currency)) {
      throw new Error(`No se puede validar el saldo de «${wallet.name}»: hay transferencias en otra moneda sin conversión histórica. Revisa la moneda y los movimientos relacionados.`)
    }
    const incomeTotal = incomes.filter((item) => item.walletId === walletId)
      .reduce((sum, item) => sum + getStoredIncomeValue(item, currency), 0)
    const expenseTotal = expenses.filter((item) => item.walletId === walletId)
      .reduce((sum, item) => sum + getStoredExpenseValue(item, currency), 0)
    const transferred = transfers.filter((item) => item.currency === currency)
      .reduce((sum, item) => sum + (item.toWalletId === walletId ? item.amount : 0)
        - (item.fromWalletId === walletId ? item.amount : 0), 0)
    const rawBalance = incomeTotal - expenseTotal + transferred
    const before = roundMoney(rawBalance)
    const after = roundMoney(rawBalance + delta)
    if (!Number.isFinite(before) || !Number.isFinite(after)) {
      throw new Error(`No se puede validar el saldo de «${wallet.name}»: hay importes no válidos.`)
    }
    // A legacy deficit can be preserved or improved, never increased.
    if (after < Math.min(0, before)) {
      problems.push(`«${wallet.name}»: saldo actual ${formatCurrency(before, currency)}; saldo resultante ${formatCurrency(after, currency)}; faltan ${formatCurrency(-after, currency)} para quedar en cero.`)
    }
  }
  if (problems.length > 0) {
    throw new Error(`No se puede realizar el movimiento: dejaría saldo negativo o aumentaría el déficit. ${problems.join(' ')} Transfiere fondos a la wallet o revisa el importe y las wallets de los movimientos relacionados. El movimiento no se ha guardado.`)
  }
}
