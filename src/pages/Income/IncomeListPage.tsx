import { ChevronLeft, ChevronRight, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  deleteServiceIncome,
  listServiceIncomes,
} from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { ServiceIncome, ServiceIncomeStatus } from '../../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { getIncomeDisplayName } from '../../utils/activityLabels'
import { countries } from '../../utils/countries'
import { formatCurrency } from '../../utils/currency'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'

const INCOMES_PER_PAGE = 10

const incomeStatusLabels: Record<ServiceIncomeStatus, string> = {
  PENDIENTE: 'Pendiente',
  EJECUCION: 'En ejecución',
  FINALIZADO: 'Finalizado',
}

function getIncomeStatus(income: ServiceIncome): ServiceIncomeStatus {
  return income.status ?? 'PENDIENTE'
}

function getIncomeStatusClass(status: ServiceIncomeStatus) {
  if (status === 'FINALIZADO') {
    return 'bg-emerald-100 text-emerald-800'
  }

  if (status === 'EJECUCION') {
    return 'bg-amber-100 text-amber-800'
  }

  return 'bg-slate-100 text-slate-700'
}

export function IncomeListPage() {
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL'>('ALL')
  const [selectedCity, setSelectedCity] = useState<string | 'ALL'>('ALL')
  const [selectedPaymentType, setSelectedPaymentType] =
    useState<string | 'ALL'>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [incomePage, setIncomePage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const availableCountries = useMemo(() => {
    const countryCodes = new Set<CountryCode>()

    incomes.forEach((income) => {
      if (income.country) {
        countryCodes.add(income.country as CountryCode)
      }
    })

    return Array.from(countryCodes).sort()
  }, [incomes])

  const availableCities = useMemo(() => {
    const cityNames = new Set<string>()

    incomes.forEach((income) => {
      const matchesCountry =
        selectedCountry === 'ALL' || income.country === selectedCountry

      if (income.city && matchesCountry) {
        cityNames.add(income.city)
      }
    })

    return Array.from(cityNames).sort((firstCity, secondCity) =>
      firstCity.localeCompare(secondCity, 'es'),
    )
  }, [incomes, selectedCountry])

  const availablePaymentTypes = useMemo(() => {
    const paymentTypes = new Set<string>()

    incomes.forEach((income) => {
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
  }, [incomes, selectedCity, selectedCountry])

  const filteredIncomes = useMemo(
    () =>
      incomes.filter((income) => {
        const matchesCountry =
          selectedCountry === 'ALL' || income.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || income.city === selectedCity
        const matchesPaymentType =
          selectedPaymentType === 'ALL' ||
          income.paymentType === selectedPaymentType
        const matchesDateFrom = !dateFrom || income.date >= dateFrom
        const matchesDateTo = !dateTo || income.date <= dateTo

        return (
          matchesCountry &&
          matchesCity &&
          matchesPaymentType &&
          matchesDateFrom &&
          matchesDateTo
        )
      }),
    [dateFrom, dateTo, incomes, selectedCity, selectedCountry, selectedPaymentType],
  )
  const totalIncomePages = Math.max(
    1,
    Math.ceil(filteredIncomes.length / INCOMES_PER_PAGE),
  )
  const currentIncomePage = Math.min(incomePage, totalIncomePages)
  const paginatedIncomes = useMemo(() => {
    const startIndex = (currentIncomePage - 1) * INCOMES_PER_PAGE

    return filteredIncomes.slice(startIndex, startIndex + INCOMES_PER_PAGE)
  }, [currentIncomePage, filteredIncomes])

  const getCountryLabel = (code: string): string => {
    const country = countries.find((countryOption) => countryOption.value === code)

    return country?.label || code
  }

  async function reloadIncomes() {
    const currentIncomes = await listServiceIncomes({ newestFirst: true })
    setIncomes(currentIncomes)
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentIncomes, currentSettings] = await Promise.all([
        listServiceIncomes({ newestFirst: true }),
        getSettings(),
      ])

      if (!isMounted) {
        return
      }

      setIncomes(currentIncomes)
      setSettings(currentSettings)
      setIsLoading(false)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  async function handleDeleteIncome(income: ServiceIncome) {
    if (!income.id) {
      return
    }

    const shouldDelete = window.confirm(
      `¿Eliminar el ingreso #${income.id} del ${income.date}?`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteServiceIncome(income.id)
    await reloadIncomes()
  }

  function handleCountryFilterChange(country: string) {
    setSelectedCountry(country || 'ALL')
    setSelectedCity('ALL')
    setSelectedPaymentType('ALL')
    setIncomePage(1)
  }

  function handleCityFilterChange(city: string) {
    setSelectedCity(city || 'ALL')
    setSelectedPaymentType('ALL')
    setIncomePage(1)
  }

  function handlePaymentTypeFilterChange(paymentType: string) {
    setSelectedPaymentType(paymentType || 'ALL')
    setIncomePage(1)
  }

  function handleDateFromChange(date: string) {
    setDateFrom(date)
    setIncomePage(1)
  }

  function handleDateToChange(date: string) {
    setDateTo(date)
    setIncomePage(1)
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
        backLabel="Ingresos"
        backTo="/income"
        eyebrow="Ingresos"
        title="Registros de ingresos"
      >
        <Link
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          to="/income"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nuevo ingreso
        </Link>
      </PageHeader>

      <CollapsibleFilters title="Filtros" storageKey="filters-open-income">
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
              Tipo de pago
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) =>
                handlePaymentTypeFilterChange(event.target.value)
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

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="size-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">
            Ingresos recientes
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {filteredIncomes.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              No hay ingresos con los filtros seleccionados.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {paginatedIncomes.map((income) => {
                const status = getIncomeStatus(income)
                const isClosedSeason = isLocationSeasonClosed(
                  income,
                  settings?.closedLocationSeasons,
                )

                return (
                  <li className="flex flex-col gap-3 p-4" key={income.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">
                            {getIncomeDisplayName(income)}
                          </p>
                          <span
                            className={[
                              'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                              getIncomeStatusClass(status),
                            ].join(' ')}
                          >
                            {incomeStatusLabels[status]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {income.actualDuration ?? income.duration} min ·{' '}
                          {income.percentage}% ·{' '}
                          {getPaymentTypeLabel(income.paymentType)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950">
                          {formatCurrency(
                            income.realGain,
                            income.currency as CurrencyCode,
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatCurrency(income.eurValue, 'EUR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-start">
                      {isClosedSeason ? (
                        <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-500">
                          Solo consulta
                        </span>
                      ) : (
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        onClick={() => handleDeleteIncome(income)}
                        type="button"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Eliminar
                      </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {filteredIncomes.length > INCOMES_PER_PAGE ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-500">
              Página {currentIncomePage} de {totalIncomePages} ·{' '}
              {filteredIncomes.length} registros
            </p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentIncomePage === 1}
                onClick={() =>
                  setIncomePage((currentPage) => Math.max(1, currentPage - 1))
                }
                type="button"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </button>
              <button
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentIncomePage === totalIncomePages}
                onClick={() =>
                  setIncomePage((currentPage) =>
                    Math.min(totalIncomePages, currentPage + 1),
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

export default IncomeListPage
