import { ArrowLeftRight, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { SensitiveAmount } from '../../components/SensitiveAmount'
import {
  INTERNAL_TRANSFERS_CHANGED_EVENT,
  listInternalTransfers,
} from '../../services/internalTransferService'
import { listWallets, WALLETS_CHANGED_EVENT } from '../../services/walletService'
import type { CurrencyCode } from '../../types/settings'
import type { InternalTransfer } from '../../types/internalTransfer'
import type { Wallet } from '../../types/wallet'
import { formatCurrency } from '../../utils/currency'

interface WalletActivityCardProps {
  readonly currency: CurrencyCode
  readonly hidden: boolean
}

function getCurrentMonthRange() {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    from: from.toLocaleDateString('en-CA'),
    to: to.toLocaleDateString('en-CA'),
  }
}

function getWalletName(wallets: readonly Wallet[], id: string) {
  return wallets.find((wallet) => wallet.id === id)?.name ?? 'Wallet no disponible'
}

export function WalletActivityCard({ currency, hidden }: WalletActivityCardProps) {
  const [transfers, setTransfers] = useState<InternalTransfer[]>([])
  const [wallets, setWallets] = useState<Wallet[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      const range = getCurrentMonthRange()
      const [allTransfers, allWallets] = await Promise.all([
        listInternalTransfers(),
        listWallets({ archived: 'all' }),
      ])
      if (cancelled) return
      setTransfers(allTransfers.filter((transfer) => transfer.date >= range.from && transfer.date <= range.to))
      setWallets(allWallets)
    }

    void load()
    window.addEventListener(INTERNAL_TRANSFERS_CHANGED_EVENT, load)
    window.addEventListener(WALLETS_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(INTERNAL_TRANSFERS_CHANGED_EVENT, load)
      window.removeEventListener(WALLETS_CHANGED_EVENT, load)
    }
  }, [])

  const totalMoved = transfers.reduce((sum, transfer) => sum + transfer.amount, 0)
  const latestTransfer = transfers[0]

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300">
          <ArrowLeftRight className="size-5" aria-hidden="true" />
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Este mes
        </span>
      </div>
      <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">Actividad de wallets</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
        {transfers.length} {transfers.length === 1 ? 'transferencia' : 'transferencias'}
      </p>
      <p className="mt-1 truncate text-xs text-slate-400 dark:text-slate-500">
        {transfers.length === 0 ? 'Sin movimientos entre ubicaciones' : 'Dinero movido entre ubicaciones'}
      </p>
      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <p className="text-xs text-slate-500 dark:text-slate-400">Total transferido</p>
        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
          <SensitiveAmount hidden={hidden} value={formatCurrency(totalMoved, currency)} />
        </p>
        {latestTransfer ? (
          <p className="mt-2 flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400" title={`${getWalletName(wallets, latestTransfer.fromWalletId)} a ${getWalletName(wallets, latestTransfer.toWalletId)}`}>
            <span className="truncate">{getWalletName(wallets, latestTransfer.fromWalletId)}</span>
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{getWalletName(wallets, latestTransfer.toWalletId)}</span>
          </p>
        ) : null}
      </div>
      <Link className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/movements">
        Ver movimientos
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Link>
    </article>
  )
}

export default WalletActivityCard
