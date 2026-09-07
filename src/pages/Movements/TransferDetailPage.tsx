import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { useDialog } from '../../components/dialogs/useDialog'
import { deleteInternalTransfer, getInternalTransferById } from '../../services/internalTransferService'
import { getWalletById } from '../../services/walletService'
import { getSettings } from '../../services/settingsService'
import type { InternalTransfer } from '../../types/internalTransfer'
import type { Wallet } from '../../types/wallet'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'

export function TransferDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { alert, confirm } = useDialog()
  const [transfer, setTransfer] = useState<InternalTransfer | null>(null)
  const [fromWallet, setFromWallet] = useState<Wallet | null>(null)
  const [toWallet, setToWallet] = useState<Wallet | null>(null)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!id) return
      setIsLoading(true)
      try {
        const [record, settings] = await Promise.all([getInternalTransferById(id), getSettings()])
        if (cancelled) return
        setTransfer(record ?? null)
        setCurrency(settings.defaultCurrency)
        if (record) {
          const [origin, destination] = await Promise.all([
            getWalletById(record.fromWalletId),
            getWalletById(record.toWalletId),
          ])
          if (cancelled) return
          setFromWallet(origin ?? null)
          setToWallet(destination ?? null)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [id])

  async function handleDelete() {
    if (!transfer) return
    const confirmed = await confirm({
      title: 'Eliminar transferencia',
      message: 'Esta acción no se puede deshacer. El saldo de ambas wallets se recalculará.',
      confirmLabel: 'Eliminar',
      confirmTone: 'danger',
    })
    if (!confirmed) return

    setIsDeleting(true)
    try {
      await deleteInternalTransfer(transfer.id)
      navigate('/movements')
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo eliminar',
        message: error instanceof Error ? error.message : 'No se pudo eliminar la transferencia.',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <PageHeader backLabel="Movimientos" backTo="/movements" eyebrow="Personal" title="Transferencia" />

      {isLoading ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : !transfer ? (
        <p className="text-sm text-slate-500">Esta transferencia ya no existe.</p>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Importe</span>
            <span className="text-lg font-semibold text-slate-950">
              {formatCurrency(transfer.amount, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Origen</span>
            <span className="font-medium text-slate-900 dark:text-white">{fromWallet?.name ?? 'Wallet no disponible'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Destino</span>
            <span className="font-medium text-slate-900 dark:text-white">{toWallet?.name ?? 'Wallet no disponible'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Fecha</span>
            <span className="font-medium text-slate-900 dark:text-white">
              {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${transfer.date}T00:00`))}
            </span>
          </div>
          {transfer.note ? (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-slate-500">Nota</span>
              <span className="text-slate-900 dark:text-white">{transfer.note}</span>
            </div>
          ) : null}

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isDeleting}
            onClick={handleDelete}
            type="button"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {isDeleting ? 'Eliminando...' : 'Eliminar transferencia'}
          </button>
        </div>
      )}
    </section>
  )
}

export default TransferDetailPage
