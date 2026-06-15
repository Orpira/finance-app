import {
  CalendarDays,
  CircleDollarSign,
  Clock,
  MinusCircle,
  PlusCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CountryCode } from '../../types/settings'
import { formatCurrency, getCurrentMonthRange } from '../../utils/currency'
import { countries, getCountryCurrency } from '../../utils/countries'
import {
  calculateFinancialTotals,
  calculateIncomeDaysRanking,
} from '../../utils/financeStats'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatIncomeDayDate(date: string) {
  return capitalize(
    new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
      year: 'numeric',
    }).format(new Date(`${date}T00:00`)),
  )
}

function formatIncomeDayCities(cityNames: string[]) {
  if (cityNames.length === 0) {
    return 'Sin ciudad'
  }

  return cityNames.join(', ')
}

export function DashboardPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const monthRange = useMemo(() => getCurrentMonthRange(), [])
  const [dateFrom, setDateFrom] = useState(monthRange.from)
  const [dateTo, setDateTo] = useState(monthRange.to)
  const [allIncomes, setAllIncomes] = useState<ServiceIncome[]>([])
  const [allExpenses, setAllExpenses] = useState<Expense[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL'>('ALL')
  const [selectedCity, setSelectedCity] = useState<string | 'ALL'>('ALL')
  const [selectedPaymentType, setSelectedPaymentType] =
    useState<string | 'ALL'>('ALL')

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      const range = {
        from: dateFrom || undefined,
        to: dateTo || undefined,
      }
      const [currentSettings, currentIncomes, currentExpenses] =
        await Promise.all([
          getSettings(),
          listServiceIncomes({ ...range, newestFirst: true }),
          listExpenses({ ...range, newestFirst: true }),
        ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setAllIncomes(currentIncomes)
      setAllExpenses(currentExpenses)
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [dateFrom, dateTo])

  const availableCountries = useMemo(() => {
    const countryCodes = new Set<CountryCode>()

    allIncomes.forEach((income) => {
      if (income.country) {
        countryCodes.add(income.country as CountryCode)
      }
    })
    allExpenses.forEach((expense) => {
      if (expense.country) {
        countryCodes.add(expense.country as CountryCode)
      }
    })

    return Array.from(countryCodes).sort()
  }, [allExpenses, allIncomes])

  const availableCities = useMemo(() => {
    const cityNames = new Set<string>()

    ;[...allIncomes, ...allExpenses].forEach((item) => {
      const matchesCountry =
        selectedCountry === 'ALL' || item.country === selectedCountry

      if (item.city && matchesCountry) {
        cityNames.add(item.city)
      }
    })

    return Array.from(cityNames).sort((firstCity, secondCity) =>
      firstCity.localeCompare(secondCity, 'es'),
    )
  }, [allExpenses, allIncomes, selectedCountry])

  const availablePaymentTypes = useMemo(() => {
    const paymentTypes = new Set<string>()

    allIncomes.forEach((income) => {
      const matchesCountry =
        selectedCountry === 'ALL' || income.country === selectedCountry
      const matchesCity = selectedCity === 'ALL' || income.city === selectedCity

      if (income.paymentType && matchesCountry && matchesCity) {
        paymentTypes.add(income.paymentType)
      }
    })

    return Array.from(paymentTypes).sort((firstType, secondType) =>
      getPaymentTypeLabel(firstType).localeCompare(
        getPaymentTypeLabel(secondType),
        'es',
      ),
    )
  }, [allIncomes, selectedCity, selectedCountry])

  const incomes = useMemo(
    () =>
      allIncomes.filter((income) => {
        const matchesCountry =
          selectedCountry === 'ALL' || income.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || income.city === selectedCity
        const matchesPaymentType =
          selectedPaymentType === 'ALL' ||
          income.paymentType === selectedPaymentType

        return matchesCountry && matchesCity && matchesPaymentType
      }),
    [allIncomes, selectedCity, selectedCountry, selectedPaymentType],
  )

  const expenses = useMemo(
    () =>
      allExpenses.filter((expense) => {
        const matchesCountry =
          selectedCountry === 'ALL' || expense.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || expense.city === selectedCity

        return matchesCountry && matchesCity
      }),
    [allExpenses, selectedCity, selectedCountry],
  )

  const primaryCurrencyFromSettings = settings?.defaultCurrency ?? 'EUR'
  const secondaryCurrency = settings?.secondaryCurrency ?? 'COP'
  const primaryCurrency = useMemo(() => {
    if (selectedCountry === 'ALL') {
      return primaryCurrencyFromSettings
    }

    return (
      getCountryCurrency(selectedCountry as CountryCode) ??
      primaryCurrencyFromSettings
    )
  }, [primaryCurrencyFromSettings, selectedCountry])

  const totals = useMemo(
    () =>
      calculateFinancialTotals(
        incomes,
        expenses,
        primaryCurrency,
        secondaryCurrency,
      ),
    [expenses, incomes, primaryCurrency, secondaryCurrency],
  )
  const incomeDaysRanking = useMemo(
    () => calculateIncomeDaysRanking(incomes, primaryCurrency),
    [incomes, primaryCurrency],
  )
  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  const primaryIncome = totals.primaryIncome
  const secondaryIncome = totals.secondaryIncome
  const primaryExpenses = totals.primaryExpenses
  const netProfit = totals.primaryNet
  const profitWithPercentage = (primaryIncome * settings.incomePercentage) / 100
  const workedHours = Math.round((totals.serviceMinutes / 60) * 10) / 10

  const getCountryLabel = (code: string): string => {
    const country = countries.find((countryOption) => countryOption.value === code)

    return country?.label || code
  }

  function handleCountryFilterChange(country: string) {
    setSelectedCountry(country || 'ALL')
    setSelectedCity('ALL')
    setSelectedPaymentType('ALL')
  }

  function handleCityFilterChange(city: string) {
    setSelectedCity(city || 'ALL')
    setSelectedPaymentType('ALL')
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow={settings.businessName || 'Dashboard'}
        title="DASHBOARD"
      />

      <CollapsibleFilters title="Filtros" storageKey="filters-open-dashboard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">
              Fecha desde
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              max={dateTo || undefined}
              onChange={(event) => setDateFrom(event.target.value)}
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
              onChange={(event) => setDateTo(event.target.value)}
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
              Tipo de pago
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) =>
                setSelectedPaymentType(event.target.value || 'ALL')
              }
              value={selectedPaymentType}
            >
              <option value="ALL">Todos los tipos</option>
              {availablePaymentTypes.map((paymentType) => (
                <option key={paymentType} value={paymentType}>
                  {getPaymentTypeLabel(paymentType)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CollapsibleFilters>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Ingresos</p>
            <PlusCircle className="size-5 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {formatCurrency(primaryIncome, primaryCurrency)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatCurrency(secondaryIncome, secondaryCurrency)}
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Gastos</p>
            <MinusCircle className="size-5 text-red-600" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {formatCurrency(primaryExpenses, primaryCurrency)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {expenses.length} registros
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Ganancia neta
            </p>
            <CircleDollarSign
              className="size-5 text-emerald-700"
              aria-hidden="true"
            />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {formatCurrency(netProfit, primaryCurrency)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            ganancia real menos gastos
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">
              Ganancia {settings.incomePercentage}%
            </p>
            <CircleDollarSign
              className="size-5 text-amber-600"
              aria-hidden="true"
            />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {formatCurrency(profitWithPercentage, primaryCurrency)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {settings.incomePercentage}% de ingresos
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Servicios</p>
            <CalendarDays className="size-5 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {incomes.length}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {totals.serviceMinutes} minutos
          </p>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Horas</p>
            <Clock className="size-5 text-emerald-700" aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-950">
            {workedHours}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {totals.serviceMinutes} minutos
          </p>
        </article>

      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Mejores días de ingresos
            </h2>
          </div>

          {incomeDaysRanking.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Registra tu primer ingreso para activar el ranking.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {incomeDaysRanking.map((day, index) => (
                <li
                  className="flex items-center justify-between gap-4 p-4"
                  key={day.date}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-sm font-semibold text-emerald-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-slate-950">
                        {formatIncomeDayDate(day.date)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {day.count} ingreso{day.count === 1 ? '' : 's'} · promedio{' '}
                        {formatCurrency(day.average, primaryCurrency)}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Ciudad: {formatIncomeDayCities(day.cityNames)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold text-slate-950">
                      {formatCurrency(day.total, primaryCurrency)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Conversión activa
          </h2>
          <dl className="mt-4 flex flex-col gap-3">
            <div>
              <dt className="text-sm text-slate-500">Moneda principal</dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {primaryCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">Moneda secundaria</dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {secondaryCurrency}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">
                Ingresos {primaryCurrency}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {formatCurrency(totals.primaryIncome, primaryCurrency)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-500">
                Ingresos {secondaryCurrency}
              </dt>
              <dd className="mt-1 font-semibold text-slate-950">
                {formatCurrency(totals.secondaryIncome, secondaryCurrency)}
              </dd>
            </div>
          </dl>

        </aside>
      </section>
    </section>
  )
}

export default DashboardPage
