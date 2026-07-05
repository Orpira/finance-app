import { ChevronLeft, ChevronRight, Eye, Pencil, ReceiptText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import {
  deleteServiceIncome,
  listServiceIncomes,
  updateServiceIncome,
} from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import { listExpenses } from '../../services/expenseService'
import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import type { ServiceIncome, ServiceIncomeStatus, ServiceIncomeType } from '../../types/service'
import type { Expense } from '../../types/expense'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { getIncomeDisplayName } from '../../utils/activityLabels'
import { countries } from '../../utils/countries'
import { formatCurrency } from '../../utils/currency'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'
import { getIncomeDurationDisplay } from '../../utils/serviceDuration'
import {
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
} from '../../utils/usageMode'
import { getIncomeType, getIncomeTypeLabel, isServiceIncome } from '../../utils/incomeTypes'
import { canMarkAsReported, formatReportStatusMeta, getRecordReportBadge, toggleReportStatus } from '../../utils/reportStatus'
import { useDialog } from '../../components/dialogs/useDialog'

const INCOMES_PER_PAGE = 10
type ReportStatusFilter = 'ALL' | 'pending' | 'reported'

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

function filterIncomesByMode(
  incomes: ServiceIncome[],
  settings: AppSettings,
  activePeriodId?: number,
) {
  return incomes.filter(
    (income) =>
      recordBelongsToUsageMode(income, settings.usageMode) &&
      (isBasicMode(settings) ||
        (activePeriodId !== undefined &&
          (income.earningPeriodId === activePeriodId ||
            income.seasonPeriodId === activePeriodId))),
  )
}

function filterAdjustmentsByMode(expenses: Expense[], settings: AppSettings) {
  return expenses.filter(
    (expense) =>
      expense.type === 'ajuste' &&
      expense.relatedIncomeId !== undefined &&
      recordBelongsToUsageMode(expense, settings.usageMode),
  )
}

export function IncomeListPage() {
  const { alert, confirm } = useDialog()
  const { hidden } = useSensitiveValues()
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [relatedAdjustments, setRelatedAdjustments] = useState<Expense[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activePeriodId, setActivePeriodId] = useState<number>()
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL'>('ALL')
  const [selectedCity, setSelectedCity] = useState<string | 'ALL'>('ALL')
  const [selectedPaymentType, setSelectedPaymentType] =
    useState<string | 'ALL'>('ALL')
  const [selectedIncomeType, setSelectedIncomeType] =
    useState<ServiceIncomeType | 'ALL'>('ALL')
  const [selectedReportStatus, setSelectedReportStatus] =
    useState<ReportStatusFilter>('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [incomePage, setIncomePage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  const adjustmentsByIncomeId = useMemo(() => {
    const grouped = new Map<number, Expense[]>()
    relatedAdjustments.forEach((adjustment) => {
      if (adjustment.type !== 'ajuste' || adjustment.relatedIncomeId === undefined) return
      grouped.set(adjustment.relatedIncomeId, [
        ...(grouped.get(adjustment.relatedIncomeId) ?? []),
        adjustment,
      ])
    })
    return grouped
  }, [relatedAdjustments])

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
        const matchesIncomeType =
          selectedIncomeType === 'ALL' ||
          getIncomeType(income) === selectedIncomeType
        const matchesReportStatus =
          selectedReportStatus === 'ALL' ||
          Boolean(
            settings &&
              canMarkAsReported(income, settings.usageMode) &&
              getRecordReportBadge(income).reportStatusCode === selectedReportStatus,
          )

        return (
          matchesCountry &&
          matchesCity &&
          matchesPaymentType &&
          matchesIncomeType &&
          matchesReportStatus &&
          matchesDateFrom &&
          matchesDateTo
        )
      }),
    [dateFrom, dateTo, incomes, selectedCity, selectedCountry, selectedIncomeType, selectedPaymentType, selectedReportStatus, settings],
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
    if (!settings) {
      return
    }

    const currentIncomes = await listServiceIncomes({ newestFirst: true })
    setIncomes(filterIncomesByMode(currentIncomes, settings, activePeriodId))
  }

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentIncomes, currentExpenses, currentSettings, activePeriod] = await Promise.all([
        listServiceIncomes({ newestFirst: true }),
        listExpenses({ newestFirst: true }),
        getSettings(),
        getActiveEarningPeriod(),
      ])

      if (!isMounted) {
        return
      }

      setIncomes(filterIncomesByMode(currentIncomes, currentSettings, activePeriod?.id))
      setSettings(currentSettings)
      setActivePeriodId(activePeriod?.id)
      setRelatedAdjustments(filterAdjustmentsByMode(currentExpenses, currentSettings))
      setIsLoading(false)
    }

    loadInitialData()

    async function handleSettingsChanged(event: Event) {
      const nextSettings = (event as CustomEvent<AppSettings>).detail
      const [currentIncomes, currentExpenses, activePeriod] = await Promise.all([
        listServiceIncomes({ newestFirst: true }),
        listExpenses({ newestFirst: true }),
        getActiveEarningPeriod(),
      ])

      if (!isMounted) {
        return
      }

      const nextActivePeriodId = activePeriod?.id
      setSettings(nextSettings)
      setActivePeriodId(nextActivePeriodId)
      setIncomes(filterIncomesByMode(currentIncomes, nextSettings, nextActivePeriodId))
      setRelatedAdjustments(filterAdjustmentsByMode(currentExpenses, nextSettings))
      setSelectedIncomeType('ALL')
      setSelectedReportStatus('ALL')
      setIncomePage(1)
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      isMounted = false
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [])

  async function handleToggleReportStatus(income: ServiceIncome) {
    if (!income.id || !settings) {
      return
    }

    if (!canMarkAsReported(income, settings.usageMode)) {
      await alert({
        type: 'error',
        title: 'Acción no permitida',
        message: 'Solo los servicios del modo Profesional pueden marcarse como reportados.',
      })
      return
    }

    const reportBadge = getRecordReportBadge(income)
    const confirmationMessage = reportBadge.isReported
      ? '¿Quitar la marca de Reportado? El ingreso volverá a permitir modificaciones y eliminación.'
      : 'Al marcar este ingreso como reportado quedará bloqueado y no podrá modificarse ni eliminarse. ¿Deseas continuar?'

    const confirmed = await confirm({
      title: reportBadge.isReported ? 'Quitar marca de Reportado' : 'Marcar ingreso como reportado',
      message: confirmationMessage,
      confirmLabel: reportBadge.isReported ? 'Quitar marca' : 'Marcar como reportado',
      confirmTone: reportBadge.isReported ? 'primary' : 'warning',
    })
    if (!confirmed) {
      return
    }

    try {
      const nextRecord = toggleReportStatus(income, settings.usageMode)
      await updateServiceIncome(income.id, {
        reportStatusCode: nextRecord.reportStatusCode,
        reportStatusLabel: nextRecord.reportStatusLabel,
        reportedAt: nextRecord.reportedAt,
      })
      await reloadIncomes()
    } catch (error: unknown) {
      await alert({
        type: 'error',
        title: 'No se pudo actualizar el ingreso',
        message: error instanceof Error ? error.message : 'No se pudo actualizar el estado del ingreso.',
      })
    }
  }

  async function handleDeleteIncome(income: ServiceIncome) {
    if (!income.id) {
      return
    }

    const shouldDelete = await confirm({
      title: 'Eliminar ingreso',
      message: `¿Eliminar el ingreso #${income.id} del ${income.date}?`,
      confirmLabel: 'Eliminar',
      confirmTone: 'danger',
    })

    if (!shouldDelete) {
      return
    }

    try {
      await deleteServiceIncome(income.id)
      await reloadIncomes()
    } catch (error: unknown) {
      await alert({
        type: 'error',
        title: 'No se pudo eliminar el ingreso',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el ingreso.',
      })
    }
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
        backLabel="Inicio"
        backTo="/"
        eyebrow="Ingresos"
        title="Registros de ingresos"
      >
        <Link
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          to="/income/nuevo"
        >
          + Nuevo Ingreso
        </Link>
      </PageHeader>

      <CollapsibleFilters title="Filtros" storageKey="filters-open-income">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

          {settings && !isBasicMode(settings) && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Clase de ingreso</span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setSelectedIncomeType(event.target.value as ServiceIncomeType | 'ALL')
                  setIncomePage(1)
                }}
                value={selectedIncomeType}
              >
                <option value="ALL">Todas las clases</option>
                <option value="ingreso">Servicios</option>
                <option value="ajuste">Ajustes</option>
                <option value="otro">Otros ingresos</option>
              </select>
            </label>
          )}

          {settings && !isBasicMode(settings) && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Estado de reporte</span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  setSelectedReportStatus(event.target.value as ReportStatusFilter)
                  setIncomePage(1)
                }}
                value={selectedReportStatus}
              >
                <option value="ALL">Todos</option>
                <option value="pending">Pendientes</option>
                <option value="reported">Reportados</option>
              </select>
            </label>
          )}

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
              {settings && isBasicMode(settings)
                ? 'No hay ingresos con los filtros seleccionados.'
                : !activePeriodId
                  ? 'No hay ingresos recientes porque no existe una temporada activa.'
                  : 'No hay ingresos de la temporada activa con los filtros seleccionados.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {paginatedIncomes.map((income) => {
                const status = getIncomeStatus(income)
                const isService = isServiceIncome(income)
                const incomeAdjustments = income.id
                  ? adjustmentsByIncomeId.get(income.id) ?? []
                  : []
                const isClosedSeason =
                  requiresSeason(settings ?? undefined) &&
                  isLocationSeasonClosed(
                    income,
                    settings?.closedLocationSeasons,
                  )
                const reportBadge = getRecordReportBadge(income)
                const reportMeta = formatReportStatusMeta(income)
                const canReport = Boolean(
                  settings && canMarkAsReported(income, settings.usageMode),
                )

                return (
                  <li className="flex flex-col gap-3 p-4" key={income.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">
                            {getIncomeDisplayName(income)}
                          </p>
                          {!isService && (
                            <span className="inline-flex rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
                              {getIncomeTypeLabel(income)}
                            </span>
                          )}
                          {incomeAdjustments.length > 0 && (
                            <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                              Afectado por ajuste · {incomeAdjustments.length}{' '}
                              {incomeAdjustments.length === 1 ? 'ajuste aplicado' : 'ajustes aplicados'}
                            </span>
                          )}
                          {reportBadge.isReported && (
                            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              {reportBadge.label}
                            </span>
                          )}
                          {!isBasicMode(settings ?? undefined) && isService && <span
                            className={[
                              'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                              getIncomeStatusClass(status),
                            ].join(' ')}
                          >
                            {incomeStatusLabels[status]}
                          </span>}
                        </div>
                        {!isBasicMode(settings ?? undefined) && isService && <p className="mt-1 text-sm text-slate-500">
                          {getIncomeDurationDisplay(income)} ·{' '}
                          {income.percentage}% ·{' '}
                          {getPaymentTypeLabel(income.paymentType)}
                        </p>}
                        {income.notes && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                            {income.notes}
                          </p>
                        )}
                        {reportMeta && (
                          <p className="mt-2 text-sm font-medium text-emerald-700">{reportMeta}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950">
                          <SensitiveAmount hidden={hidden} value={formatCurrency(
                            income.realGain,
                            income.currency as CurrencyCode,
                          )} />
                        </p>
                        {!isBasicMode(settings ?? undefined) && <p className="mt-1 text-sm text-slate-500">
                          <SensitiveAmount hidden={hidden} value={formatCurrency(income.eurValue, 'EUR')} />
                        </p>}
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-start gap-2">
                      <Link
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-sky-200 px-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                        to={`/income/${income.id}`}
                      >
                        <Eye className="size-4" aria-hidden="true" />
                        Ver detalle
                      </Link>
                      {isClosedSeason ? (
                        <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:text-slate-200!">
                          Solo consulta
                        </span>
                      ) : reportBadge.isReported ? (
                        canReport ? (
                        <button
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                          onClick={() => handleToggleReportStatus(income)}
                          type="button"
                        >
                          Quitar marca
                        </button>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:text-slate-200!">
                            Solo consulta
                          </span>
                        )
                      ) : (
                      <>
                      <Link
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        to={`/income/${income.id}/editar`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                        Modificar
                      </Link>
                      {canReport && <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                        onClick={() => handleToggleReportStatus(income)}
                        type="button"
                      >
                        Marcar como reportado
                      </button>}
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        onClick={() => handleDeleteIncome(income)}
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
