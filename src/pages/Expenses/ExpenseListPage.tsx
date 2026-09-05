import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  ReceiptText,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { ActionableEmptyState } from '../../components/ActionableEmptyState'
import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { deleteExpense, listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import { getExpenseDisplayName } from '../../utils/activityLabels'
import { formatCurrency } from '../../utils/currency'
import { getFinancialListEmptyReason } from '../../utils/financialListEmptyState'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import {
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
  resolveActiveUsageMode,
} from '../../utils/usageMode'
import { useDialog } from '../../components/dialogs/useDialog'

const EXPENSES_PER_PAGE = 10

function filterExpensesByMode(
  expenses: Expense[],
  settings: AppSettings,
  activePeriodId?: number,
) {
  return expenses.filter(
    (expense) =>
      recordBelongsToUsageMode(expense, resolveActiveUsageMode(settings)) &&
      (isBasicMode(settings) ||
        (activePeriodId !== undefined &&
          (expense.earningPeriodId === activePeriodId ||
            expense.seasonPeriodId === activePeriodId))),
  )
}

function filterIncomesByMode(
  incomes: ServiceIncome[],
  settings: AppSettings,
  activePeriodId?: number,
) {
  return incomes.filter(
    (income) =>
      recordBelongsToUsageMode(income, resolveActiveUsageMode(settings)) &&
      (isBasicMode(settings) ||
        (activePeriodId !== undefined &&
          (income.earningPeriodId === activePeriodId ||
            income.seasonPeriodId === activePeriodId))),
  )
}

export function ExpenseListPage() {
  const { confirm } = useDialog()
  const { hidden } = useSensitiveValues()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activePeriodId, setActivePeriodId] = useState<number>()
  const [expensePage, setExpensePage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const incomesById = useMemo(
    () => new Map(incomes.map((income) => [income.id, income])),
    [incomes],
  )

  const totalExpensePages = Math.max(
    1,
    Math.ceil(expenses.length / EXPENSES_PER_PAGE),
  )
  const currentExpensePage = Math.min(expensePage, totalExpensePages)
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentExpensePage - 1) * EXPENSES_PER_PAGE

    return expenses.slice(startIndex, startIndex + EXPENSES_PER_PAGE)
  }, [currentExpensePage, expenses])

  async function reloadExpenses() {
    if (!settings) {
      return
    }

    const currentExpenses = await listExpenses({ newestFirst: true })
    setExpenses(filterExpensesByMode(currentExpenses, settings, activePeriodId))
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentExpenses, currentIncomes, currentSettings, activePeriod] = await Promise.all([
        listExpenses({ newestFirst: true }),
        listServiceIncomes({ newestFirst: true }),
        getSettings(),
        getActiveEarningPeriod(),
      ])

      if (!isMounted) {
        return
      }

      setExpenses(
        filterExpensesByMode(currentExpenses, currentSettings, activePeriod?.id),
      )
      setIncomes(
        filterIncomesByMode(currentIncomes, currentSettings, activePeriod?.id),
      )
      setSettings(currentSettings)
      setActivePeriodId(activePeriod?.id)
      setIsLoading(false)
    }

    loadInitialData()

    async function handleSettingsChanged(event: Event) {
      const nextSettings = (event as CustomEvent<AppSettings>).detail
      const [currentExpenses, currentIncomes, activePeriod] = await Promise.all([
        listExpenses({ newestFirst: true }),
        listServiceIncomes({ newestFirst: true }),
        getActiveEarningPeriod(),
      ])

      if (!isMounted) {
        return
      }

      const nextActivePeriodId = activePeriod?.id
      setSettings(nextSettings)
      setActivePeriodId(nextActivePeriodId)
      setExpenses(filterExpensesByMode(currentExpenses, nextSettings, nextActivePeriodId))
      setIncomes(filterIncomesByMode(currentIncomes, nextSettings, nextActivePeriodId))
      setExpensePage(1)
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      isMounted = false
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [])

  async function handleDeleteExpense(expense: Expense) {
    if (!expense.id) {
      return
    }

    const shouldDelete = await confirm({
      title: expense.type === 'ajuste' ? 'Eliminar ajuste' : 'Eliminar egreso',
      message: `¿Eliminar el ${expense.type === 'ajuste' ? 'ajuste' : 'gasto'} #${expense.id} del ${expense.date}?`,
      confirmLabel: 'Eliminar',
      confirmTone: 'danger',
    })

    if (!shouldDelete) {
      return
    }

    await deleteExpense(expense.id)
    await reloadExpenses()
  }

  if (isLoading) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  const emptyReason = getFinancialListEmptyReason({
    totalRecords: expenses.length,
    requiresActiveSeason: Boolean(settings && requiresSeason(settings)),
    hasActiveSeason: activePeriodId !== undefined,
  })

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Egresos"
        title="Registros de egresos"
      >
        <Link
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          to="/expenses/nuevo"
        >
          + Nuevo Egreso
        </Link>
      </PageHeader>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="size-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">
            Egresos recientes
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {expenses.length === 0 ? (
            emptyReason === 'no-active-season' ? (
              <ActionableEmptyState
                action={{ label: 'Ir a Temporadas', to: '/temporadas' }}
                description="Inicia una temporada para poder registrar y consultar egresos profesionales."
                title="No hay una temporada activa"
              />
            ) : (
              <ActionableEmptyState
                action={{ label: 'Registrar egreso', to: '/expenses/nuevo' }}
                description="Añade tu primer egreso para comenzar a construir el historial financiero."
                title="Aún no hay egresos"
              />
            )
          ) : (
            <ul className="divide-y divide-slate-200">
              {paginatedExpenses.map((expense) => {
                const isClosedSeason =
                  requiresSeason(settings ?? undefined) &&
                  isLocationSeasonClosed(
                    expense,
                    settings?.closedLocationSeasons,
                  )
                const relatedIncome = expense.relatedIncomeId
                  ? incomesById.get(expense.relatedIncomeId)
                  : undefined
                return (
                <li
                  className={[
                    'flex flex-col gap-3 p-4',
                    expense.type === 'ajuste' ? 'bg-amber-50/50' : '',
                  ].join(' ')}
                  key={expense.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {expense.type === 'ajuste' && (
                        <span className="mb-2 inline-flex rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
                          Ajuste
                        </span>
                      )}
                      <p className="font-medium text-slate-950">
                        {getExpenseDisplayName(expense)}
                      </p>
                      {expense.type !== 'ajuste' && (
                        <p className="mt-1 text-sm text-slate-500">
                          {expense.category}
                        </p>
                      )}
                      {expense.notes && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                          {expense.notes}
                        </p>
                      )}
                      {relatedIncome && (
                        <p className="mt-2 text-sm font-medium text-amber-800">
                          Relacionado con ingreso #{relatedIncome.id} ·{' '}
                          {new Intl.DateTimeFormat('es-ES').format(
                            new Date(`${relatedIncome.date}T00:00`),
                          )}{' '}
                          ·{' '}
                          <SensitiveAmount
                            hidden={hidden}
                            value={formatCurrency(
                              relatedIncome.totalAmount,
                              relatedIncome.currency as CurrencyCode,
                            )}
                          />
                          {relatedIncome.city ? ` · ${relatedIncome.city}` : ''}
                          {relatedIncome.country
                            ? `${relatedIncome.city ? ', ' : ' · '}${relatedIncome.country}`
                            : ''}
                        </p>
                      )}
                      {expense.relatedIncomeId && !relatedIncome && (
                        <p className="mt-2 text-sm font-medium text-slate-500">
                          Relacionado con ingreso #{expense.relatedIncomeId} · no encontrado
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">
                        <SensitiveAmount
                          hidden={hidden}
                          value={formatCurrency(
                            expense.amount,
                            expense.currency as CurrencyCode,
                          )}
                        />
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        <SensitiveAmount
                          hidden={hidden}
                          value={formatCurrency(expense.eurValue, 'EUR')}
                        />
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-start gap-2">
                    {isClosedSeason ? (
                      <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:text-slate-200!">
                        Solo consulta
                      </span>
                    ) : (
                      <>
                    <Link
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      to={`/expenses/${expense.id}/editar`}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Modificar
                    </Link>
                    <button
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                      onClick={() => handleDeleteExpense(expense)}
                      type="button"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Eliminar
                    </button>
                      </>
                    )}
                  </div>
                </li>
                )
              })}
            </ul>
          )}
        </div>

        {expenses.length > EXPENSES_PER_PAGE ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-500">
              Página {currentExpensePage} de {totalExpensePages} ·{' '}
              {expenses.length} registros
            </p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentExpensePage === 1}
                onClick={() =>
                  setExpensePage((currentPage) => Math.max(1, currentPage - 1))
                }
                type="button"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </button>
              <button
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentExpensePage === totalExpensePages}
                onClick={() =>
                  setExpensePage((currentPage) =>
                    Math.min(totalExpensePages, currentPage + 1),
                  )
                }
                type="button"
              >
                Siguiente
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default ExpenseListPage
