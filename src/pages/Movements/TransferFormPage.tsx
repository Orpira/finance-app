import { ArrowRight, ArrowLeftRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { useDialog } from '../../components/dialogs/useDialog'
import { createInternalTransfer, getInternalTransferById, updateInternalTransfer, INTERNAL_TRANSFERS_CHANGED_EVENT } from '../../services/internalTransferService'
import { getSettings } from '../../services/settingsService'
import { listWalletsWithBalances, WALLETS_CHANGED_EVENT } from '../../services/walletService'
import type { WalletWithBalance } from '../../services/walletService'
import type { InternalTransfer } from '../../types/internalTransfer'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency, getLocalDateKey, roundMoney } from '../../utils/currency'

export function TransferFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const [editingTransfer, setEditingTransfer] = useState<InternalTransfer | null>(null)
  const [loadError, setLoadError] = useState('')
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

  useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const [settings, record] = await Promise.all([
          getSettings(), id ? getInternalTransferById(id) : Promise.resolve(undefined),
        ])
        if (id && !record) throw new Error('Esta transferencia ya no existe.')
        const recordCurrency = (record?.currency ?? settings.defaultCurrency) as CurrencyCode
        const allWallets = await listWalletsWithBalances(recordCurrency, { archived: record ? 'all' : 'active' })
        if (cancelled) return
        setCurrency(recordCurrency)
        setWallets(allWallets.filter((wallet) => !wallet.isArchived || wallet.id === record?.fromWalletId || wallet.id === record?.toWalletId))
        setEditingTransfer(record ?? null)
        if (record) {
          setFromWalletId(record.fromWalletId)
          setToWalletId(record.toWalletId)
          setAmount(String(record.amount))
          setDate(record.date)
          setNote(record.note ?? '')
        }
        setLoadError('')
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la transferencia.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    async function refreshWalletBalances() {
      try {
        const nextWallets = await listWalletsWithBalances(currency, { archived: editingTransfer ? 'all' : 'active' })
        if (!cancelled) setWallets(nextWallets.filter((wallet) => !wallet.isArchived || wallet.id === editingTransfer?.fromWalletId || wallet.id === editingTransfer?.toWalletId))
      } catch (error) {
        console.warn('No se pudieron actualizar las wallets.', error)
      }
    }
    window.addEventListener(WALLETS_CHANGED_EVENT, refreshWalletBalances)
    window.addEventListener(INTERNAL_TRANSFERS_CHANGED_EVENT, refreshWalletBalances)
    return () => {
      cancelled = true
      window.removeEventListener(WALLETS_CHANGED_EVENT, refreshWalletBalances)
      window.removeEventListener(INTERNAL_TRANSFERS_CHANGED_EVENT, refreshWalletBalances)
    }
  }, [currency, editingTransfer])

  const sourceWallet = wallets.find((wallet) => wallet.id === fromWalletId)
  // When editing, restore the original transfer's effect before proposing its replacement.
  const availableBalance = roundMoney((sourceWallet?.balance ?? 0)
    + (editingTransfer?.fromWalletId === fromWalletId ? editingTransfer.amount : 0)
    - (editingTransfer?.toWalletId === fromWalletId ? editingTransfer.amount : 0))
  const parsedAmount = Number(amount.replace(',', '.'))
  const canSubmit =
    fromWalletId !== '' &&
    toWalletId !== '' &&
    fromWalletId !== toWalletId &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    date !== '' &&
    !isSubmitting && !isLoading && !loadError && (!isEditing || editingTransfer !== null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)
    try {
      const input = {
        fromWalletId,
        toWalletId,
        amount: parsedAmount,
        date,
        note: note.trim() || undefined,
      }
      if (id && editingTransfer) {
        await updateInternalTransfer(id, input, editingTransfer.updatedAt)
        navigate(`/transfers/${id}`)
      } else {
        await createInternalTransfer(input)
        navigate('/movements?tab=transferencias')
      }
    } catch (error) {
      await alert({
        type: 'error',
        title: isEditing ? 'No se pudo modificar' : 'No se pudo transferir',
        message: error instanceof Error ? error.message : 'No se pudo registrar la transferencia.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading || loadError) {
    return <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader backLabel="Movimientos" backTo="/movements?tab=transferencias" eyebrow="Personal" title={isEditing ? 'Modificar transferencia' : 'Transferir dinero'} />
      <p role={loadError ? 'alert' : 'status'}>{loadError || 'Cargando…'}</p>
    </section>
  }

  if (wallets.length < 2) {
    return (
      <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <PageHeader backLabel="Movimientos" backTo="/movements" eyebrow="Personal" title={isEditing ? 'Modificar transferencia' : 'Transferir dinero'} />
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
      <PageHeader backLabel="Movimientos" backTo="/movements" eyebrow="Personal" title={isEditing ? 'Modificar transferencia' : 'Transferir dinero'} />

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
              <option key={wallet.id} value={wallet.id} disabled={wallet.isArchived && wallet.id !== editingTransfer?.fromWalletId}>
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
                <option key={wallet.id} value={wallet.id} disabled={wallet.isArchived && wallet.id !== editingTransfer?.toWalletId}>
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
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-emerald-700 px-3 text-sm font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!sourceWallet || availableBalance <= 0 || isSubmitting}
            onClick={() => setAmount(availableBalance.toFixed(2))}
            type="button"
          >
            Trasladar todo
          </button>
          {sourceWallet && <p className="text-sm text-slate-500">Disponible para trasladar: {formatCurrency(availableBalance, currency)}</p>}
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
          {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Transferir'}
        </button>
        <p className="text-center text-xs text-slate-500">
          Esto no cuenta como ingreso ni egreso: es un movimiento interno entre tus propias wallets.
        </p>
      </form>
    </section>
  )
}

export default TransferFormPage
