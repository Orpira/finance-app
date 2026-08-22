import { CalendarRange, Download, Eye, FileSpreadsheet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDialog } from '../../components/dialogs/useDialog'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import { SeasonGoalCard } from '../../components/seasons/SeasonGoalCard'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import {
  groupIncomesByDate,
} from '../../services/incomeReport.service'
import {
  buildIncomeDateTableHtml,
  buildIncomeDateText,
} from '../../services/incomeReportPresentation'
import { getSettings } from '../../services/settingsService'
import { getSeasonGoalProgress, listEarningPeriods } from '../../services/earningPeriodService'
import { buildBalanceReport } from '../../services/balanceReportService'
import { runFinancialEngineShadowMode } from '../../services/financialEngineShadowMode'
import { groupReportableIncomesByPaymentType } from '../../services/paymentTypeReportService'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { isBasicMode, recordBelongsToUsageMode } from '../../utils/usageMode'
import { getExpenseDisplayName, getIncomeDisplayName } from '../../utils/activityLabels'
import {
  formatCurrency,
  getCurrentMonthRange,
  getCurrentWeekRange,
  getCurrentYearRange,
} from '../../utils/currency'
import { countries, getCountryCurrency } from '../../utils/countries'
import {
  getStoredExpenseValue,
  getStoredIncomeValue,
} from '../../utils/financeStats'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'
import {
  getIncomePaymentTypeLabel,
  getIncomeTypeLabel,
  isServiceIncome,
} from '../../utils/incomeTypes'
import { getIncomeDurationDisplay } from '../../utils/serviceDuration'
import { canMarkAsReported, getRecordReportBadge } from '../../utils/reportStatus'
import {
  validateReportConfiguration,
  type ConfigurableReportFormat,
  type ConfigurableReportStatus,
} from '../../services/reportConfiguration'

type Period = 'week' | 'month' | 'year'
type ReportKind = 'income' | 'expense' | 'paymentType' | 'balance'

const periods: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
]

const baseReportCards: Array<{
  description: string
  kind: ReportKind
  title: string
}> = [
  {
    description: 'Detalle de ingresos con filtros de fecha, país, ciudad y tipo de pago.',
    kind: 'income',
    title: 'Reporte de ingresos',
  },
  {
    description: 'Detalle de egresos con filtros de fecha, país, ciudad y categoría.',
    kind: 'expense',
    title: 'Reporte de egresos',
  },
  {
    description: 'Ingresos agrupados por tipo de pago, país y ciudad.',
    kind: 'paymentType',
    title: 'Reporte por tipo de pago',
  },
]

function getReportCards(isBasicUser: boolean) {
  return [
    ...baseReportCards,
    {
      description: isBasicUser
        ? 'Balance general por rango de fechas, con impacto de ajustes separado.'
        : 'Balance por temporadas, con impacto de ajustes separado y trazable.',
      kind: 'balance' as const,
      title: isBasicUser ? 'Balance general' : 'Balance por temporadas',
    },
  ]
}

function getPeriodRange(period: Period) {
  if (period === 'week') {
    return getCurrentWeekRange()
  }

  if (period === 'year') {
    return getCurrentYearRange()
  }

  return getCurrentMonthRange()
}

function getCountryLabel(code: string): string {
  const country = countries.find((countryOption) => countryOption.value === code)

  return country?.label || code
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatExportDateTime(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function formatSeasonDate(value?: string) {
  if (!value) return 'Sin definir'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

function getExpenseValue(expense: Expense, currency: CurrencyCode) {
  return getStoredExpenseValue(expense, currency)
}

function getIncomeValue(income: ServiceIncome, currency: CurrencyCode) {
  return getStoredIncomeValue(income, currency)
}

function getCountrySortLabel(country: string) {
  return country === 'SIN_PAIS' ? 'Sin país' : getCountryLabel(country)
}

function getCityLabel(city: string) {
  return city || 'Sin ciudad'
}

function buildPrintableDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { margin: 18mm; }
      body {
        color: #0f172a;
        font-family: Inter, Arial, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        margin: 0;
      }
      h1 { font-size: 22px; margin: 0 0 6px; }
      h2 { border-bottom: 1px solid #cbd5e1; font-size: 16px; margin: 24px 0 10px; padding-bottom: 6px; }
      h3 { color: #0f766e; font-size: 13px; margin: 16px 0 8px; }
      .meta { color: #475569; margin-bottom: 18px; }
      .summary {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        display: grid;
        gap: 6px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 12px 0 18px;
        padding: 12px;
      }
      .summary strong { display: block; font-size: 15px; }
      table { border-collapse: collapse; margin-bottom: 12px; width: 100%; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 6px; text-align: left; vertical-align: top; }
      th { background: #f1f5f9; color: #334155; font-size: 11px; text-transform: uppercase; }
      tfoot td { background: #f8fafc; border-top: 2px solid #94a3b8; font-weight: 700; }
      td.amount, th.amount { text-align: right; white-space: nowrap; }
      .income-table-scroll { overflow-x: auto; width: 100%; }
      .income-date-table { min-width: 760px; table-layout: fixed; }
      .income-date-table .income-name { width: 38%; }
      .record-meta { color: #64748b; display: block; font-size: 10px; margin-top: 3px; }
      @media print {
        .income-table-scroll { overflow: visible; }
        .income-date-table { font-size: 9px; min-width: 0; }
        .income-date-table th, .income-date-table td { overflow-wrap: anywhere; padding: 5px 4px; }
        .income-date-table thead { display: table-header-group; }
        .income-date-table tfoot { display: table-row-group; }
        .income-date-table tr { break-inside: avoid; page-break-inside: avoid; }
      }
      .subtotal {
        background: #ecfdf5;
        border: 1px solid #a7f3d0;
        border-radius: 6px;
        color: #065f46;
        font-weight: 700;
        margin: 8px 0 12px;
        padding: 8px 10px;
      }
      .empty { color: #64748b; font-style: italic; }
    </style>
  </head>
  <body>${body}</body>
</html>`
}

export function ReportsPage() {
  const { alert } = useDialog()
  const navigate = useNavigate()
  const initialRange = useMemo(() => getCurrentMonthRange(), [])
  const [period, setPeriod] = useState<Period>('month')
  const [dateFrom, setDateFrom] = useState(initialRange.from)
  const [dateTo, setDateTo] = useState(initialRange.to)
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL'>('ALL')
  const [selectedCity, setSelectedCity] = useState<string | 'ALL'>('ALL')
  const [selectedPaymentType, setSelectedPaymentType] =
    useState<string | 'ALL'>('ALL')
  const [selectedCategory, setSelectedCategory] = useState<string | 'ALL'>('ALL')
  const [selectedReportKind, setSelectedReportKind] = useState<ReportKind>('balance')
  const [selectedCurrency, setSelectedCurrency] = useState<CurrencyCode | 'AUTO'>('AUTO')
  const [selectedReportStatus, setSelectedReportStatus] = useState<ConfigurableReportStatus>('ALL')
  const [selectedFormat, setSelectedFormat] = useState<ConfigurableReportFormat>('pdf')
  const [pendingGeneration, setPendingGeneration] = useState(false)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [periodIncomes, setPeriodIncomes] = useState<ServiceIncome[]>([])
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([])
  const [traceIncomes, setTraceIncomes] = useState<ServiceIncome[]>([])
  const [traceAdjustments, setTraceAdjustments] = useState<Expense[]>([])
  const [loadError, setLoadError] = useState('')
  const [seasons, setSeasons] = useState<EarningPeriod[]>([])
  const [selectedSeason, setSelectedSeason] = useState<string>('ALL')
  const isBasicUser = isBasicMode(settings ?? undefined)
  const activeUsageMode = settings?.usageMode ?? 'professional'
  const reportCards = useMemo(() => getReportCards(isBasicUser), [isBasicUser])

  useEffect(() => {
    let isMounted = true

    async function loadReports() {
      try {
        setLoadError('')
        const range = {
          from: dateFrom || undefined,
          to: dateTo || undefined,
        }
        const [
          currentSettings,
          currentIncomes,
          currentExpenses,
          currentSeasons,
          allIncomes,
          allExpenses,
        ] =
          await Promise.all([
            getSettings(),
            listServiceIncomes({ ...range, newestFirst: true }),
            listExpenses({ ...range, newestFirst: true }),
            listEarningPeriods(),
            listServiceIncomes({ newestFirst: true }),
            listExpenses({ newestFirst: true }),
          ])

        if (!isMounted) {
          return
        }

        setSettings(currentSettings)
        setPeriodIncomes(
          currentIncomes.filter((income) =>
            recordBelongsToUsageMode(income, currentSettings.usageMode),
          ),
        )
        setPeriodExpenses(
          currentExpenses.filter((expense) =>
            recordBelongsToUsageMode(expense, currentSettings.usageMode),
          ),
        )
        setTraceIncomes(
          allIncomes.filter((income) =>
            recordBelongsToUsageMode(income, currentSettings.usageMode),
          ),
        )
        setTraceAdjustments(
          allExpenses.filter(
            (expense) =>
              expense.type === 'ajuste' &&
              recordBelongsToUsageMode(expense, currentSettings.usageMode),
          ),
        )
        setSeasons(currentSeasons)
      } catch {
        if (isMounted) {
          setLoadError('No se pudieron cargar los reportes.')
        }
      }
    }

    loadReports()

    return () => {
      isMounted = false
    }
  }, [dateFrom, dateTo])

  const availableCountries = useMemo(() => {
    const countryCodes = new Set<CountryCode>()

    periodIncomes.forEach((income) => {
      if (income.country) {
        countryCodes.add(income.country as CountryCode)
      }
    })
    periodExpenses.forEach((expense) => {
      if (expense.country) {
        countryCodes.add(expense.country as CountryCode)
      }
    })

    return Array.from(countryCodes).sort()
  }, [periodExpenses, periodIncomes])

  const availableCities = useMemo(() => {
    const cityNames = new Set<string>()

    ;[...periodIncomes, ...periodExpenses].forEach((item) => {
      const matchesCountry =
        selectedCountry === 'ALL' || item.country === selectedCountry

      if (item.city && matchesCountry) {
        cityNames.add(item.city)
      }
    })

    return Array.from(cityNames).sort((firstCity, secondCity) =>
      firstCity.localeCompare(secondCity, 'es'),
    )
  }, [periodExpenses, periodIncomes, selectedCountry])

  const availablePaymentTypes = useMemo(() => {
    const paymentTypes = new Set<string>()

    periodIncomes.forEach((income) => {
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
  }, [periodIncomes, selectedCity, selectedCountry])

  const availableCategories = useMemo(() => {
    const categories = new Set<string>()

    periodExpenses.forEach((expense) => {
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
  }, [periodExpenses, selectedCity, selectedCountry])

  const primaryCurrencyFromSettings = settings?.defaultCurrency ?? 'EUR'

  const primaryCurrency = useMemo(() => {
    if (selectedCurrency !== 'AUTO') return selectedCurrency
    if (selectedCountry === 'ALL') {
      return primaryCurrencyFromSettings
    }

    return (
      getCountryCurrency(selectedCountry as CountryCode) ??
      primaryCurrencyFromSettings
    )
  }, [primaryCurrencyFromSettings, selectedCountry, selectedCurrency])

  const incomes = useMemo(
    () =>
      periodIncomes.filter((income) => {
        const matchesCountry =
          selectedCountry === 'ALL' || income.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || income.city === selectedCity
        const matchesPaymentType =
          selectedPaymentType === 'ALL' ||
          income.paymentType === selectedPaymentType

        const matchesSeason = selectedSeason === 'ALL' || String(income.earningPeriodId) === selectedSeason
        const badge = getRecordReportBadge(income)
        const matchesStatus = selectedReportStatus === 'ALL' ||
          (selectedReportStatus === 'reported' ? badge.isReported : !badge.isReported)
        return matchesCountry && matchesCity && matchesPaymentType && matchesSeason && matchesStatus
      }),
    [periodIncomes, selectedCity, selectedCountry, selectedPaymentType, selectedReportStatus, selectedSeason],
  )

  const expenses = useMemo(
    () =>
      periodExpenses.filter((expense) => {
        const matchesCountry =
          selectedCountry === 'ALL' || expense.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || expense.city === selectedCity
        const matchesCategory =
          selectedCategory === 'ALL' || expense.category === selectedCategory

        const matchesSeason = selectedSeason === 'ALL' || String(expense.earningPeriodId) === selectedSeason
        const badge = getRecordReportBadge(expense)
        const matchesStatus = selectedReportStatus === 'ALL' ||
          (selectedReportStatus === 'reported' ? badge.isReported : !badge.isReported)
        return matchesCountry && matchesCity && matchesCategory && matchesSeason && matchesStatus
      }),
    [periodExpenses, selectedCategory, selectedCity, selectedCountry, selectedReportStatus, selectedSeason],
  )

  const balanceReport = useMemo(() => {
    const legacyBalanceReport = buildBalanceReport({
        incomes,
        expenses,
        currency: primaryCurrency,
      })

    return runFinancialEngineShadowMode({
      incomes,
      expenses,
      currency: primaryCurrency,
      usageMode: activeUsageMode,
      earningPeriodId:
        selectedSeason === 'ALL' ? undefined : Number(selectedSeason),
      legacyBalanceReport,
      scope: 'reports.balance',
    })
  }, [activeUsageMode, expenses, incomes, primaryCurrency, selectedSeason])

  const selectedSeasonRecord = useMemo(
    () => seasons.find((season) => String(season.id) === selectedSeason),
    [seasons, selectedSeason],
  )
  const selectedSeasonGoalProgress = useMemo(() => {
    if (!selectedSeasonRecord?.id) return null

    const achieved = traceIncomes
      .filter(
        (income) =>
          income.earningPeriodId === selectedSeasonRecord.id ||
          income.seasonPeriodId === selectedSeasonRecord.id,
      )
      .reduce((total, income) => total + income.realGain, 0)

    return getSeasonGoalProgress(selectedSeasonRecord, achieved)
  }, [selectedSeasonRecord, traceIncomes])

  const incomesById = useMemo(
    () => new Map(traceIncomes.flatMap((income) => income.id ? [[income.id, income] as const] : [])),
    [traceIncomes],
  )
  const adjustmentsByIncomeId = useMemo(() => {
    const counts = new Map<number, number>()
    traceAdjustments.forEach((expense) => {
      if (expense.type === 'ajuste' && expense.relatedIncomeId !== undefined) {
        counts.set(expense.relatedIncomeId, (counts.get(expense.relatedIncomeId) ?? 0) + 1)
      }
    })
    return counts
  }, [traceAdjustments])

  function handlePeriodChange(nextPeriod: Period) {
    const nextRange = getPeriodRange(nextPeriod)

    setPeriod(nextPeriod)
    setDateFrom(nextRange.from)
    setDateTo(nextRange.to)
  }

  function handleCountryChange(country: string) {
    setSelectedCountry(country || 'ALL')
    setSelectedCity('ALL')
    setSelectedPaymentType('ALL')
    setSelectedCategory('ALL')
  }

  function handleCityChange(city: string) {
    setSelectedCity(city || 'ALL')
    setSelectedPaymentType('ALL')
    setSelectedCategory('ALL')
  }

  function buildReportHeader(title: string, total: number, count: number) {
    const countryLabel =
      selectedCountry === 'ALL' ? 'Todos los países' : getCountryLabel(selectedCountry)
    const cityLabel = selectedCity === 'ALL' ? 'Todas las ciudades' : selectedCity
    const filters = [
      `Período: ${dateFrom || '-'} - ${dateTo || '-'}`,
      `País: ${countryLabel}`,
      `Ciudad: ${cityLabel}`,
      selectedPaymentType !== 'ALL'
        ? `Tipo de pago: ${getPaymentTypeLabel(selectedPaymentType)}`
        : '',
      selectedCategory !== 'ALL' ? `Categoría: ${selectedCategory}` : '',
    ]
      .filter(Boolean)
      .map((filter) => `<span>${escapeHtml(filter)}</span>`)
      .join(' · ')

    return `
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${filters}</div>
      <div class="summary">
        <div><span>Registros</span><strong>${count}</strong></div>
        <div><span>Total</span><strong>${escapeHtml(formatCurrency(total, primaryCurrency))}</strong></div>
      </div>
    `
  }

  function buildReportTextHeader(title: string, total: number, count: number) {
    const countryLabel =
      selectedCountry === 'ALL' ? 'Todos los países' : getCountryLabel(selectedCountry)
    const cityLabel = selectedCity === 'ALL' ? 'Todas las ciudades' : selectedCity
    const filters = [
      `Período: ${dateFrom || '-'} - ${dateTo || '-'}`,
      `País: ${countryLabel}`,
      `Ciudad: ${cityLabel}`,
      selectedPaymentType !== 'ALL'
        ? `Tipo de pago: ${getPaymentTypeLabel(selectedPaymentType)}`
        : '',
      selectedCategory !== 'ALL' ? `Categoría: ${selectedCategory}` : '',
    ].filter(Boolean)

    return [
      title,
      filters.join(' · '),
      `Registros: ${count}`,
      `Total: ${formatCurrency(total, primaryCurrency)}`,
    ].join('\n')
  }

  function buildCitySubtotalBlocks<T>(
    records: T[],
    getCountry: (record: T) => string | undefined,
    getCity: (record: T) => string | undefined,
    getValue: (record: T) => number,
    buildRows: (records: T[]) => string,
  ) {
    const countriesMap = new Map<string, T[]>()

    records.forEach((record) => {
      const country = getCountry(record) || 'SIN_PAIS'
      countriesMap.set(country, [...(countriesMap.get(country) ?? []), record])
    })

    return Array.from(countriesMap.entries())
      .sort(([firstCountry], [secondCountry]) =>
        getCountrySortLabel(firstCountry).localeCompare(
          getCountrySortLabel(secondCountry),
          'es',
        ),
      )
      .map(([country, countryRecords]) => {
        const cityMap = new Map<string, T[]>()
        countryRecords.forEach((record) => {
          const city = getCity(record) || ''
          cityMap.set(city, [...(cityMap.get(city) ?? []), record])
        })
        const countryTotal = countryRecords.reduce(
          (total, record) => total + getValue(record),
          0,
        )
        const cityEntries = Array.from(cityMap.entries()).sort(
          ([firstCity], [secondCity]) =>
            getCityLabel(firstCity).localeCompare(getCityLabel(secondCity), 'es'),
        )
        const citySubtotals =
          cityEntries.length > 1
            ? cityEntries
                .map(([city, cityRecords]) => {
                  const cityTotal = cityRecords.reduce(
                    (total, record) => total + getValue(record),
                    0,
                  )

                  return `<div class="subtotal">${escapeHtml(
                    getCityLabel(city),
                  )}: ${escapeHtml(formatCurrency(cityTotal, primaryCurrency))}</div>`
                })
                .join('')
            : ''

        return `
          <h2>País: ${escapeHtml(getCountrySortLabel(country))}</h2>
          <div class="subtotal">Subtotal país: ${escapeHtml(
            formatCurrency(countryTotal, primaryCurrency),
          )}</div>
          ${citySubtotals}
          ${buildRows(countryRecords)}
        `
      })
      .join('')
  }

  function buildCitySubtotalTextBlocks<T>(
    records: T[],
    getCountry: (record: T) => string | undefined,
    getCity: (record: T) => string | undefined,
    getValue: (record: T) => number,
    buildRows: (records: T[]) => string,
  ) {
    const countriesMap = new Map<string, T[]>()

    records.forEach((record) => {
      const country = getCountry(record) || 'SIN_PAIS'
      countriesMap.set(country, [...(countriesMap.get(country) ?? []), record])
    })

    return Array.from(countriesMap.entries())
      .sort(([firstCountry], [secondCountry]) =>
        getCountrySortLabel(firstCountry).localeCompare(
          getCountrySortLabel(secondCountry),
          'es',
        ),
      )
      .map(([country, countryRecords]) => {
        const cityMap = new Map<string, T[]>()
        countryRecords.forEach((record) => {
          const city = getCity(record) || ''
          cityMap.set(city, [...(cityMap.get(city) ?? []), record])
        })
        const countryTotal = countryRecords.reduce(
          (total, record) => total + getValue(record),
          0,
        )
        const cityEntries = Array.from(cityMap.entries()).sort(
          ([firstCity], [secondCity]) =>
            getCityLabel(firstCity).localeCompare(getCityLabel(secondCity), 'es'),
        )
        const citySubtotals =
          cityEntries.length > 1
            ? cityEntries
                .map(([city, cityRecords]) => {
                  const cityTotal = cityRecords.reduce(
                    (total, record) => total + getValue(record),
                    0,
                  )

                  return `${getCityLabel(city)}: ${formatCurrency(
                    cityTotal,
                    primaryCurrency,
                  )}`
                })
                .join('\n')
            : ''

        return [
          `País: ${getCountrySortLabel(country)}`,
          `Subtotal país: ${formatCurrency(countryTotal, primaryCurrency)}`,
          citySubtotals,
          buildRows(countryRecords),
        ]
          .filter(Boolean)
          .join('\n')
      })
      .join('\n\n')
  }

  function buildIncomeTable(reportIncomes: ServiceIncome[]) {
    const totalDuration = reportIncomes.reduce(
      (total, income) =>
        total +
        (!isBasicUser && isServiceIncome(income)
          ? income.actualDuration ?? income.duration
          : 0),
      0,
    )
    const totalAmount = reportIncomes.reduce(
      (total, income) => total + getIncomeValue(income, primaryCurrency),
      0,
    )
    const rows = reportIncomes
      .map((income) => {
        const amount = getIncomeValue(income, primaryCurrency)
        const adjustmentCount = income.id ? adjustmentsByIncomeId.get(income.id) ?? 0 : 0
        const isReportable = canMarkAsReported(income, activeUsageMode)
        const badge = getRecordReportBadge(income)

        return `
          <tr>
            <td>${escapeHtml(getIncomeDisplayName(income))}</td>
            <td>${escapeHtml(getIncomeTypeLabel(income))}</td>
            <td>${escapeHtml(getIncomePaymentTypeLabel(income))}</td>
            ${!isBasicUser ? `<td>${isServiceIncome(income) ? escapeHtml(getIncomeDurationDisplay(income)) : 'No aplica'}</td>` : ''}
            <td>${escapeHtml(income.date)}</td>
            <td>${escapeHtml(formatExportDateTime(income.createdAt))}</td>
            ${!isBasicUser ? `<td>${isReportable ? escapeHtml(badge.label) : 'No aplica'}</td>` : ''}
            ${!isBasicUser ? `<td>${isReportable && badge.isReported ? escapeHtml(formatExportDateTime(badge.reportedAt)) : ''}</td>` : ''}
            ${!isBasicUser ? `<td>${isReportable ? escapeHtml(badge.reportReference ?? '') : ''}</td>` : ''}
            ${!isBasicUser ? `<td>${isReportable ? escapeHtml(badge.reportNotes ?? '') : ''}</td>` : ''}
            <td>${adjustmentCount > 0 ? `Afectado por ajuste (${adjustmentCount})` : 'Sin ajustes'}</td>
            <td class="amount">${escapeHtml(formatCurrency(amount, primaryCurrency))}</td>
          </tr>
        `
      })
      .join('')

    return `
      <table>
        <thead>
          <tr>
            <th>Ingreso</th>
            <th>Tipo</th>
            <th>Tipo de pago</th>
            ${!isBasicUser ? '<th>Duración</th>' : ''}
            <th>Fecha de ingreso</th>
            <th>Fecha de creación</th>
            ${!isBasicUser ? '<th>Estado</th>' : ''}
            ${!isBasicUser ? '<th>Fecha de reporte</th>' : ''}
            ${!isBasicUser ? '<th>Referencia</th>' : ''}
            ${!isBasicUser ? '<th>Notas</th>' : ''}
            <th>Trazabilidad</th>
            <th class="amount">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Total</td>
            ${!isBasicUser ? `<td>${totalDuration} min</td>` : ''}
            <td></td>
            <td></td>
            ${!isBasicUser ? '<td></td>' : ''}
            ${!isBasicUser ? '<td></td>' : ''}
            ${!isBasicUser ? '<td></td>' : ''}
            ${!isBasicUser ? '<td></td>' : ''}
            <td></td>
            <td class="amount">${escapeHtml(formatCurrency(totalAmount, primaryCurrency))}</td>
          </tr>
        </tfoot>
      </table>
    `
  }

  function buildIncomeDateTable(
    reportIncomes: ServiceIncome[],
    dateTotal: number,
    totalDurationMinutes: number,
  ) {
    return buildIncomeDateTableHtml({
      incomes: reportIncomes,
      primaryCurrency,
      usageMode: activeUsageMode,
      adjustmentCounts: adjustmentsByIncomeId,
      dateTotal,
      totalDurationMinutes,
    })
  }

  function buildIncomeTextRows(
    reportIncomes: ServiceIncome[],
    totalDurationMinutes?: number,
    totalLabel = 'Total valor',
  ) {
    return buildIncomeDateText({
      incomes: reportIncomes,
      primaryCurrency,
      usageMode: activeUsageMode,
      adjustmentCounts: adjustmentsByIncomeId,
      totalDurationMinutes,
      totalLabel,
    })
  }

  function buildExpenseTable(reportExpenses: Expense[]) {
    const totalAmount = reportExpenses.reduce(
      (total, expense) => total + getExpenseValue(expense, primaryCurrency),
      0,
    )
    const rows = reportExpenses
      .map((expense) => {
        const amount = getExpenseValue(expense, primaryCurrency)
        const relatedIncome = expense.relatedIncomeId
          ? incomesById.get(expense.relatedIncomeId)
          : undefined

        return `
          <tr>
            <td>${escapeHtml(getExpenseDisplayName(expense))}</td>
            <td>${escapeHtml(expense.category)}</td>
            <td>${relatedIncome ? escapeHtml(getIncomeDisplayName(relatedIncome)) : expense.relatedIncomeId ? `Ingreso #${expense.relatedIncomeId}` : 'No aplica'}</td>
            ${isBasicUser ? `<td>${canMarkAsReported(expense, activeUsageMode) ? getRecordReportBadge(expense).label : 'No aplica'}</td>` : ''}
            <td class="amount">${escapeHtml(formatCurrency(amount, primaryCurrency))}</td>
          </tr>
        `
      })
      .join('')

    return `
      <table>
        <thead>
          <tr>
            <th>Gasto</th>
            <th>Categoría</th>
            <th>Ingreso relacionado</th>
            ${isBasicUser ? '<th>Estado operativo</th>' : ''}
            <th class="amount">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3">Total</td>
            ${isBasicUser ? '<td></td>' : ''}
            <td class="amount">${escapeHtml(formatCurrency(totalAmount, primaryCurrency))}</td>
          </tr>
        </tfoot>
      </table>
    `
  }

  function buildExpenseTextRows(reportExpenses: Expense[]) {
    const totalAmount = reportExpenses.reduce(
      (total, expense) => total + getExpenseValue(expense, primaryCurrency),
      0,
    )
    const rows = reportExpenses
      .map((expense) => {
        const amount = getExpenseValue(expense, primaryCurrency)
        const relatedIncome = expense.relatedIncomeId
          ? incomesById.get(expense.relatedIncomeId)
          : undefined

        return [
          `- ${getExpenseDisplayName(expense)}`,
          `Categoría: ${expense.category}`,
          `Ingreso relacionado: ${relatedIncome ? getIncomeDisplayName(relatedIncome) : expense.relatedIncomeId ? `Ingreso #${expense.relatedIncomeId}` : 'No aplica'}`,
          isBasicUser
            ? `Estado operativo: ${canMarkAsReported(expense, activeUsageMode) ? getRecordReportBadge(expense).label : 'No aplica'}`
            : '',
          `Valor: ${formatCurrency(amount, primaryCurrency)}`,
        ].filter(Boolean).join(' | ')
      })
      .join('\n')

    return [rows, `Total valor: ${formatCurrency(totalAmount, primaryCurrency)}`]
      .filter(Boolean)
      .join('\n')
  }

  function buildGroupedTotalsTable(
    title: string,
    rows: Array<{ label: string; count: number; total: number }>,
  ) {
    if (rows.length === 0) {
      return `
        <h2>${escapeHtml(title)}</h2>
        <p class="empty">Sin registros en este bloque.</p>
      `
    }

    const body = rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.label)}</td>
            <td class="amount">${row.count}</td>
            <td class="amount">${escapeHtml(formatCurrency(row.total, primaryCurrency))}</td>
          </tr>
        `,
      )
      .join('')

    const total = rows.reduce((sum, row) => sum + row.total, 0)
    const count = rows.reduce((sum, row) => sum + row.count, 0)

    return `
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead>
          <tr>
            <th>Tipo</th>
            <th class="amount">Registros</th>
            <th class="amount">Total</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="amount">${count}</td>
            <td class="amount">${escapeHtml(formatCurrency(total, primaryCurrency))}</td>
          </tr>
        </tfoot>
      </table>
    `
  }

  function buildAdjustmentsSection() {
    const adjustments = balanceReport.adjustments
    const adjustmentRows = adjustments
      .map(
        (adjustment) => `
          <tr>
            <td>${escapeHtml(adjustment.date)}</td>
            <td>${escapeHtml(adjustment.origin === 'income' ? 'Ingreso' : 'Egreso')}</td>
            <td>${escapeHtml(adjustment.label)}</td>
            <td>${escapeHtml(adjustment.kind === 'positive' ? 'Ajuste positivo' : 'Ajuste negativo')}</td>
            <td class="amount">${escapeHtml(formatCurrency(adjustment.value, primaryCurrency))}</td>
          </tr>
        `,
      )
      .join('')

    if (adjustments.length === 0) {
      return `
        <h2>Ajustes</h2>
        <p class="empty">No hay ajustes en el período seleccionado.</p>
      `
    }

    return `
      <h2>Ajustes</h2>
      <p class="meta">Los ajustes se muestran separados para evitar mezclarlos con ingresos o egresos normales.</p>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Origen</th>
            <th>Registro</th>
            <th>Clasificación</th>
            <th class="amount">Impacto</th>
          </tr>
        </thead>
        <tbody>${adjustmentRows}</tbody>
      </table>
      <div class="summary">
        <div><span>Ajustes positivos</span><strong>${escapeHtml(formatCurrency(balanceReport.adjustmentsPositiveTotal, primaryCurrency))}</strong></div>
        <div><span>Ajustes negativos</span><strong>-${escapeHtml(formatCurrency(balanceReport.adjustmentsNegativeTotal, primaryCurrency))}</strong></div>
        <div><span>Impacto por ajustes</span><strong>${escapeHtml(formatCurrency(balanceReport.impactByAdjustments, primaryCurrency))}</strong></div>
      </div>
    `
  }

  function buildBalanceSectionsHtml() {
    return `
      <h2>Resumen general</h2>
      <div class="summary">
        <div><span>Total ingresos brutos</span><strong>${escapeHtml(formatCurrency(balanceReport.incomeGrossTotal, primaryCurrency))}</strong></div>
        <div><span>Total egresos</span><strong>${escapeHtml(formatCurrency(balanceReport.expenseTotal, primaryCurrency))}</strong></div>
        <div><span>Ganancia real / neta</span><strong>${escapeHtml(formatCurrency(balanceReport.netProfit, primaryCurrency))}</strong></div>
        <div><span>Balance general</span><strong>${escapeHtml(formatCurrency(balanceReport.generalBalance, primaryCurrency))}</strong></div>
      </div>
      ${buildGroupedTotalsTable('Ingresos por tipo', balanceReport.incomesByType)}
      ${buildGroupedTotalsTable('Egresos por tipo', balanceReport.expensesByType)}
      ${buildAdjustmentsSection()}
      <h2>Balance final</h2>
      <div class="subtotal">
        Fórmula aplicada: (Ingresos brutos - Egresos) + Impacto por ajustes = Balance general
      </div>
      <div class="summary">
        <div><span>Neto sin ajustes</span><strong>${escapeHtml(formatCurrency(balanceReport.netProfit, primaryCurrency))}</strong></div>
        <div><span>Impacto por ajustes</span><strong>${escapeHtml(formatCurrency(balanceReport.impactByAdjustments, primaryCurrency))}</strong></div>
        <div><span>Balance general</span><strong>${escapeHtml(formatCurrency(balanceReport.generalBalance, primaryCurrency))}</strong></div>
      </div>
    `
  }

  function buildBalanceSectionsText() {
    const incomeByTypeText = balanceReport.incomesByType.length === 0
      ? 'Sin registros.'
      : balanceReport.incomesByType
          .map((row) => `${row.label}: ${row.count} | ${formatCurrency(row.total, primaryCurrency)}`)
          .join('\n')
    const expenseByTypeText = balanceReport.expensesByType.length === 0
      ? 'Sin registros.'
      : balanceReport.expensesByType
          .map((row) => `${row.label}: ${row.count} | ${formatCurrency(row.total, primaryCurrency)}`)
          .join('\n')
    const adjustmentsText = balanceReport.adjustments.length === 0
      ? 'Sin ajustes en el período seleccionado.'
      : balanceReport.adjustments
          .map(
            (adjustment) =>
              `${adjustment.date} | ${adjustment.origin === 'income' ? 'Ingreso' : 'Egreso'} | ${adjustment.label} | ${adjustment.kind === 'positive' ? 'Ajuste positivo' : 'Ajuste negativo'} | ${formatCurrency(adjustment.value, primaryCurrency)}`,
          )
          .join('\n')

    return [
      'Resumen general',
      `- Total ingresos brutos: ${formatCurrency(balanceReport.incomeGrossTotal, primaryCurrency)}`,
      `- Total egresos: ${formatCurrency(balanceReport.expenseTotal, primaryCurrency)}`,
      `- Ganancia real / neta: ${formatCurrency(balanceReport.netProfit, primaryCurrency)}`,
      `- Balance general: ${formatCurrency(balanceReport.generalBalance, primaryCurrency)}`,
      '',
      'Ingresos por tipo',
      incomeByTypeText,
      '',
      'Egresos por tipo',
      expenseByTypeText,
      '',
      'Ajustes',
      adjustmentsText,
      `Ajustes positivos: ${formatCurrency(balanceReport.adjustmentsPositiveTotal, primaryCurrency)}`,
      `Ajustes negativos: -${formatCurrency(balanceReport.adjustmentsNegativeTotal, primaryCurrency)}`,
      `Impacto por ajustes: ${formatCurrency(balanceReport.impactByAdjustments, primaryCurrency)}`,
      '',
      'Balance final',
      'Fórmula: (Ingresos brutos - Egresos) + Impacto por ajustes = Balance general',
      `Balance general: ${formatCurrency(balanceReport.generalBalance, primaryCurrency)}`,
    ].join('\n')
  }

  function buildReport(kind: ReportKind) {
    const reportTitle =
      reportCards.find((reportCard) => reportCard.kind === kind)?.title ??
      'Reporte'
    let reportHtml = ''
    let reportText = ''

    if (kind === 'income') {
      const total = incomes.reduce(
        (sum, income) => sum + getIncomeValue(income, primaryCurrency),
        0,
      )
      const incomeDateGroups = groupIncomesByDate(incomes, primaryCurrency)
      const reportBodyText =
        incomes.length === 0
          ? 'No hay ingresos con los filtros seleccionados.'
          : incomeDateGroups
              .map((group) =>
                [
                  `Fecha: ${group.date}`,
                  buildIncomeTextRows(
                    group.incomes,
                    group.totalDurationMinutes,
                    'Subtotal fecha',
                  ),
                ].join('\n'),
              )
              .join('\n\n')
      reportHtml =
        buildReportHeader(reportTitle, total, incomes.length) +
        (incomes.length === 0
          ? '<p class="empty">No hay ingresos con los filtros seleccionados.</p>'
          : incomeDateGroups
              .map((group) => `
                <section class="income-date-group">
                  <h2>Fecha: ${escapeHtml(group.date)}</h2>
                  ${buildIncomeDateTable(
                    group.incomes,
                    group.total,
                    group.totalDurationMinutes,
                  )}
                </section>
              `)
              .join(''))
      reportText = `${buildReportTextHeader(
        reportTitle,
        total,
        incomes.length,
      )}\n\n${reportBodyText}`
    }

    if (kind === 'expense') {
      const total = expenses.reduce(
        (sum, expense) => sum + getExpenseValue(expense, primaryCurrency),
        0,
      )
      const reportBodyText =
        expenses.length === 0
          ? 'No hay egresos con los filtros seleccionados.'
          : buildCitySubtotalTextBlocks(
              expenses,
              (expense) => expense.country,
              (expense) => expense.city,
              (expense) => getExpenseValue(expense, primaryCurrency),
              buildExpenseTextRows,
            )
      reportHtml =
        buildReportHeader(reportTitle, total, expenses.length) +
        (expenses.length === 0
          ? '<p class="empty">No hay egresos con los filtros seleccionados.</p>'
          : buildCitySubtotalBlocks(
              expenses,
              (expense) => expense.country,
              (expense) => expense.city,
              (expense) => getExpenseValue(expense, primaryCurrency),
              buildExpenseTable,
            ))
      reportText = `${buildReportTextHeader(
        reportTitle,
        total,
        expenses.length,
      )}\n\n${reportBodyText}`
    }

    if (kind === 'paymentType') {
      const paymentIncomesOnly = incomes.filter(isServiceIncome)
      const total = paymentIncomesOnly.reduce(
        (sum, income) => sum + getIncomeValue(income, primaryCurrency),
        0,
      )
      const paymentTypeMap = groupReportableIncomesByPaymentType(paymentIncomesOnly)
      const paymentTypeSections = Array.from(paymentTypeMap.entries())
        .sort(([firstType], [secondType]) => firstType.localeCompare(secondType, 'es'))
        .map(([paymentType, paymentIncomes]) => {
          const paymentTotal = paymentIncomes.reduce(
            (sum, income) => sum + getIncomeValue(income, primaryCurrency),
            0,
          )

          return `
            <h2>Tipo de pago: ${escapeHtml(paymentType)}</h2>
            <div class="subtotal">Subtotal tipo de pago: ${escapeHtml(
              formatCurrency(paymentTotal, primaryCurrency),
            )}</div>
            ${buildCitySubtotalBlocks(
              paymentIncomes,
              (income) => income.country,
              (income) => income.city,
              (income) => getIncomeValue(income, primaryCurrency),
              buildIncomeTable,
            )}
          `
        })
        .join('')
      const paymentTypeTextSections = Array.from(paymentTypeMap.entries())
        .sort(([firstType], [secondType]) => firstType.localeCompare(secondType, 'es'))
        .map(([paymentType, paymentIncomes]) => {
          const paymentTotal = paymentIncomes.reduce(
            (sum, income) => sum + getIncomeValue(income, primaryCurrency),
            0,
          )

          return [
            `Tipo de pago: ${paymentType}`,
            `Subtotal tipo de pago: ${formatCurrency(
              paymentTotal,
              primaryCurrency,
            )}`,
            buildCitySubtotalTextBlocks(
              paymentIncomes,
              (income) => income.country,
              (income) => income.city,
              (income) => getIncomeValue(income, primaryCurrency),
              buildIncomeTextRows,
            ),
          ].join('\n')
        })
        .join('\n\n')

      reportHtml =
        buildReportHeader(reportTitle, total, paymentIncomesOnly.length) +
        (paymentIncomesOnly.length === 0
          ? '<p class="empty">No hay servicios con los filtros seleccionados.</p>'
          : paymentTypeSections)
      reportText = `${buildReportTextHeader(
        reportTitle,
        total,
        paymentIncomesOnly.length,
      )}\n\n${
        paymentIncomesOnly.length === 0
          ? 'No hay servicios con los filtros seleccionados.'
          : paymentTypeTextSections
      }`
    }

    if (kind === 'balance') {
      const totalRecords = incomes.length + expenses.length
      const seasonLabel =
        !isBasicUser && selectedSeason !== 'ALL'
          ? seasons.find((season) => String(season.id) === selectedSeason)?.name ??
            `Temporada #${selectedSeason}`
          : !isBasicUser
            ? 'Todas las temporadas'
            : ''
      const title = isBasicUser
        ? 'Balance general'
        : seasonLabel
          ? `Balance por temporadas - ${seasonLabel}`
          : reportTitle
      const countryLabel =
        selectedCountry === 'ALL' ? 'Todos los países' : getCountryLabel(selectedCountry)
      const cityLabel = selectedCity === 'ALL' ? 'Todas las ciudades' : selectedCity
      const extraFilters = [
        !isBasicUser ? `Temporada: ${seasonLabel}` : '',
        `Período: ${dateFrom || '-'} - ${dateTo || '-'}`,
        `País: ${countryLabel}`,
        `Ciudad: ${cityLabel}`,
      ]
        .filter(Boolean)
        .map((filter) => `<span>${escapeHtml(filter)}</span>`)
        .join(' · ')
      const textFilters = [
        !isBasicUser ? `Temporada: ${seasonLabel}` : '',
        `Período: ${dateFrom || '-'} - ${dateTo || '-'}`,
        `País: ${countryLabel}`,
        `Ciudad: ${cityLabel}`,
      ]
        .filter(Boolean)
        .join(' · ')
      const goalSummaryHtml =
        selectedSeasonRecord && selectedSeasonGoalProgress
          ? `
            <h2>Meta de la temporada</h2>
            <div class="meta">Finalización prevista: ${escapeHtml(formatSeasonDate(selectedSeasonRecord.plannedEndDate))}</div>
            <div class="summary">
              <div><span>Meta</span><strong>${escapeHtml(formatCurrency(selectedSeasonGoalProgress.goal, selectedSeasonRecord.baseCurrency ?? primaryCurrency))}</strong></div>
              <div><span>Valor alcanzado</span><strong>${escapeHtml(formatCurrency(selectedSeasonGoalProgress.achieved, selectedSeasonRecord.baseCurrency ?? primaryCurrency))}</strong></div>
              <div><span>Valor restante</span><strong>${escapeHtml(formatCurrency(selectedSeasonGoalProgress.remaining, selectedSeasonRecord.baseCurrency ?? primaryCurrency))}</strong></div>
              <div><span>Porcentaje alcanzado</span><strong>${selectedSeasonGoalProgress.percentage.toFixed(1)} %</strong></div>
            </div>
          `
          : ''
      const goalSummaryText =
        selectedSeasonRecord && selectedSeasonGoalProgress
          ? [
              'Meta de la temporada',
              `Finalización prevista: ${formatSeasonDate(selectedSeasonRecord.plannedEndDate)}`,
              `Meta: ${formatCurrency(selectedSeasonGoalProgress.goal, selectedSeasonRecord.baseCurrency ?? primaryCurrency)}`,
              `Valor alcanzado: ${formatCurrency(selectedSeasonGoalProgress.achieved, selectedSeasonRecord.baseCurrency ?? primaryCurrency)}`,
              `Valor restante: ${formatCurrency(selectedSeasonGoalProgress.remaining, selectedSeasonRecord.baseCurrency ?? primaryCurrency)}`,
              `Porcentaje alcanzado: ${selectedSeasonGoalProgress.percentage.toFixed(1)} %`,
              '',
            ]
          : []

      reportHtml = `
        <h1>${escapeHtml(title)}</h1>
        <div class="meta">${extraFilters}</div>
        <div class="summary">
          <div><span>Registros</span><strong>${totalRecords}</strong></div>
          <div><span>Balance general</span><strong>${escapeHtml(formatCurrency(balanceReport.generalBalance, primaryCurrency))}</strong></div>
        </div>
        ${goalSummaryHtml}
        ${
          balanceReport.hasData
            ? buildBalanceSectionsHtml()
            : '<p class="empty">No hay datos para construir el balance con los filtros seleccionados.</p>'
        }
      `
      reportText = [
        title,
        textFilters,
        `Registros: ${totalRecords}`,
        `Balance general: ${formatCurrency(balanceReport.generalBalance, primaryCurrency)}`,
        '',
        ...goalSummaryText,
        balanceReport.hasData
          ? buildBalanceSectionsText()
          : 'No hay datos para construir el balance con los filtros seleccionados.',
      ].join('\n')
    }

    return {
      html: buildPrintableDocument(reportTitle, reportHtml),
      text: reportText,
      title: reportTitle,
    }
  }

  async function handleShareReport(kind: ReportKind) {
    const report = buildReport(kind)

    try {
      const { shareReportPdf } = await import('../../services/reportShareService')

      const result = await shareReportPdf({
        fileName: report.title,
        html: report.html,
        text: report.text,
        title: report.title,
      })
      if (result === 'cancelled') return
    } catch {
      await alert({
        type: 'error',
        title: 'No se pudo compartir el reporte',
        message: 'No se pudo compartir el PDF del reporte.',
      })
    }
  }

  function handleOpenPreview(kind: ReportKind) {
    const report = buildReport(kind)

    window.sessionStorage.setItem('report-preview', JSON.stringify(report))
    navigate('/reports/preview')
  }

  async function handleExportIncomeCsv() {
    try {
      const { shareIncomesAsCsv } = await import('../../services/incomeExportService')

      const result = await shareIncomesAsCsv(incomes, primaryCurrency, activeUsageMode, 'reporte-de-ingresos')
      if (result === 'cancelled') return
    } catch {
      await alert({
        type: 'error',
        title: 'No se pudo exportar el CSV',
        message: 'No se pudo generar el archivo CSV de ingresos.',
      })
    }
  }

  async function handleExportIncomeExcel() {
    try {
      const { shareIncomesAsExcel } = await import('../../services/incomeExportService')

      const result = await shareIncomesAsExcel(incomes, primaryCurrency, activeUsageMode, 'reporte-de-ingresos')
      if (result === 'cancelled') return
    } catch {
      await alert({
        type: 'error',
        title: 'No se pudo exportar el Excel',
        message: 'No se pudo generar el archivo Excel de ingresos.',
      })
    }
  }

  async function handleConfirmGeneration() {
    const validation = validateReportConfiguration({
      dateFrom,
      dateTo,
      type: selectedReportKind,
      category: selectedCategory,
      currency: primaryCurrency,
      status: selectedReportStatus,
      format: selectedFormat,
    })
    if (!validation.valid) {
      setPendingGeneration(false)
      await alert({ type: 'error', title: 'Configuración inválida', message: 'Revisa el período y el formato antes de generar el reporte.' })
      return
    }
    setPendingGeneration(false)
    if (selectedFormat === 'csv' && selectedReportKind === 'income') {
      await handleExportIncomeCsv()
      return
    }
    if (selectedFormat === 'xlsx' && selectedReportKind === 'income') {
      await handleExportIncomeExcel()
      return
    }
    await handleShareReport(selectedReportKind)
  }

  if (loadError) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <div className="max-w-md rounded-lg border border-rose-200 bg-rose-50 p-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-700">{loadError}</p>
          <p className="mt-2 text-sm text-rose-600">
            Intenta entrar nuevamente o revisa si hay un respaldo/importación en
            proceso.
          </p>
        </div>
      </section>
    )
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel={isBasicUser ? 'Inicio' : 'Más'}
        backTo={isBasicUser ? '/' : '/more'}
        eyebrow="Reportes"
        title="Generar reportes"
      >
        <div className="grid grid-cols-3 w-fit rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
          {periods.map((periodOption) => (
            <button
              className={[
                'h-10 rounded-md px-3 text-sm font-semibold transition',
                period === periodOption.value
                  ? 'bg-emerald-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
              key={periodOption.value}
              onClick={() => handlePeriodChange(periodOption.value)}
              type="button"
            >
              {periodOption.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <CollapsibleFilters title="Filtros de reporte" storageKey="filters-open-reports">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <CalendarRange className="size-5 text-emerald-700" aria-hidden="true" />
          <span>
            {dateFrom || '-'} - {dateTo || '-'}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {!isBasicUser && (
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-600">Temporada</span>
              <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" onChange={(event) => setSelectedSeason(event.target.value)} value={selectedSeason}>
                <option value="ALL">Todas las temporadas</option>
                {seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.status === 'active' ? ' (activa)' : ''}</option>)}
              </select>
            </label>
          )}
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
            <span className="text-sm font-medium text-slate-600">Moneda</span>
            <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" onChange={(event) => setSelectedCurrency(event.target.value as CurrencyCode | 'AUTO')} value={selectedCurrency}>
              <option value="AUTO">Automática</option>
              <option value={settings.defaultCurrency}>{settings.defaultCurrency}</option>
              {settings.secondaryCurrency !== settings.defaultCurrency ? <option value={settings.secondaryCurrency}>{settings.secondaryCurrency}</option> : null}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">Estado</span>
            <select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900" onChange={(event) => setSelectedReportStatus(event.target.value as ConfigurableReportStatus)} value={selectedReportStatus}>
              <option value="ALL">Todos</option>
              <option value="reported">Reportados</option>
              <option value="unreported">Sin reportar</option>
            </select>
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
              onChange={(event) => handleCountryChange(event.target.value)}
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

          {!isBasicUser && <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">Ciudad</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => handleCityChange(event.target.value)}
              value={selectedCity}
            >
              <option value="ALL">Todas las ciudades</option>
              {availableCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>}

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

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">
              Categoría de egreso
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) =>
                setSelectedCategory(event.target.value || 'ALL')
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

      {selectedSeasonRecord && selectedSeasonGoalProgress && (
        <SeasonGoalCard
          currency={(selectedSeasonRecord.baseCurrency ?? primaryCurrency) as CurrencyCode}
          plannedEndDate={selectedSeasonRecord.plannedEndDate}
          progress={selectedSeasonGoalProgress}
        />
      )}

      <section aria-labelledby="report-builder-title" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white" id="report-builder-title">Configurar reporte</h2>
        <p className="mt-1 text-sm text-slate-500">Elige el contenido y revisa la vista previa antes de generar el archivo.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2"><span className="text-sm font-medium text-slate-600 dark:text-slate-300">Tipo</span><select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" onChange={(event) => { const kind = event.target.value as ReportKind; setSelectedReportKind(kind); if (kind !== 'income' && selectedFormat === 'xlsx') setSelectedFormat('pdf'); setPendingGeneration(false) }} value={selectedReportKind}>{reportCards.map((card) => <option key={card.kind} value={card.kind}>{card.title}</option>)}</select></label>
          <label className="flex flex-col gap-2"><span className="text-sm font-medium text-slate-600 dark:text-slate-300">Formato</span><select className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" onChange={(event) => { setSelectedFormat(event.target.value as ConfigurableReportFormat); setPendingGeneration(false) }} value={selectedFormat}><option value="pdf">PDF</option>{selectedReportKind === 'income' ? <><option value="csv">CSV</option><option value="xlsx">Excel</option></> : null}</select></label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => handleOpenPreview(selectedReportKind)} type="button"><Eye className="size-4" aria-hidden="true" />Vista previa</button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800" onClick={() => setPendingGeneration(true)} type="button">{selectedFormat === 'pdf' ? <Download className="size-4" aria-hidden="true" /> : <FileSpreadsheet className="size-4" aria-hidden="true" />}Preparar {selectedFormat.toUpperCase()}</button>
        </div>
        {pendingGeneration ? (
          <div aria-live="polite" className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Confirma la generación</p>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">{reportCards.find((card) => card.kind === selectedReportKind)?.title} · {dateFrom} a {dateTo} · {primaryCurrency} · {selectedFormat.toUpperCase()}</p>
            <div className="mt-3 flex justify-end gap-2"><button className="h-9 rounded-md px-3 text-sm font-semibold" onClick={() => setPendingGeneration(false)} type="button">Cancelar</button><button className="h-9 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" onClick={() => void handleConfirmGeneration()} type="button">Confirmar y generar</button></div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default ReportsPage
