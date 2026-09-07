import { ArrowLeftRight, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  INTERNAL_TRANSFERS_CHANGED_EVENT,
  listInternalTransfers,
} from '../../services/internalTransferService'
import { listWallets, WALLETS_CHANGED_EVENT } from '../../services/walletService'
import type { InternalTransfer } from '../../types/internalTransfer'
import type { Wallet } from '../../types/wallet'

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

export function WalletActivityCard() {
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
      <p className="mt-1 flex min-h-8 items-center gap-1 truncate text-xs text-slate-400 dark:text-slate-500">
        {latestTransfer ? (
          <>
            <span className="truncate">{getWalletName(wallets, latestTransfer.fromWalletId)}</span>
            <ArrowRight className="size-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{getWalletName(wallets, latestTransfer.toWalletId)}</span>
          </>
        ) : 'Sin movimientos entre ubicaciones'}
      </p>
    </article>
  )
}

export default WalletActivityCard
