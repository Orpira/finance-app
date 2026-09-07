import { Archive, Check, Pencil, Plus, RotateCcw, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '../../components/dialogs/useDialog'
import { PageHeader } from '../../components/layout/PageHeader'
import { getSettings } from '../../services/settingsService'
import {
  archiveWallet,
  countReferencesForWallet,
  createWallet,
  deleteWallet,
  getWalletBalance,
  listWallets,
  normalizeWalletName,
  reactivateWallet,
  renameWallet,
  setDefaultWallet,
  WALLETS_CHANGED_EVENT,
} from '../../services/walletService'
import type { Wallet } from '../../types/wallet'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'

type WalletFilter = 'active' | 'archived' | 'all'

export function SettingsWalletsPage() {
  const { alert, confirm, prompt } = useDialog()
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [balances, setBalances] = useState<Record<string, number>>({})
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({})
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [filter, setFilter] = useState<WalletFilter>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [newName, setNewName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [busyWalletId, setBusyWalletId] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')

  async function loadWallets(nextFilter: WalletFilter = filter) {
    setIsLoading(true)
    setLoadError('')
    try {
      const settings = await getSettings()
      setCurrency(settings.defaultCurrency)
      const nextWallets = await listWallets({ archived: nextFilter })
      const [counts, walletBalances] = await Promise.all([
        Promise.all(nextWallets.map((wallet) => countReferencesForWallet(wallet.id))),
        Promise.all(nextWallets.map((wallet) => getWalletBalance(wallet.id, settings.defaultCurrency))),
      ])
      setWallets(nextWallets)
      setUsageCounts(Object.fromEntries(nextWallets.map((wallet, index) => [wallet.id, counts[index]])))
      setBalances(Object.fromEntries(nextWallets.map((wallet, index) => [wallet.id, walletBalances[index]])))
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar las wallets.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    async function initialLoad() {
      await loadWallets(filter)
    }
    void initialLoad()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    function handleExternalChange() {
      void loadWallets(filter)
    }
    window.addEventListener(WALLETS_CHANGED_EVENT, handleExternalChange)
    return () => window.removeEventListener(WALLETS_CHANGED_EVENT, handleExternalChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  useEffect(() => {
    if (!statusMessage) return
    const timeoutId = window.setTimeout(() => setStatusMessage(''), 4000)
    return () => window.clearTimeout(timeoutId)
  }, [statusMessage])

  const walletCounts = useMemo(() => ({
    active: wallets.filter((wallet) => !wallet.isArchived).length,
    archived: wallets.filter((wallet) => wallet.isArchived).length,
  }), [wallets])

  async function handleCreateWallet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const cleanName = newName.trim()

    if (!cleanName) {
      await alert({ type: 'warning', title: 'Nombre requerido', message: 'Escribe un nombre para la wallet.' })
      return
    }

    setIsSubmitting(true)
    try {
      const created = await createWallet({ name: cleanName })
      setNewName('')
      await loadWallets(filter)
      setStatusMessage(`Wallet “${created.name}” creada.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo guardar',
        message: error instanceof Error ? error.message : 'La wallet no se pudo crear.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRenameWallet(wallet: Wallet) {
    if (busyWalletId) return
    const nextName = await prompt({
      title: 'Renombrar wallet',
      message: 'Escribe el nuevo nombre para la wallet.',
      initialValue: wallet.name,
      placeholder: 'Ej. Cuenta principal',
      confirmLabel: 'Guardar',
      validate: (value) => {
        try {
          normalizeWalletName(value)
          return undefined
        } catch (error) {
          return error instanceof Error ? error.message : 'Nombre inválido.'
        }
      },
    })

    if (!nextName) return

    setBusyWalletId(wallet.id)
    try {
      await renameWallet(wallet.id, nextName)
      await loadWallets(filter)
      setStatusMessage(`Wallet renombrada a “${nextName.trim()}”.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo renombrar',
        message: error instanceof Error ? error.message : 'No se pudo guardar el cambio.',
      })
    } finally {
      setBusyWalletId(null)
    }
  }

  async function handleSetDefault(wallet: Wallet) {
    if (busyWalletId || wallet.isDefault) return
    setBusyWalletId(wallet.id)
    try {
      await setDefaultWallet(wallet.id)
      await loadWallets(filter)
      setStatusMessage(`Wallet “${wallet.name}” marcada como predeterminada.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo actualizar',
        message: error instanceof Error ? error.message : 'No se pudo cambiar la wallet predeterminada.',
      })
    } finally {
      setBusyWalletId(null)
    }
  }

  async function handleToggleArchive(wallet: Wallet) {
    if (busyWalletId) return
    setBusyWalletId(wallet.id)
    try {
      if (wallet.isArchived) {
        await reactivateWallet(wallet.id)
        setStatusMessage(`Wallet “${wallet.name}” reactivada.`)
      } else {
        await archiveWallet(wallet.id)
        setStatusMessage(`Wallet “${wallet.name}” archivada.`)
      }
      await loadWallets(filter)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo actualizar',
        message: error instanceof Error ? error.message : 'No se pudo cambiar el estado de la wallet.',
      })
    } finally {
      setBusyWalletId(null)
    }
  }

  async function handleDeleteWallet(wallet: Wallet) {
    if (busyWalletId) return
    const usageCount = usageCounts[wallet.id] ?? await countReferencesForWallet(wallet.id)

    if (usageCount > 0) {
      await alert({
        type: 'warning',
        title: 'La wallet está en uso',
        message: 'Esta wallet tiene movimientos asociados. Archívala en su lugar para evitar romper el historial.',
      })
      return
    }

    const confirmed = await confirm({
      title: 'Eliminar wallet',
      message: `¿Eliminar “${wallet.name}”? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      confirmTone: 'danger',
    })

    if (!confirmed) return

    setBusyWalletId(wallet.id)
    try {
      await deleteWallet(wallet.id)
      await loadWallets(filter)
      setStatusMessage(`Wallet “${wallet.name}” eliminada.`)
    } catch (error) {
      await alert({
        type: 'error',
        title: 'No se pudo eliminar',
        message: error instanceof Error ? error.message : 'No se pudo eliminar la wallet.',
      })
      await loadWallets(filter)
    } finally {
      setBusyWalletId(null)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Personal"
        title="Wallets"
      />

      <p aria-live="polite" className="sr-only" role="status">
        {statusMessage}
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-4 text-sm text-slate-500">
          Una wallet representa dónde está tu dinero (cuenta, efectivo, casa...). No es una categoría:
          te permite ver, además de cuánto tienes, dónde está.
        </p>
        <form className="flex flex-col gap-3 sm:flex-row" onSubmit={handleCreateWallet}>
          <label className="sr-only" htmlFor="new-wallet-name">
            Nombre de la nueva wallet
          </label>
          <input
            className="h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            id="new-wallet-name"
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Ej. Cuenta principal, Efectivo, Casa"
            value={newName}
          />
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSubmitting}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {isSubmitting ? 'Guardando...' : 'Nueva wallet'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap gap-2">
          {(['active', 'archived', 'all'] as WalletFilter[]).map((option) => (
            <button
              aria-pressed={filter === option}
              className={[
                'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                filter === option
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              ].join(' ')}
              key={option}
              onClick={() => setFilter(option)}
              type="button"
            >
              {option === 'active' ? 'Activas' : option === 'archived' ? 'Archivadas' : 'Todas'}
              {option === 'active' && walletCounts.active > 0 ? ` (${walletCounts.active})` : ''}
              {option === 'archived' && walletCounts.archived > 0 ? ` (${walletCounts.archived})` : ''}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-500">Cargando wallets…</p>
        ) : loadError ? (
          <div className="flex flex-col gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p>{loadError}</p>
            <button className="self-start font-semibold underline" onClick={() => loadWallets(filter)} type="button">
              Reintentar
            </button>
          </div>
        ) : wallets.length === 0 ? (
          <p className="text-sm text-slate-500">
            {filter === 'archived'
              ? 'No tienes wallets archivadas.'
              : 'Todavía no creaste wallets. Son opcionales: te sirven para saber dónde está tu dinero, por ejemplo “Cuenta principal” o “Efectivo”.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {wallets.map((wallet) => {
              const usageCount = usageCounts[wallet.id] ?? 0
              const balance = balances[wallet.id] ?? 0
              const isRowBusy = busyWalletId === wallet.id
              const isAnyRowBusy = busyWalletId !== null
              return (
                <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between" key={wallet.id}>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-white">
                      {wallet.name}
                      {wallet.isDefault ? (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <Star className="size-3" aria-hidden="true" />
                          Predeterminada
                        </span>
                      ) : null}
                      {wallet.isArchived ? (
                        <span className="ml-2 rounded-full border border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-600">
                          Archivada
                        </span>
                      ) : null}
                    </p>
                    <p className={`text-sm font-semibold ${balance < 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                      {formatCurrency(balance, currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {usageCount === 0
                        ? 'Sin movimientos asociados'
                        : usageCount === 1
                          ? '1 movimiento asociado'
                          : `${usageCount} movimientos asociados`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!wallet.isDefault && !wallet.isArchived ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isAnyRowBusy}
                        onClick={() => handleSetDefault(wallet)}
                        type="button"
                      >
                        <Check className="size-3.5" aria-hidden="true" />
                        Predeterminada
                      </button>
                    ) : null}
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isAnyRowBusy}
                      onClick={() => handleRenameWallet(wallet)}
                      type="button"
                    >
                      <Pencil className="size-3.5" aria-hidden="true" />
                      Renombrar
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isAnyRowBusy}
                      onClick={() => handleToggleArchive(wallet)}
                      type="button"
                    >
                      {wallet.isArchived ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Archive className="size-3.5" aria-hidden="true" />}
                      {isRowBusy ? 'Guardando...' : wallet.isArchived ? 'Reactivar' : 'Archivar'}
                    </button>
                    <button
                      className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isAnyRowBusy || usageCount > 0}
                      onClick={() => handleDeleteWallet(wallet)}
                      title={usageCount > 0 ? 'No se puede eliminar: tiene movimientos asociados. Archívala en su lugar.' : undefined}
                      type="button"
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Eliminar
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

export default SettingsWalletsPage
