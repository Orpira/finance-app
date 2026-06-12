import { CalendarDays, CircleDollarSign, MinusCircle, PlusCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'

import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings } from '../../types/settings'
import type { CountryCode } from '../../types/settings'
import { formatCurrency, getCurrentMonthRange } from '../../utils/currency'
import { getCountryCurrency, countries } from '../../utils/countries'
import { calculateFinancialTotals } from '../../utils/financeStats'

export function DashboardPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL' | null>(null)
  const [availableCountries, setAvailableCountries] = useState<CountryCode[]>([])

  const monthRange = useMemo(() => getCurrentMonthRange(), [])

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      const [currentSettings, currentIncomes, currentExpenses] =
        await Promise.all([
          getSettings(),
          listServiceIncomes({ ...monthRange, newestFirst: true }),
          listExpenses({ ...monthRange, newestFirst: true }),
        ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setSelectedCountry(currentSettings?.country ?? 'ALL')
      
      // Calculate available countries from all incomes and expenses
      const countriesFromData = new Set<CountryCode>()
      currentIncomes.forEach(inc => {
        if (inc.country) countriesFromData.add(inc.country as CountryCode)
      })
      currentExpenses.forEach(exp => {
        if (exp.country) countriesFromData.add(exp.country as CountryCode)
      })
      
      setAvailableCountries(Array.from(countriesFromData).sort())
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [monthRange])

  // Load data filtered by selected country
  useEffect(() => {
    let isMounted = true

    async function loadFilteredData() {
      const countryParam = selectedCountry === 'ALL' ? undefined : (selectedCountry as CountryCode)
      const [currentIncomes, currentExpenses] = await Promise.all([
        listServiceIncomes({ ...monthRange, newestFirst: true, country: countryParam }),
        listExpenses({ ...monthRange, newestFirst: true, country: countryParam }),
      ])

      if (!isMounted) {
        return
      }

      setIncomes(currentIncomes)
      setExpenses(currentExpenses)
    }

    if (selectedCountry !== null) {
      loadFilteredData()
    }

    return () => {
      isMounted = false
    }
  }, [monthRange, selectedCountry])

  const primaryCurrencyFromSettings = settings?.defaultCurrency ?? 'EUR'
  const secondaryCurrency = settings?.secondaryCurrency ?? 'COP'

  const primaryCurrency = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'ALL') return primaryCurrencyFromSettings
    return getCountryCurrency(selectedCountry as CountryCode) ?? primaryCurrencyFromSettings
  }, [selectedCountry, primaryCurrencyFromSettings])

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

  const getCountryLabel = (code: string): string => {
    const country = countries.find((c) => c.value === code)
    return country?.label || code
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-emerald-700">
          {settings.businessName || 'Dashboard'}
        </p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Resumen del mes
        </h1>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
      </div>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
            <h2 className="text-lg font-semibold text-slate-950">
              Ingresos recientes
            </h2>
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
              to="/income?country=GB"
            >
              Añadir
            </Link>
          </div>

          {incomes.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Registra tu primer ingreso para activar el resumen.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {incomes.slice(0, 6).map((income) => (
                <li
                  className="flex items-center justify-between gap-4 p-4"
                  key={income.id}
                >
                  <div>
                    <p className="font-medium text-slate-950">{income.date}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {income.duration} min · {income.percentage}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-950">
                      {formatCurrency(income.eurValue, 'EUR')}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatCurrency(income.copValue, 'COP')}
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

          {availableCountries.length > 0 && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <label htmlFor="country-select" className="text-sm font-medium text-slate-600">
                Filtrar por país
              </label>
              <select
                id="country-select"
                value={selectedCountry || 'ALL'}
                onChange={(e) => setSelectedCountry(e.target.value || 'ALL')}
                className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">Todos los países</option>
                {availableCountries.map((country) => (
                  <option key={country} value={country}>
                    {getCountryLabel(country)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </aside>
      </section>
    </section>
  )
}

export default DashboardPage
