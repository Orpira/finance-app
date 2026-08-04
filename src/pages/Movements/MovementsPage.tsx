import { ArrowDownLeft, ArrowUpRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { CurrencyCode } from '../../types/settings'
import { getIncomeTypeLabel } from '../../utils/incomeTypes'
import { formatCurrency } from '../../utils/currency'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'
import { getRecordReportBadge } from '../../utils/reportStatus'
import ExpenseListPage from '../Expenses/ExpenseListPage'
import IncomeListPage from '../Income/IncomeListPage'
import { applyMovementFilters, readMovementFilters, scopeRecordsByUsageMode } from './movementFilters'

type MovementTab = 'todos' | 'ingresos' | 'egresos'

const TABS: { id: MovementTab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ingresos', label: 'Ingresos' },
  { id: 'egresos', label: 'Egresos' },
]

const RECENT_LIMIT = 40

interface UnifiedMovement {
  key: string
  kind: 'income' | 'expense'
  date: string
  label: string
  amount: number
  currency: string
  href: string
  reportBadge?: { label: string; isReported: boolean; isUnreviewed: boolean }
  category: string
  reported?: boolean
  searchText: string
}

function toUnifiedMovements(incomes: ServiceIncome[], expenses: Expense[]): UnifiedMovement[] {
  const incomeMovements: UnifiedMovement[] = incomes.map((income) => ({
    key: `income-${income.id}`,
    kind: 'income',
    date: income.date,
    label: `${getIncomeTypeLabel(income)} · ${getPaymentTypeLabel(income.paymentType)}`,
    amount: income.totalAmount,
    currency: income.currency,
    href: `/income/${income.id}`,
    reportBadge: getRecordReportBadge(income),
    category: getIncomeTypeLabel(income),
    reported: getRecordReportBadge(income).isReported,
    searchText: `${getIncomeTypeLabel(income)} ${getPaymentTypeLabel(income.paymentType)}`,
  }))

  const expenseMovements: UnifiedMovement[] = expenses.map((expense) => ({
    key: `expense-${expense.id}`,
    kind: 'expense',
    date: expense.date,
    label: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    href: `/expenses/${expense.id}/editar`,
    category: expense.category,
    searchText: expense.category,
  }))

  return [...incomeMovements, ...expenseMovements]
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${value}T00:00`))
}

function AllMovementsTab() {
  const { hidden } = useSensitiveValues()
  const [movements, setMovements] = useState<UnifiedMovement[] | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo(() => readMovementFilters(searchParams), [searchParams])

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
      })
      .catch((error) => {
        console.warn('No se pudieron cargar los movimientos.', error)
        if (!cancelled) setMovements([])
      })

    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!movements) return null
    return applyMovementFilters(movements, filters).slice(0, RECENT_LIMIT)
  }, [filters, movements])

  const categories = useMemo(() => [...new Set((movements ?? []).map((movement) => movement.category))].sort((a, b) => a.localeCompare(b, 'es')), [movements])
  const currencies = useMemo(() => [...new Set((movements ?? []).map((movement) => movement.currency))].sort(), [movements])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all' || (key === 'order' && value === 'newest')) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="relative block">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        />
        <input
          aria-label="Buscar en movimientos recientes"
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          onChange={(event) => setFilter('q', event.target.value)}
          placeholder="Buscar por categoría o tipo de pago"
          type="search"
          value={filters.query}
        />
      </label>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-6" aria-label="Filtros de movimientos">
        <select aria-label="Período" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900" onChange={(event) => setFilter('period', event.target.value)} value={filters.period}>
          <option value="all">Todo el período</option><option value="current_month">Mes actual</option>
        </select>
        <select aria-label="Tipo" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900" onChange={(event) => setFilter('type', event.target.value)} value={filters.type}>
          <option value="all">Todos los tipos</option><option value="income">Ingresos</option><option value="expense">Gastos</option>
        </select>
        <select aria-label="Categoría" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900" onChange={(event) => setFilter('category', event.target.value)} value={filters.category}>
          <option value="">Todas las categorías</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select aria-label="Moneda" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900" onChange={(event) => setFilter('currency', event.target.value)} value={filters.currency}>
          <option value="">Todas las monedas</option>{currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
        </select>
        <select aria-label="Estado de reporte" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900" onChange={(event) => setFilter('reported', event.target.value)} value={filters.reported}>
          <option value="all">Cualquier estado</option><option value="reported">Reportados</option><option value="unreported">Sin reportar</option>
        </select>
        <select aria-label="Orden" className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-800 dark:bg-slate-900" onChange={(event) => setFilter('order', event.target.value)} value={filters.order}>
          <option value="newest">Más recientes</option><option value="oldest">Más antiguos</option><option value="amount_desc">Mayor importe</option><option value="amount_asc">Menor importe</option>
        </select>
      </div>

      {filtered === null ? (
        <p className="py-10 text-center text-sm text-slate-500">Cargando movimientos…</p>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          {filters.query ? 'No hay movimientos que coincidan con la búsqueda.' : 'Todavía no hay movimientos con estos filtros.'}
        </p>
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
                      {movement.reportBadge ? ` · ${movement.reportBadge.label}` : ''}
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
          <PageHeader eyebrow="Movimientos" title="Ingresos y egresos" />
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
          <AllMovementsTab />
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
