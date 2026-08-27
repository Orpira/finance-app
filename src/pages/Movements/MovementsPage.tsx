import {
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ActionableEmptyState } from '../../components/ActionableEmptyState'
import { PeriodNavigator } from '../../components/PeriodNavigator'
import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import ExpenseListPage from '../Expenses/ExpenseListPage'
import IncomeListPage from '../Income/IncomeListPage'
import { MovementCreateSheet } from './MovementCreateSheet'
import { MovementFiltersSheet } from './MovementFiltersSheet'
import {
  applyMovementFilters,
  countActiveMovementFilters,
  getMovementPeriodLabel,
  hasActiveMovementFilters,
  hasMovementFilterParams,
  readMovementFilters,
  shiftMovementPeriod,
  scopeRecordsByUsageMode,
  writeMovementFilters,
} from './movementFilters'
import {
  shouldShowMovementReportBadge,
  toUnifiedMovements,
  type UnifiedMovement,
} from './movementPresentation'

type MovementTab = 'todos' | 'ingresos' | 'egresos'

const TABS: { id: MovementTab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'egresos', label: 'Egresos' },
]

const RECENT_LIMIT = 40
const MOVEMENT_FILTERS_SESSION_KEY = 'finance-app:movement-filters'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${value}T00:00`))
}

function AllMovementsTab({ onCreateMovement }: { readonly onCreateMovement: () => void }) {
  const { hidden } = useSensitiveValues()
  const [movements, setMovements] = useState<UnifiedMovement[] | null>(null)
  const [showUnreportedIncome, setShowUnreportedIncome] = useState(true)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readMovementFilters(searchParams), [searchParams])
  const defaultFilters = useMemo(
    () => readMovementFilters(new URLSearchParams()),
    [],
  )
  const sessionCheckedRef = useRef(false)

  useEffect(() => {
    if (!sessionCheckedRef.current) {
      sessionCheckedRef.current = true

      if (!hasMovementFilterParams(searchParams)) {
        const storedFilters = window.sessionStorage.getItem(MOVEMENT_FILTERS_SESSION_KEY)
        if (storedFilters) {
          const restoredFilters = new URLSearchParams(storedFilters)
          if (hasMovementFilterParams(restoredFilters)) {
            const next = new URLSearchParams(searchParams)
            restoredFilters.forEach((value, key) => next.set(key, value))
            setSearchParams(next, { replace: true })
            return
          }
        }
      }
    }

    const sessionFilters = writeMovementFilters(filters)
    if (hasMovementFilterParams(sessionFilters)) {
      window.sessionStorage.setItem(MOVEMENT_FILTERS_SESSION_KEY, sessionFilters.toString())
    } else {
      window.sessionStorage.removeItem(MOVEMENT_FILTERS_SESSION_KEY)
    }
  }, [filters, searchParams, setSearchParams])

  useEffect(() => {
    let cancelled = false

    Promise.all([
      listServiceIncomes({ newestFirst: true }),
      listExpenses({ newestFirst: true }),
      getSettings(),
    ])
      .then(([incomes, expenses, settings]) => {
        if (cancelled) return
        const scopedIncomes = scopeRecordsByUsageMode(incomes, settings.usageMode)
        const scopedExpenses = scopeRecordsByUsageMode(expenses, settings.usageMode)
        setMovements(toUnifiedMovements(scopedIncomes, scopedExpenses))
        setShowUnreportedIncome(settings.showUnreportedIncome)
      })
      .catch((error) => {
        console.warn('No se pudieron cargar los movimientos.', error)
        if (!cancelled) setMovements([])
      })

    function handleSettingsChanged(event: Event) {
      if (!cancelled) {
        setShowUnreportedIncome(
          (event as CustomEvent<AppSettings>).detail.showUnreportedIncome,
        )
      }
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      cancelled = true
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!movements) return null
    return applyMovementFilters(movements, filters).slice(0, RECENT_LIMIT)
  }, [filters, movements])

  const categories = useMemo(() => [...new Set((movements ?? []).map((movement) => movement.category))].sort((a, b) => a.localeCompare(b, 'es')), [movements])
  const currencies = useMemo(() => [...new Set((movements ?? []).map((movement) => movement.currency))].sort(), [movements])
  const activeFilterCount = countActiveMovementFilters(filters)
  const periodCanMove = filters.period !== 'all' && filters.period !== 'custom'

  function applyFilters(nextFilters: typeof filters) {
    setSearchParams(writeMovementFilters(nextFilters, searchParams), { replace: true })
    setFiltersOpen(false)
  }

  function clearFilters() {
    window.sessionStorage.removeItem(MOVEMENT_FILTERS_SESSION_KEY)
    setSearchParams(writeMovementFilters(defaultFilters, searchParams), { replace: true })
    setFiltersOpen(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-stretch gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            aria-label="Buscar en movimientos recientes"
            className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            onChange={(event) => applyFilters({ ...filters, query: event.target.value })}
            placeholder="Buscar movimientos"
            type="search"
            value={filters.query}
          />
        </label>
        <button
          aria-expanded={filtersOpen}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-emerald-800 dark:hover:bg-emerald-950"
          onClick={() => setFiltersOpen(true)}
          type="button"
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <PeriodNavigator
        canMove={periodCanMove}
        label={getMovementPeriodLabel(filters)}
        onLabelClick={() => setFiltersOpen(true)}
        onNext={() => applyFilters(shiftMovementPeriod(filters, 1))}
        onPrevious={() => applyFilters(shiftMovementPeriod(filters, -1))}
      />

      {activeFilterCount > 0 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <button
            className="font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300"
            onClick={() => setFiltersOpen(true)}
            type="button"
          >
            {activeFilterCount} {activeFilterCount === 1 ? 'filtro activo' : 'filtros activos'}
          </button>
          <button
            className="font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            onClick={clearFilters}
            type="button"
          >
            Restablecer
          </button>
        </div>
      )}

      {filtersOpen && (
        <MovementFiltersSheet
          categories={categories}
          currencies={currencies}
          defaultFilters={defaultFilters}
          filters={filters}
          onApply={applyFilters}
          onCancel={() => setFiltersOpen(false)}
        />
      )}

      {filtered === null ? (
        <p className="py-10 text-center text-sm text-slate-500">Cargando movimientos…</p>
      ) : filtered.length === 0 ? (
        movements?.length === 0 ? (
          <ActionableEmptyState
            action={{ label: 'Registrar movimiento', onClick: onCreateMovement }}
            description="Añade tu primer ingreso o egreso para construir el historial de movimientos."
            title="Aún no hay movimientos"
          />
        ) : (
          <ActionableEmptyState
            action={{ label: 'Limpiar filtros', onClick: clearFilters }}
            description="Prueba de nuevo con todos los períodos, tipos y categorías."
            title={hasActiveMovementFilters(filters)
              ? 'Ningún movimiento coincide con los filtros'
              : 'No hay movimientos disponibles'}
          />
        )
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((movement) => (
            <li key={movement.key}>
              <Link
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40"
                to={movement.href}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={[
                      'flex size-10 shrink-0 items-center justify-center rounded-full',
                      movement.kind === 'income'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
                    ].join(' ')}
                  >
                    {movement.kind === 'income' ? (
                      <ArrowUpRight className="size-5" aria-hidden="true" />
                    ) : (
                      <ArrowDownLeft className="size-5" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-slate-950 dark:text-white">
                      {movement.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {formatDate(movement.date)}
                      {shouldShowMovementReportBadge(showUnreportedIncome, movement.reportBadge)
                        ? ` · ${movement.reportBadge?.label}`
                        : ''}
                    </span>
                  </span>
                </div>
                <span
                  className={[
                    'shrink-0 text-sm font-semibold',
                    movement.kind === 'income'
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-rose-700 dark:text-rose-300',
                  ].join(' ')}
                >
                  {movement.kind === 'income' ? '+' : '-'}
                  <SensitiveAmount hidden={hidden} value={formatCurrency(movement.amount, movement.currency as CurrencyCode)} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MovementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const requestedTab = searchParams.get('tab')
  const activeTab: MovementTab =
    requestedTab === 'ingresos' || requestedTab === 'egresos' ? requestedTab : 'todos'

  function selectTab(tab: MovementTab) {
    const next = new URLSearchParams(searchParams)
    if (tab === 'todos') next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      {activeTab === 'todos' ? (
        <>
          <PageHeader eyebrow="Movimientos" title="Ingresos y egresos">
            <button
              aria-label="Registrar movimiento"
              className="inline-flex size-11 items-center justify-center self-end rounded-md bg-emerald-700 text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-950 sm:self-auto"
              onClick={() => setCreateSheetOpen(true)}
              title="Registrar movimiento"
              type="button"
            >
              <Plus aria-hidden="true" className="size-5" />
            </button>
          </PageHeader>
          {createSheetOpen && (
            <MovementCreateSheet onCancel={() => setCreateSheetOpen(false)} />
          )}
          <div
            className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900"
            role="tablist"
            aria-label="Tipo de movimiento"
          >
            {TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={[
                  'h-10 flex-1 rounded-md text-sm font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          <AllMovementsTab onCreateMovement={() => setCreateSheetOpen(true)} />
        </>
      ) : (
        <div className="-mx-4">
          <div className="mx-4 mb-2 flex gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" role="tablist" aria-label="Tipo de movimiento">
            {TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.id}
                className={[
                  'h-10 flex-1 rounded-md text-sm font-semibold transition-colors',
                  activeTab === tab.id
                    ? 'bg-emerald-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                ].join(' ')}
                key={tab.id}
                onClick={() => selectTab(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'ingresos' ? <IncomeListPage /> : <ExpenseListPage />}
        </div>
      )}
    </section>
  )
}

export default MovementsPage
