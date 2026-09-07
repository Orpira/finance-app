import { ArrowRight, ArrowLeftRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { useDialog } from '../../components/dialogs/useDialog'
import { createInternalTransfer } from '../../services/internalTransferService'
import { getSettings } from '../../services/settingsService'
import { listWalletsWithBalances, WALLETS_CHANGED_EVENT } from '../../services/walletService'
import type { WalletWithBalance } from '../../services/walletService'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency, getLocalDateKey } from '../../utils/currency'

export function TransferFormPage() {
  const navigate = useNavigate()
  const { alert } = useDialog()
  const [wallets, setWallets] = useState<WalletWithBalance[]>([])
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [fromWalletId, setFromWalletId] = useState('')
  const [toWalletId, setToWalletId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => getLocalDateKey(new Date()))
  const [note, setNote] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function loadWallets() {
    setIsLoading(true)
    try {
      const settings = await getSettings()
      setCurrency(settings.defaultCurrency)
      const activeWallets = await listWalletsWithBalances(settings.defaultCurrency, { archived: 'active' })
      setWallets(activeWallets)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function initialLoad() {
      await loadWallets()
    }
    void initialLoad()
    function handleExternalChange() {
      void loadWallets()
    }
    window.addEventListener(WALLETS_CHANGED_EVENT, handleExternalChange)
    return () => window.removeEventListener(WALLETS_CHANGED_EVENT, handleExternalChange)
  }, [])

  const parsedAmount = Number(amount.replace(',', '.'))
  const canSubmit =
    fromWalletId !== '' &&
    toWalletId !== '' &&
    fromWalletId !== toWalletId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    date !== '' &&
    !isSubmitting

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    try {
      await createInternalTransfer({
        fromWalletId,
        toWalletId,
        amount: parsedAmount,
        date,
        note: note.trim() || undefined,
      })
      navigate('/movements')
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo transferir',
        message: error instanceof Error ? error.message : 'No se pudo registrar la transferencia.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isLoading && wallets.length < 2) {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <PageHeader backLabel="Movimientos" backTo="/movements" eyebrow="Personal" title="Transferir dinero" />
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <ArrowLeftRight className="mx-auto size-8 text-slate-400" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-600">
            Necesitas al menos dos wallets activas para transferir dinero entre ellas.
          </p>
          <button
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={() => navigate('/settings/wallets')}
            type="button"
          >
            Gestionar wallets
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader backLabel="Movimientos" backTo="/movements" eyebrow="Personal" title="Transferir dinero" />

      <form className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="transfer-from-wallet">
            Origen
          </label>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="transfer-from-wallet"
            onChange={(event) => setFromWalletId(event.target.value)}
            value={fromWalletId}
          >
            <option value="">Selecciona una wallet</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name} · {formatCurrency(wallet.balance, currency)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center text-slate-400">
          <ArrowRight className="size-5" aria-hidden="true" />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="transfer-to-wallet">
            Destino
          </label>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="transfer-to-wallet"
            onChange={(event) => setToWalletId(event.target.value)}
            value={toWalletId}
          >
            <option value="">Selecciona una wallet</option>
            {wallets
              .filter((wallet) => wallet.id !== fromWalletId)
              .map((wallet) => (
                <option key={wallet.id} value={wallet.id}>
                  {wallet.name} · {formatCurrency(wallet.balance, currency)}
                </option>
              ))}
          </select>
        </div>

        {fromWalletId && toWalletId && fromWalletId === toWalletId ? (
          <p className="text-sm text-rose-600">La wallet de origen y destino no pueden ser la misma.</p>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="transfer-amount">
            Importe
          </label>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="transfer-amount"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0,00"
            value={amount}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="transfer-date">
            Fecha
          </label>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="transfer-date"
            onChange={(event) => setDate(event.target.value)}
            type="date"
            value={date}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700" htmlFor="transfer-note">
            Nota (opcional)
          </label>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="transfer-note"
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej. Retiro para gastos de casa"
            value={note}
          />
        </div>

        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canSubmit}
          type="submit"
        >
          {isSubmitting ? 'Transfiriendo...' : 'Transferir'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Esto no cuenta como ingreso ni egreso: es un movimiento interno entre tus propias wallets.
        </p>
      </form>
    </section>
  )
}

export default TransferFormPage
