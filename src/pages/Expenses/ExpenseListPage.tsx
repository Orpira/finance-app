import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  ReceiptText,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { deleteExpense, listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { getExpenseDisplayName } from '../../utils/activityLabels'
import { countries } from '../../utils/countries'
import { formatCurrency } from '../../utils/currency'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'

const EXPENSES_PER_PAGE = 10

export function ExpenseListPage() {
  const { hidden } = useSensitiveValues()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL'>('ALL')
  const [selectedCity, setSelectedCity] = useState<string | 'ALL'>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [expensePage, setExpensePage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const incomesById = useMemo(
    () => new Map(incomes.map((income) => [income.id, income])),
    [incomes],
  )

  const availableCountries = useMemo(() => {
    const countryCodes = new Set<CountryCode>()

    expenses.forEach((expense) => {
      if (expense.country) {
        countryCodes.add(expense.country as CountryCode)
      }
    })

    return Array.from(countryCodes).sort()
  }, [expenses])

  const availableCities = useMemo(() => {
    const cityNames = new Set<string>()

    expenses.forEach((expense) => {
      const matchesCountry =
        selectedCountry === 'ALL' || expense.country === selectedCountry

      if (expense.city && matchesCountry) {
        cityNames.add(expense.city)
      }
    })

    return Array.from(cityNames).sort((firstCity, secondCity) =>
      firstCity.localeCompare(secondCity, 'es'),
    )
  }, [expenses, selectedCountry])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()

    expenses.forEach((expense) => {
      const matchesCountry =
        selectedCountry === 'ALL' || expense.country === selectedCountry
      const matchesCity = selectedCity === 'ALL' || expense.city === selectedCity

      if (expense.category && matchesCountry && matchesCity) {
        categories.add(expense.category)
      }
    })

    return Array.from(categories).sort((firstCategory, secondCategory) =>
      firstCategory.localeCompare(secondCategory, 'es'),
    )
  }, [expenses, selectedCity, selectedCountry])

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        const matchesCountry =
          selectedCountry === 'ALL' || expense.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || expense.city === selectedCity
        const matchesCategory =
          selectedCategory === 'ALL' || expense.category === selectedCategory
        const matchesDateFrom = !dateFrom || expense.date >= dateFrom
        const matchesDateTo = !dateTo || expense.date <= dateTo

        return (
          matchesCountry &&
          matchesCity &&
          matchesCategory &&
          matchesDateFrom &&
          matchesDateTo
        )
      }),
    [dateFrom, dateTo, expenses, selectedCategory, selectedCity, selectedCountry],
  )
  const totalExpensePages = Math.max(
    1,
    Math.ceil(filteredExpenses.length / EXPENSES_PER_PAGE),
  )
  const currentExpensePage = Math.min(expensePage, totalExpensePages)
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentExpensePage - 1) * EXPENSES_PER_PAGE

    return filteredExpenses.slice(startIndex, startIndex + EXPENSES_PER_PAGE)
  }, [currentExpensePage, filteredExpenses])

  const getCountryLabel = (code: string): string => {
    const country = countries.find((countryOption) => countryOption.value === code)

    return country?.label || code
  }

  async function reloadExpenses() {
    const currentExpenses = await listExpenses({ newestFirst: true })
    setExpenses(currentExpenses)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentExpenses, currentIncomes, currentSettings] = await Promise.all([
        listExpenses({ newestFirst: true }),
        listServiceIncomes({ newestFirst: true }),
        getSettings(),
      ])

      if (!isMounted) {
        return
      }

      setExpenses(currentExpenses)
      setIncomes(currentIncomes)
      setSettings(currentSettings)
      setIsLoading(false)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleDeleteExpense(expense: Expense) {
    if (!expense.id) {
      return
    }

    const shouldDelete = window.confirm(
      `¿Eliminar el ${expense.type === 'ajuste' ? 'ajuste' : 'gasto'} #${expense.id} del ${expense.date}?`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteExpense(expense.id)
    await reloadExpenses()
  }

  function handleCountryFilterChange(country: string) {
    setSelectedCountry(country || 'ALL')
    setSelectedCity('ALL')
    setSelectedCategory('ALL')
    setExpensePage(1)
  }

  function handleCityFilterChange(city: string) {
    setSelectedCity(city || 'ALL')
    setSelectedCategory('ALL')
    setExpensePage(1)
  }

  function handleCategoryFilterChange(category: string) {
    setSelectedCategory(category || 'ALL')
    setExpensePage(1)
  }

  function handleDateFromChange(date: string) {
    setDateFrom(date)
    setExpensePage(1)
  }

  function handleDateToChange(date: string) {
    setDateTo(date)
    setExpensePage(1)
  }

  if (isLoading) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

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

      <CollapsibleFilters title="Filtros" storageKey="filters-open-expenses">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">
              Fecha desde
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              max={dateTo || undefined}
              onChange={(event) => handleDateFromChange(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">
              Fecha hasta
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={dateFrom || undefined}
              onChange={(event) => handleDateToChange(event.target.value)}
              type="date"
              value={dateTo}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">País</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => handleCountryFilterChange(event.target.value)}
              value={selectedCountry}
            >
              <option value="ALL">Todos los países</option>
              {availableCountries.map((country) => (
                <option key={country} value={country}>
                  {getCountryLabel(country)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">Ciudad</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => handleCityFilterChange(event.target.value)}
              value={selectedCity}
            >
              <option value="ALL">Todas las ciudades</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">
              Categoría
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) =>
                handleCategoryFilterChange(event.target.value)
              }
              value={selectedCategory}
            >
              <option value="ALL">Todas las categorías</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CollapsibleFilters>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="size-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">
            Egresos recientes
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {filteredExpenses.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              No hay egresos con los filtros seleccionados.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {paginatedExpenses.map((expense) => {
                const isClosedSeason = isLocationSeasonClosed(
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
                      <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-500">
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

        {filteredExpenses.length > EXPENSES_PER_PAGE ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-500">
              Página {currentExpensePage} de {totalExpensePages} ·{' '}
              {filteredExpenses.length} registros
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
