import { CheckCircle2, CheckSquare, ChevronLeft, ChevronRight, Pencil, Plus, ReceiptText, RotateCcw, Square, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { ActionableEmptyState } from '../../components/ActionableEmptyState'
import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { MarkIncomeReportedDialog, type MarkIncomeReportedValues } from '../../components/income/MarkIncomeReportedDialog'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import {
  deleteServiceIncome,
  listServiceIncomes,
} from '../../services/incomeService'
import {
  markIncomeAsPending,
  markIncomeAsReported,
  markMultipleIncomesAsReported,
} from '../../services/incomeReport.service'
import { getSettings } from '../../services/settingsService'
import { listExpenses } from '../../services/expenseService'
import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import type { ServiceIncome, ServiceIncomeStatus, ServiceIncomeType } from '../../types/service'
import type { Expense } from '../../types/expense'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { getIncomeDisplayName } from '../../utils/activityLabels'
import { countries } from '../../utils/countries'
import { formatCurrency } from '../../utils/currency'
import { getFinancialListEmptyReason } from '../../utils/financialListEmptyState'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'
import { getIncomeDurationDisplay } from '../../utils/serviceDuration'
import {
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
} from '../../utils/usageMode'
import { getIncomeType, getIncomeTypeLabel, isServiceIncome } from '../../utils/incomeTypes'
import { canMarkAsReported, formatReportStatusMeta, getRecordReportBadge } from '../../utils/reportStatus'
import { useDialog } from '../../components/dialogs/useDialog'
import { getIncomeListModeFeatures } from './incomeListModeFeatures'

const INCOMES_PER_PAGE = 10
type ReportStatusFilter = 'ALL' | 'unreviewed' | 'pending' | 'reported'

function parseReportStatusFilter(value: string | null): ReportStatusFilter {
  return value === 'unreviewed' || value === 'pending' || value === 'reported' ? value : 'ALL'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00`),
  )
}

function formatRegistrationTime(value?: string) {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/* function formatDateTimeLabel(value?: string) {
  if (!value) {
    return '—'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return '—'
  }

  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(parsedDate)
} */

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
  const [searchParams, setSearchParams] = useSearchParams()
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
  const selectedReportStatus = useMemo(
    () => parseReportStatusFilter(searchParams.get('reportStatus')),
    [searchParams],
  )
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [incomePage, setIncomePage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIncomeIds, setSelectedIncomeIds] = useState<Set<number>>(new Set())
  const [incomeBeingReported, setIncomeBeingReported] = useState<ServiceIncome | null>(null)
  const [isBulkReportDialogOpen, setIsBulkReportDialogOpen] = useState(false)
  const incomeListModeFeatures = getIncomeListModeFeatures(settings)

  function handleReportStatusFilterChange(value: ReportStatusFilter) {
    setIncomePage(1)
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === 'ALL') {
          next.delete('reportStatus')
        } else {
          next.set('reportStatus', value)
        }
        return next
      },
      { replace: true },
    )
  }

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

  // Se agrupa por serviceDate (income.date), nunca por la fecha de creación.
  const groupedPaginatedIncomes = useMemo(() => {
    const groups: Array<{ date: string; incomes: ServiceIncome[] }> = []

    paginatedIncomes.forEach((income) => {
      const lastGroup = groups.at(-1)
      if (lastGroup && lastGroup.date === income.date) {
        lastGroup.incomes.push(income)
      } else {
        groups.push({ date: income.date, incomes: [income] })
      }
    })

    return groups
  }, [paginatedIncomes])

  const selectableIncomeIds = useMemo(
    () =>
      paginatedIncomes
        .filter(
          (income) =>
            income.id !== undefined &&
            settings &&
            canMarkAsReported(income, settings.usageMode) &&
            !getRecordReportBadge(income).isReported,
        )
        .map((income) => income.id as number),
    [paginatedIncomes, settings],
  )
  const allVisibleSelected =
    selectableIncomeIds.length > 0 &&
    selectableIncomeIds.every((id) => selectedIncomeIds.has(id))

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
      setSelectedIncomeIds(new Set())
      setIncomePage(1)
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        next.delete('reportStatus')
        return next
      }, { replace: true })
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      isMounted = false
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [setSearchParams])

  function handleRequestMarkAsReported(income: ServiceIncome) {
    if (!income.id || !settings || !canMarkAsReported(income, settings.usageMode)) {
      return
    }

    setIncomeBeingReported(income)
  }

  async function handleConfirmMarkAsReported(values: MarkIncomeReportedValues) {
    if (!incomeBeingReported?.id) {
      return
    }

    try {
      const reportedIncomeId = incomeBeingReported.id
      await markIncomeAsReported(reportedIncomeId, {
        reportedAt: `${values.reportedAt}T00:00:00.000Z`,
        reportReference: values.reportReference,
        reportNotes: values.reportNotes,
      })
      setIncomeBeingReported(null)
      setSelectedIncomeIds((current) => {
        if (!current.has(reportedIncomeId)) return current
        const next = new Set(current)
        next.delete(reportedIncomeId)
        return next
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

  async function handleReturnToPending(income: ServiceIncome) {
    if (!income.id || !settings || !canMarkAsReported(income, settings.usageMode)) {
      return
    }

    const confirmed = await confirm({
      title: 'Devolver a pendiente',
      message: '¿Quitar la marca de Reportado? El ingreso volverá a permitir modificaciones y eliminación.',
      confirmLabel: 'Devolver a pendiente',
      confirmTone: 'primary',
    })
    if (!confirmed) {
      return
    }

    try {
      await markIncomeAsPending(income.id)
      await reloadIncomes()
    } catch (error: unknown) {
      await alert({
        type: 'error',
        title: 'No se pudo actualizar el ingreso',
        message: error instanceof Error ? error.message : 'No se pudo actualizar el estado del ingreso.',
      })
    }
  }

  function handleToggleSelectIncome(incomeId: number) {
    setSelectedIncomeIds((current) => {
      const next = new Set(current)
      if (next.has(incomeId)) {
        next.delete(incomeId)
      } else {
        next.add(incomeId)
      }
      return next
    })
  }

  function handleToggleSelectAllVisible(selectableIds: number[]) {
    setSelectedIncomeIds((current) => {
      const allSelected = selectableIds.length > 0 && selectableIds.every((id) => current.has(id))
      if (allSelected) {
        const next = new Set(current)
        selectableIds.forEach((id) => next.delete(id))
        return next
      }
      return new Set([...current, ...selectableIds])
    })
  }

  async function handleConfirmBulkMarkAsReported(values: MarkIncomeReportedValues) {
    const ids = Array.from(selectedIncomeIds)
    const result = await markMultipleIncomesAsReported(ids, {
      reportedAt: `${values.reportedAt}T00:00:00.000Z`,
      reportReference: values.reportReference,
      reportNotes: values.reportNotes,
    })

    setIsBulkReportDialogOpen(false)
    setSelectedIncomeIds(new Set())
    await reloadIncomes()

    if (result.failed.length > 0) {
      await alert({
        type: result.succeeded.length > 0 ? 'warning' : 'error',
        title: 'Algunos ingresos no se pudieron marcar',
        message: `${result.succeeded.length} ingreso(s) marcados como reportados. ${result.failed.length} no se pudieron actualizar.`,
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

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setSelectedCountry('ALL')
    setSelectedCity('ALL')
    setSelectedPaymentType('ALL')
    setSelectedIncomeType('ALL')
    handleReportStatusFilterChange('ALL')
  }

  if (isLoading) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  const emptyReason = getFinancialListEmptyReason({
    totalRecords: incomes.length,
    requiresActiveSeason: Boolean(settings && requiresSeason(settings)),
    hasActiveSeason: activePeriodId !== undefined,
  })

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
                onChange={(event) =>
                  handleReportStatusFilterChange(event.target.value as ReportStatusFilter)
                }
                value={selectedReportStatus}
              >
                <option value="ALL">Todos</option>
                <option value="unreviewed">Sin revisar</option>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-5 text-emerald-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-950">
              Ingresos recientes
            </h2>
          </div>
          {selectableIncomeIds.length > 0 && (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => handleToggleSelectAllVisible(selectableIncomeIds)}
              type="button"
            >
              {allVisibleSelected ? (
                <CheckSquare className="size-4" aria-hidden="true" />
              ) : (
                <Square className="size-4" aria-hidden="true" />
              )}
              Seleccionar visibles
            </button>
          )}
        </div>

        {selectedIncomeIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
              {selectedIncomeIds.size} {selectedIncomeIds.size === 1 ? 'ingreso seleccionado' : 'ingresos seleccionados'}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-300 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-200"
                onClick={() => setSelectedIncomeIds(new Set())}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="inline-flex h-9 items-center justify-center rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800"
                onClick={() => setIsBulkReportDialogOpen(true)}
                type="button"
              >
                Marcar {selectedIncomeIds.size} como reportados
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {filteredIncomes.length === 0 ? (
            emptyReason === 'no-active-season' ? (
              <ActionableEmptyState
                action={{ label: 'Ir a Temporadas', to: '/temporadas' }}
                description="Inicia una temporada para poder registrar y consultar ingresos profesionales."
                title="No hay una temporada activa"
              />
            ) : emptyReason === 'no-records' ? (
              <ActionableEmptyState
                action={{ label: 'Registrar ingreso', to: '/income/nuevo' }}
                description="Añade tu primer ingreso para comenzar a construir el historial financiero."
                title="Aún no hay ingresos"
              />
            ) : (
              <ActionableEmptyState
                action={{ label: 'Limpiar filtros', onClick: clearFilters }}
                description="Restablece las fechas, ubicaciones, tipos y estados para volver a ver tus ingresos."
                title="Ningún ingreso coincide con los filtros"
              />
            )
          ) : (
            groupedPaginatedIncomes.map((group) => (
              <div key={group.date}>
                <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  Ingresos del {formatDate(group.date)}
                </p>
                <ul className="divide-y divide-slate-200">
                  {group.incomes.map((income) => {
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
                const isSelectable = income.id !== undefined && canReport && !reportBadge.isReported
                const isSelected = income.id !== undefined && selectedIncomeIds.has(income.id)
                const registrationTime = formatRegistrationTime(income.createdAt)

                return (
                  <li className="flex flex-col gap-3 p-4" key={income.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        {isSelectable && (
                          <input
                            aria-label={`Seleccionar ${getIncomeDisplayName(income)}`}
                            checked={isSelected}
                            className="mt-1 size-4 shrink-0 rounded border-slate-300 text-emerald-700 focus:ring-emerald-500"
                            onChange={() => income.id !== undefined && handleToggleSelectIncome(income.id)}
                            type="checkbox"
                          />
                        )}
                        <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">
                            {registrationTime && `${registrationTime} · `}
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
                          {canReport && (
                            <span
                              className={[
                                'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold',
                                reportBadge.isReported
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : reportBadge.isUnreviewed
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-600',
                              ].join(' ')}
                            >
                              {reportBadge.label}
                            </span>
                          )}
                          {incomeListModeFeatures.showOperationalStatus && isService && <span
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
                          {/* {income.percentage}% ·{' '} */}
                          {getPaymentTypeLabel(income.paymentType)}
                        </p>}
                        {incomeListModeFeatures.showAdditionals && isService && Boolean(income.additionalsTotal) && (
                          <p className="mt-1 text-sm text-emerald-700">
                            + Adicionales: <SensitiveAmount hidden={hidden} value={formatCurrency(
                              income.additionalsTotal as number,
                              income.currency as CurrencyCode,
                            )} />
                          </p>
                        )}
                        {/* <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Ingreso: {formatDate(income.date)} · Creado: {formatDateTimeLabel(income.createdAt)} · Reportado: {reportBadge.isReported ? formatDateTimeLabel(income.reportedAt) : '—'}
                        </p> */} 
                        {income.notes && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                            {income.notes}
                          </p>
                        )}
                        {reportMeta && (
                          <p className="mt-2 text-sm font-medium text-emerald-700">{reportMeta}</p>
                        )}
                        {reportBadge.isReported && (reportBadge.reportReference || reportBadge.reportNotes) && (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {reportBadge.reportReference && <>Referencia: {reportBadge.reportReference}. </>}
                            {reportBadge.reportNotes && <>Nota: {reportBadge.reportNotes}</>}
                          </p>
                        )}
                        </div>
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
                      
                      {isClosedSeason ? (
                        <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:text-slate-200!">
                          Solo consulta
                        </span>
                      ) : reportBadge.isReported ? (
                        canReport ? (
                        <button
                          aria-label="Devolver a pendiente"
                          className="inline-flex size-10 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
                          onClick={() => handleReturnToPending(income)}
                          title="Devolver a pendiente"
                          type="button"
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                        </button>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:text-slate-200!">
                            Solo consulta
                          </span>
                        )
                      ) : (
                      <>
                      <Link
                        aria-label="Modificar"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 transition hover:bg-slate-50"
                        title="Modificar"
                        to={`/income/${income.id}/editar`}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Link>
                      {incomeListModeFeatures.showAdditionals && isService && (
                        <Link
                          aria-label="Adicional"
                          className="inline-flex size-10 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
                          title="Añadir adicional"
                          to={`/income/${income.id}/editar`}
                        >
                          <Plus className="size-4" aria-hidden="true" />
                        </Link>
                      )}
                      {canReport && <button
                        aria-label="Marcar como reportado"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50"
                        onClick={() => handleRequestMarkAsReported(income)}
                        title="Marcar como reportado"
                        type="button"
                      >
                        <CheckCircle2 className="size-4" aria-hidden="true" />
                      </button>}
                      <button
                        aria-label="Eliminar"
                        className="inline-flex size-10 items-center justify-center rounded-md border border-rose-200 text-rose-700 transition hover:bg-rose-50"
                        onClick={() => handleDeleteIncome(income)}
                        title="Eliminar"
                        type="button"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </button>
                      </>
                      )}
                    </div>
                  </li>
                )
                  })}
                </ul>
              </div>
            ))
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

      {incomeBeingReported !== null && (
        <MarkIncomeReportedDialog
          message={`${getIncomeDisplayName(incomeBeingReported)} quedará bloqueado para edición y eliminación.`}
          onCancel={() => setIncomeBeingReported(null)}
          onConfirm={handleConfirmMarkAsReported}
          open
          title="Marcar ingreso como reportado"
        />
      )}

      {isBulkReportDialogOpen && (
        <MarkIncomeReportedDialog
          confirmLabel={`Marcar ${selectedIncomeIds.size} como reportados`}
          message={`Vas a marcar ${selectedIncomeIds.size} ingreso(s) como reportados. Quedarán bloqueados para edición y eliminación. ¿Deseas continuar?`}
          onCancel={() => setIsBulkReportDialogOpen(false)}
          onConfirm={handleConfirmBulkMarkAsReported}
          open
          title="Marcar ingresos seleccionados como reportados"
        />
      )}
    </section>
  )
}

export default IncomeListPage
