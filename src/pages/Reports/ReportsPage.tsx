import { CalendarRange, Eye, RefreshCw, Share2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  generateDueCutoffReports,
  listCutoffReports,
} from '../../services/cutoffReportService'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { CutoffReport, CutoffFrequency } from '../../types/cutoffReport'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
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

type Period = 'week' | 'month' | 'year'
type ReportKind = 'income' | 'expense' | 'paymentType'
type CutoffFrequencyFilter = CutoffFrequency | 'ALL'

const periods: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
]

const reportCards: Array<{
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

const cutoffFrequencyLabels: Record<CutoffFrequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
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
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [periodIncomes, setPeriodIncomes] = useState<ServiceIncome[]>([])
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([])
  const [cutoffReports, setCutoffReports] = useState<CutoffReport[]>([])
  const [cutoffFrequencyFilter, setCutoffFrequencyFilter] =
    useState<CutoffFrequencyFilter>('ALL')
  const [selectedCutoffId, setSelectedCutoffId] = useState('')
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadReports() {
      try {
        setLoadError('')
        const range = {
          from: dateFrom || undefined,
          to: dateTo || undefined,
        }
        await generateDueCutoffReports()

        const [
          currentSettings,
          currentIncomes,
          currentExpenses,
          currentCutoffReports,
        ] =
          await Promise.all([
            getSettings(),
            listServiceIncomes({ ...range, newestFirst: true }),
            listExpenses({ ...range, newestFirst: true }),
            listCutoffReports(),
          ])

        if (!isMounted) {
          return
        }

        setSettings(currentSettings)
        setPeriodIncomes(currentIncomes)
        setPeriodExpenses(currentExpenses)
        setCutoffReports(currentCutoffReports)
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

  const filteredCutoffReports = useMemo(
    () =>
      cutoffReports.filter(
        (report) =>
          cutoffFrequencyFilter === 'ALL' ||
          report.frequency === cutoffFrequencyFilter,
      ),
    [cutoffFrequencyFilter, cutoffReports],
  )

  const selectedCutoffReport = useMemo(() => {
    if (filteredCutoffReports.length === 0) {
      return null
    }

    return (
      filteredCutoffReports.find(
        (report) => String(report.id) === selectedCutoffId,
      ) ?? filteredCutoffReports[0]
    )
  }, [filteredCutoffReports, selectedCutoffId])

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
    if (selectedCountry === 'ALL') {
      return primaryCurrencyFromSettings
    }

    return (
      getCountryCurrency(selectedCountry as CountryCode) ??
      primaryCurrencyFromSettings
    )
  }, [primaryCurrencyFromSettings, selectedCountry])

  const incomes = useMemo(
    () =>
      periodIncomes.filter((income) => {
        const matchesCountry =
          selectedCountry === 'ALL' || income.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || income.city === selectedCity
        const matchesPaymentType =
          selectedPaymentType === 'ALL' ||
          income.paymentType === selectedPaymentType

        return matchesCountry && matchesCity && matchesPaymentType
      }),
    [periodIncomes, selectedCity, selectedCountry, selectedPaymentType],
  )

  const expenses = useMemo(
    () =>
      periodExpenses.filter((expense) => {
        const matchesCountry =
          selectedCountry === 'ALL' || expense.country === selectedCountry
        const matchesCity = selectedCity === 'ALL' || expense.city === selectedCity
        const matchesCategory =
          selectedCategory === 'ALL' || expense.category === selectedCategory

        return matchesCountry && matchesCity && matchesCategory
      }),
    [periodExpenses, selectedCategory, selectedCity, selectedCountry],
  )

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

  async function handleRefreshCutoffs() {
    try {
      setLoadError('')
      await generateDueCutoffReports()
      setCutoffReports(await listCutoffReports())
    } catch {
      setLoadError('No se pudieron actualizar los cortes automáticos.')
    }
  }

  function renderCutoffBreakdown(
    title: string,
    totals: Record<string, number>,
    currency: CurrencyCode,
  ) {
    const entries = Object.entries(totals).sort(([first], [second]) =>
      first.localeCompare(second, 'es'),
    )
    const maxValue = Math.max(...entries.map(([, value]) => value), 0)

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {entries.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3">
            {entries.map(([label, value]) => (
              <div className="flex flex-col gap-1" key={label}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">
                    {label === 'SIN_TIPO' ? 'Sin tipo' : label}
                  </span>
                  <span className="font-semibold text-slate-950">
                    {formatCurrency(value, currency)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600"
                    style={{
                      width: maxValue > 0 ? `${(value / maxValue) * 100}%` : '0%',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">Sin datos para mostrar.</p>
        )}
      </div>
    )
  }

  function buildReportHeader(title: string, total: number, count: number) {
    const countryLabel =
      selectedCountry === 'ALL' ? 'Todos los países' : getCountryLabel(selectedCountry)
    const cityLabel = selectedCity === 'ALL' ? 'Todas las ciudades' : selectedCity
    const filters = [
      `Periodo: ${dateFrom || '-'} - ${dateTo || '-'}`,
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
      `Periodo: ${dateFrom || '-'} - ${dateTo || '-'}`,
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
      (total, income) => total + (income.actualDuration ?? income.duration),
      0,
    )
    const totalAmount = reportIncomes.reduce(
      (total, income) => total + getIncomeValue(income, primaryCurrency),
      0,
    )
    const rows = reportIncomes
      .map((income) => {
        const amount = getIncomeValue(income, primaryCurrency)

        return `
          <tr>
            <td>${escapeHtml(getIncomeDisplayName(income))}</td>
            <td>${escapeHtml(getPaymentTypeLabel(income.paymentType))}</td>
            <td>${income.actualDuration ?? income.duration} min</td>
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
            <th>Tipo de pago</th>
            <th>Duración</th>
            <th class="amount">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total</td>
            <td>${totalDuration} min</td>
            <td class="amount">${escapeHtml(formatCurrency(totalAmount, primaryCurrency))}</td>
          </tr>
        </tfoot>
      </table>
    `
  }

  function buildIncomeTextRows(reportIncomes: ServiceIncome[]) {
    const totalDuration = reportIncomes.reduce(
      (total, income) => total + (income.actualDuration ?? income.duration),
      0,
    )
    const totalAmount = reportIncomes.reduce(
      (total, income) => total + getIncomeValue(income, primaryCurrency),
      0,
    )
    const rows = reportIncomes
      .map((income) => {
        const amount = getIncomeValue(income, primaryCurrency)

        return [
          `- ${getIncomeDisplayName(income)}`,
          `Tipo: ${getPaymentTypeLabel(income.paymentType)}`,
          `Duración: ${income.actualDuration ?? income.duration} min`,
          `Valor: ${formatCurrency(amount, primaryCurrency)}`,
        ].join(' | ')
      })
      .join('\n')

    return [
      rows,
      `Total duración: ${totalDuration} min`,
      `Total valor: ${formatCurrency(totalAmount, primaryCurrency)}`,
    ].join('\n')
  }

  function buildExpenseTable(reportExpenses: Expense[]) {
    const totalAmount = reportExpenses.reduce(
      (total, expense) => total + getExpenseValue(expense, primaryCurrency),
      0,
    )
    const rows = reportExpenses
      .map((expense) => {
        const amount = getExpenseValue(expense, primaryCurrency)

        return `
          <tr>
            <td>${escapeHtml(getExpenseDisplayName(expense))}</td>
            <td>${escapeHtml(expense.category)}</td>
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
            <th class="amount">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">Total</td>
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

        return [
          `- ${getExpenseDisplayName(expense)}`,
          `Categoría: ${expense.category}`,
          `Valor: ${formatCurrency(amount, primaryCurrency)}`,
        ].join(' | ')
      })
      .join('\n')

    return [rows, `Total valor: ${formatCurrency(totalAmount, primaryCurrency)}`]
      .filter(Boolean)
      .join('\n')
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
      const reportBodyText =
        incomes.length === 0
          ? 'No hay ingresos con los filtros seleccionados.'
          : buildCitySubtotalTextBlocks(
              incomes,
              (income) => income.country,
              (income) => income.city,
              (income) => getIncomeValue(income, primaryCurrency),
              buildIncomeTextRows,
            )
      reportHtml =
        buildReportHeader(reportTitle, total, incomes.length) +
        (incomes.length === 0
          ? '<p class="empty">No hay ingresos con los filtros seleccionados.</p>'
          : buildCitySubtotalBlocks(
              incomes,
              (income) => income.country,
              (income) => income.city,
              (income) => getIncomeValue(income, primaryCurrency),
              buildIncomeTable,
            ))
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
      const total = incomes.reduce(
        (sum, income) => sum + getIncomeValue(income, primaryCurrency),
        0,
      )
      const paymentTypeMap = new Map<string, ServiceIncome[]>()
      incomes.forEach((income) => {
        const paymentType = income.paymentType || 'SIN_TIPO'
        paymentTypeMap.set(paymentType, [
          ...(paymentTypeMap.get(paymentType) ?? []),
          income,
        ])
      })
      const paymentTypeSections = Array.from(paymentTypeMap.entries())
        .sort(([firstType], [secondType]) =>
          getPaymentTypeLabel(firstType).localeCompare(
            getPaymentTypeLabel(secondType),
            'es',
          ),
        )
        .map(([paymentType, paymentIncomes]) => {
          const paymentTotal = paymentIncomes.reduce(
            (sum, income) => sum + getIncomeValue(income, primaryCurrency),
            0,
          )

          return `
            <h2>Tipo de pago: ${escapeHtml(getPaymentTypeLabel(paymentType))}</h2>
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
        .sort(([firstType], [secondType]) =>
          getPaymentTypeLabel(firstType).localeCompare(
            getPaymentTypeLabel(secondType),
            'es',
          ),
        )
        .map(([paymentType, paymentIncomes]) => {
          const paymentTotal = paymentIncomes.reduce(
            (sum, income) => sum + getIncomeValue(income, primaryCurrency),
            0,
          )

          return [
            `Tipo de pago: ${getPaymentTypeLabel(paymentType)}`,
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
        buildReportHeader(reportTitle, total, incomes.length) +
        (incomes.length === 0
          ? '<p class="empty">No hay ingresos con los filtros seleccionados.</p>'
          : paymentTypeSections)
      reportText = `${buildReportTextHeader(
        reportTitle,
        total,
        incomes.length,
      )}\n\n${
        incomes.length === 0
          ? 'No hay ingresos con los filtros seleccionados.'
          : paymentTypeTextSections
      }`
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

      await shareReportPdf({
        fileName: report.title,
        html: report.html,
        text: report.text,
        title: report.title,
      })
    } catch {
      window.alert('No se pudo compartir el PDF del reporte.')
    }
  }

  function handleOpenPreview(kind: ReportKind) {
    const report = buildReport(kind)

    window.sessionStorage.setItem('report-preview', JSON.stringify(report))
    navigate('/reports/preview')
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
        backLabel="Inicio"
        backTo="/"
        eyebrow="Reportes"
        title="Generación de PDF"
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

          <label className="flex flex-col gap-2">
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

      <section className="grid gap-3 lg:grid-cols-3">
        {reportCards.map((reportCard) => (
          <article
            className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            key={reportCard.kind}
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {reportCard.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {reportCard.description}
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                onClick={() => handleOpenPreview(reportCard.kind)}
                type="button"
              >
                <Eye className="size-4" aria-hidden="true" />
                Vista previa
              </button>
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={() => handleShareReport(reportCard.kind)}
                type="button"
              >
                <Share2 className="size-4" aria-hidden="true" />
                Compartir PDF
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Cortes generados
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">
              Visualización de cierres automáticos
            </h2>
          </div>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={handleRefreshCutoffs}
            type="button"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Actualizar cortes
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">
              Periodicidad
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => {
                setCutoffFrequencyFilter(
                  event.target.value as CutoffFrequencyFilter,
                )
                setSelectedCutoffId('')
              }}
              value={cutoffFrequencyFilter}
            >
              <option value="ALL">Todas</option>
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-600">Corte</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              disabled={filteredCutoffReports.length === 0}
              onChange={(event) => setSelectedCutoffId(event.target.value)}
              value={selectedCutoffReport?.id ? String(selectedCutoffReport.id) : ''}
            >
              {filteredCutoffReports.length === 0 ? (
                <option value="">Sin cortes disponibles</option>
              ) : null}
              {filteredCutoffReports.map((report) => (
                <option key={report.id} value={report.id}>
                  {cutoffFrequencyLabels[report.frequency]} ·{' '}
                  {report.periodStart} - {report.periodEnd}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedCutoffReport ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Ingresos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatCurrency(
                    selectedCutoffReport.incomeTotal,
                    selectedCutoffReport.currency,
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCutoffReport.incomeCount} registros
                </p>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Egresos</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatCurrency(
                    selectedCutoffReport.expenseTotal,
                    selectedCutoffReport.currency,
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedCutoffReport.expenseCount} registros
                </p>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Utilidad</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {formatCurrency(
                    selectedCutoffReport.netTotal,
                    selectedCutoffReport.currency,
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Corte {selectedCutoffReport.periodStart} -{' '}
                  {selectedCutoffReport.periodEnd}
                </p>
              </article>

              <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Tiempo de servicios
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {selectedCutoffReport.serviceMinutes} min
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Generado {selectedCutoffReport.generatedAt.slice(0, 10)}
                </p>
              </article>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {renderCutoffBreakdown(
                'Ingresos por tipo de pago',
                selectedCutoffReport.paymentTypeTotals,
                selectedCutoffReport.currency,
              )}
              {renderCutoffBreakdown(
                'Egresos por categoría',
                selectedCutoffReport.expenseCategoryTotals,
                selectedCutoffReport.currency,
              )}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
            Los cortes aparecerán automáticamente cuando se complete el primer
            periodo configurado.
          </div>
        )}
      </section>
    </section>
  )
}

export default ReportsPage
