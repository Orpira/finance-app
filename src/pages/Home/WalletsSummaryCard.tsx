import { Wallet as WalletIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { SensitiveAmount } from '../../components/SensitiveAmount'
import {
  listWalletsWithBalances,
  WALLETS_CHANGED_EVENT,
  type WalletWithBalance,
} from '../../services/walletService'
import { INTERNAL_TRANSFERS_CHANGED_EVENT } from '../../services/internalTransferService'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'

interface WalletsSummaryCardProps {
  readonly currency: CurrencyCode
  readonly hidden: boolean
}

/**
 * Compact "Mi dinero" section (spec §11): where the money is, not a full
 * banking dashboard. Self-contained — reloads on mount (Home remounts on
 * navigation, same as the rest of Home's sections) and on wallet/transfer changes.
 */
export function WalletsSummaryCard({ currency, hidden }: WalletsSummaryCardProps) {
  const [wallets, setWallets] = useState<WalletWithBalance[] | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const activeWallets = await listWalletsWithBalances(currency, { archived: 'active' })
        if (!cancelled) setWallets(activeWallets)
      } catch (error) {
        console.warn('No se pudieron cargar las wallets.', error)
        if (!cancelled) setWallets([])
      }
    }

    void load()
    window.addEventListener(WALLETS_CHANGED_EVENT, load)
    window.addEventListener(INTERNAL_TRANSFERS_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(WALLETS_CHANGED_EVENT, load)
      window.removeEventListener(INTERNAL_TRANSFERS_CHANGED_EVENT, load)
    }
  }, [currency])

  if (!wallets || wallets.length === 0) return null

  const total = wallets.reduce((sum, wallet) => sum + wallet.balance, 0)

  return (
    <section aria-labelledby="my-money-title" className="order-3">
      <div className="flex items-center justify-between">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200" id="my-money-title">
          Mi dinero
        </h2>
        <Link className="mb-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/settings/wallets">
          Gestionar
        </Link>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <WalletIcon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
            <SensitiveAmount hidden={hidden} value={formatCurrency(total, currency)} />
          </p>
        </div>
        <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Disponible total</p>

        <ul className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          {wallets.map((wallet) => (
            <li className="flex items-center justify-between gap-3 text-sm" key={wallet.id}>
              <span className="truncate text-slate-700 dark:text-slate-200">
                {wallet.name}
                {wallet.isDefault ? <span className="ml-1.5 text-xs text-slate-400">· Predeterminada</span> : null}
              </span>
              <span className={`shrink-0 font-semibold ${wallet.balance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                <SensitiveAmount hidden={hidden} value={formatCurrency(wallet.balance, currency)} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default WalletsSummaryCard
