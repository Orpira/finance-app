import {
  BarChart3,
  CalendarRange,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  MinusCircle,
  PlusCircle,
  TrendingUp,
  Upload,
} from 'lucide-react'
import {
  lazy,
  type ChangeEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { exportBackup, importBackup } from '../../services/backupService'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings } from '../../types/settings'
import type { CountryCode } from '../../types/settings'
import {
  formatCurrency,
  getCurrentMonthRange,
  getCurrentWeekRange,
  getCurrentYearRange,
  getLastDaysRange,
} from '../../utils/currency'
import { countries, getCountryCurrency } from '../../utils/countries'
import {
  calculateAverageIncome,
  calculateBestIncomeDay,
  calculateFinancialTotals,
  calculateTrend,
  getStoredExpenseValue,
  getStoredIncomeValue,
} from '../../utils/financeStats'

type Period = 'week' | 'month' | 'year'

const periods: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
]

const TrendLineChart = lazy(() => import('./TrendLineChart'))

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
  const country = countries.find((c) => c.value === code)
  return country?.label || code
}

function getNextInputDate(date: string) {
  const nextDate = new Date(`${date}T00:00`)
  nextDate.setDate(nextDate.getDate() + 1)

  return nextDate.toISOString().slice(0, 10)
}

function getDateLabels(from: string, to: string) {
  const labels: string[] = []
  let currentDate = from

  while (currentDate <= to) {
    labels.push(currentDate)
    currentDate = getNextInputDate(currentDate)
  }

  return labels
}

function formatChartDate(date: string) {
  const [, month, day] = date.split('-')

  return `${day}/${month}`
}

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL' | null>(
    null,
  )
  const [availableCountries, setAvailableCountries] = useState<CountryCode[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [periodIncomes, setPeriodIncomes] = useState<ServiceIncome[]>([])
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([])
  const [last30Incomes, setLast30Incomes] = useState<ServiceIncome[]>([])
  const [last30Expenses, setLast30Expenses] = useState<Expense[]>([])
  const [exportStatus, setExportStatus] = useState<
    'idle' | 'exporting' | 'success' | 'error'
  >('idle')
  const [exportMessage, setExportMessage] = useState('')
  const [loadError, setLoadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const range = useMemo(() => getPeriodRange(period), [period])

  useEffect(() => {
    let isMounted = true

    async function loadReports() {
      try {
        setLoadError('')
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
        setPeriodIncomes(currentIncomes)
        setPeriodExpenses(currentExpenses)
        setSelectedCountry((currentSelectedCountry) => {
          if (currentSelectedCountry !== null) {
            return currentSelectedCountry
          }

          return currentSettings?.country ?? 'ALL'
        })

        const countriesFromData = new Set<CountryCode>()
        currentIncomes.forEach((income) => {
          if (income.country) {
            countriesFromData.add(income.country as CountryCode)
          }
        })
        currentExpenses.forEach((expense) => {
          if (expense.country) {
            countriesFromData.add(expense.country as CountryCode)
          }
        })

        setAvailableCountries(Array.from(countriesFromData).sort())
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
  }, [range])

  const incomes = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'ALL') {
      return periodIncomes
    }

    return periodIncomes.filter((income) => income.country === selectedCountry)
  }, [periodIncomes, selectedCountry])

  const expenses = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'ALL') {
      return periodExpenses
    }

    return periodExpenses.filter((expense) => expense.country === selectedCountry)
  }, [periodExpenses, selectedCountry])

  const primaryCurrencyFromSettings = settings?.defaultCurrency ?? 'EUR'
  const secondaryCurrency = settings?.secondaryCurrency ?? 'COP'

  const primaryCurrency = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'ALL') {
      return primaryCurrencyFromSettings
    }

    return getCountryCurrency(selectedCountry as CountryCode) ?? primaryCurrencyFromSettings
  }, [selectedCountry, primaryCurrencyFromSettings])

  useEffect(() => {
    let isMounted = true

    async function loadTrends() {
      const last30Range = getLastDaysRange(30)
      const [trendIncomes, trendExpenses] = await Promise.all([
        listServiceIncomes({ ...last30Range, newestFirst: true }),
        listExpenses({ ...last30Range, newestFirst: true }),
      ])

      if (!isMounted) {
        return
      }

      setLast30Incomes(trendIncomes)
      setLast30Expenses(trendExpenses)
    }

    loadTrends()

    return () => {
      isMounted = false
    }
  }, [])

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
  const averageIncome = useMemo(
    () => calculateAverageIncome(incomes, primaryCurrency),
    [incomes, primaryCurrency],
  )
  const bestDay = useMemo(
    () => calculateBestIncomeDay(incomes, primaryCurrency),
    [incomes, primaryCurrency],
  )
  const chartMaxValue = Math.max(totals.primaryIncome, totals.primaryExpenses, 1)
  const incomeBarWidth = `${Math.round(
    (totals.primaryIncome / chartMaxValue) * 100,
  )}%`
  const expenseBarWidth = `${Math.round(
    (totals.primaryExpenses / chartMaxValue) * 100,
  )}%`
  const trends = useMemo(() => {
    const midpoint = new Date()
    midpoint.setDate(midpoint.getDate() - 14)
    const midpointDate = midpoint.toISOString().slice(0, 10)

    const previousIncomes = last30Incomes.filter(
      (income) => income.date < midpointDate,
    )
    const currentIncomes = last30Incomes.filter(
      (income) => income.date >= midpointDate,
    )
    const previousExpenses = last30Expenses.filter(
      (expense) => expense.date < midpointDate,
    )
    const currentExpenses = last30Expenses.filter(
      (expense) => expense.date >= midpointDate,
    )
    const previousIncomeTotal = previousIncomes.reduce(
      (total, income) => total + getStoredIncomeValue(income, primaryCurrency),
      0,
    )
    const currentIncomeTotal = currentIncomes.reduce(
      (total, income) => total + getStoredIncomeValue(income, primaryCurrency),
      0,
    )
    const previousExpenseTotal = previousExpenses.reduce(
      (total, expense) => total + getStoredExpenseValue(expense, primaryCurrency),
      0,
    )
    const currentExpenseTotal = currentExpenses.reduce(
      (total, expense) => total + getStoredExpenseValue(expense, primaryCurrency),
      0,
    )

    return {
      expenses: calculateTrend(currentExpenseTotal, previousExpenseTotal),
      incomeTotal: currentIncomeTotal,
      incomes: calculateTrend(currentIncomeTotal, previousIncomeTotal),
    }
  }, [last30Expenses, last30Incomes, primaryCurrency])
  const workedHours = Math.round((totals.serviceMinutes / 60) * 10) / 10
  const trendChartData = useMemo(() => {
    const incomeTotalsByDate = new Map<string, number>()
    const expenseTotalsByDate = new Map<string, number>()

    incomes.forEach((income) => {
      incomeTotalsByDate.set(
        income.date,
        (incomeTotalsByDate.get(income.date) ?? 0) +
          getStoredIncomeValue(income, primaryCurrency),
      )
    })
    expenses.forEach((expense) => {
      expenseTotalsByDate.set(
        expense.date,
        (expenseTotalsByDate.get(expense.date) ?? 0) +
          getStoredExpenseValue(expense, primaryCurrency),
      )
    })

    return getDateLabels(range.from, range.to).map((date) => ({
      date,
      gastos: Math.round((expenseTotalsByDate.get(date) ?? 0) * 100) / 100,
      ingresos: Math.round((incomeTotalsByDate.get(date) ?? 0) * 100) / 100,
      label: formatChartDate(date),
    }))
  }, [expenses, incomes, primaryCurrency, range])

  async function getReportData(reportPeriod: Period) {
    const reportRange = getPeriodRange(reportPeriod)
    const [reportIncomes, reportExpenses] = await Promise.all([
      listServiceIncomes({ ...reportRange, newestFirst: true }),
      listExpenses({ ...reportRange, newestFirst: true }),
    ])

    return {
      expenses: reportExpenses,
      incomes: reportIncomes,
      label: periods.find((periodOption) => periodOption.value === reportPeriod)
        ?.label ?? 'Reporte',
      primaryCurrency,
      range: reportRange,
      secondaryCurrency,
    }
  }

  async function handleExportPdf(reportPeriod: Period) {
    setExportStatus('exporting')
    setExportMessage('')

    try {
      const { exportReportPdf } = await import(
        '../../services/reportExportService'
      )

      exportReportPdf(await getReportData(reportPeriod))
      setExportStatus('success')
      setExportMessage('PDF exportado correctamente.')
    } catch {
      setExportStatus('error')
      setExportMessage('No se pudo exportar el PDF.')
    }
  }

  async function handleExportXlsx() {
    setExportStatus('exporting')
    setExportMessage('')

    try {
      const { exportReportXlsx } = await import(
        '../../services/reportExportService'
      )

      await exportReportXlsx({
        expenses,
        incomes,
        label: periods.find((periodOption) => periodOption.value === period)
          ?.label ?? 'Reporte',
        primaryCurrency,
        range,
        secondaryCurrency,
      })
      setExportStatus('success')
      setExportMessage('XLSX exportado correctamente.')
    } catch {
      setExportStatus('error')
      setExportMessage('No se pudo exportar el XLSX.')
    }
  }

  async function handleExportCsv() {
    setExportStatus('exporting')
    setExportMessage('')

    try {
      const { exportReportCsv } = await import(
        '../../services/reportExportService'
      )

      await exportReportCsv({
        expenses,
        incomes,
        label: periods.find((periodOption) => periodOption.value === period)
          ?.label ?? 'Reporte',
        primaryCurrency,
        range,
        secondaryCurrency,
      })
      setExportStatus('success')
      setExportMessage('CSV exportado correctamente.')
    } catch {
      setExportStatus('error')
      setExportMessage('No se pudo exportar el CSV.')
    }
  }

  async function handleExportBackup() {
    setExportStatus('exporting')
    setExportMessage('')

    try {
      await exportBackup()
      setExportStatus('success')
      setExportMessage('Backup exportado correctamente.')
    } catch {
      setExportStatus('error')
      setExportMessage('No se pudo exportar el backup.')
    }
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    await importBackup(file)
    window.location.reload()
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
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-emerald-700">Estadísticas</p>
          <h1 className="text-2xl font-semibold text-slate-950">
            KPIs financieros
          </h1>
        </div>

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
              onClick={() => setPeriod(periodOption.value)}
              type="button"
            >
              {periodOption.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm font-medium text-slate-600 shadow-sm">
        <CalendarRange className="size-5 text-emerald-700" aria-hidden="true" />
        <span>
          {range.from} - {range.to}
        </span>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">
          Reportes y backup
        </h2>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => handleExportPdf('week')}
            type="button"
          >
            <FileText className="size-4" aria-hidden="true" />
            PDF semanal
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => handleExportPdf('month')}
            type="button"
          >
            <FileText className="size-4" aria-hidden="true" />
            PDF mensual
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={handleExportXlsx}
            type="button"
          >
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            Exportar XLSX
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={handleExportCsv}
            type="button"
          >
            <Download className="size-4" aria-hidden="true" />
            Exportar CSV
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={handleExportBackup}
            type="button"
          >
            <FileJson className="size-4" aria-hidden="true" />
            backup.json
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Upload className="size-4" aria-hidden="true" />
            Importar backup
          </button>
          <input
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportBackup}
            ref={fileInputRef}
            type="file"
          />
        </div>
        {exportMessage ? (
          <p
            className={[
              'mt-3 text-sm font-medium',
              exportStatus === 'error' ? 'text-rose-600' : 'text-emerald-700',
            ].join(' ')}
          >
            {exportMessage}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Ingresos</p>
              <PlusCircle className="size-5 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatCurrency(totals.primaryIncome, primaryCurrency)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatCurrency(totals.secondaryIncome, secondaryCurrency)}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Gastos</p>
              <MinusCircle className="size-5 text-red-600" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatCurrency(totals.primaryExpenses, primaryCurrency)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {totals.expenseCount} movimientos
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Ganancia neta</p>
              <TrendingUp className="size-5 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatCurrency(totals.primaryNet, primaryCurrency)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {formatCurrency(totals.secondaryNet, secondaryCurrency)}
            </p>
          </article>

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">Servicios</p>
              <BarChart3 className="size-5 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {totals.serviceCount}
            </p>
            <p className="mt-1 text-sm text-slate-500">realizados</p>
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

          <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-500">
                Ticket medio
              </p>
              <BarChart3 className="size-5 text-emerald-700" aria-hidden="true" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatCurrency(averageIncome, primaryCurrency)}
            </p>
            <p className="mt-1 text-sm text-slate-500">por servicio</p>
          </article>
        </div>

        {availableCountries.length > 0 && (
          <aside className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm h-fit">
            <h2 className="text-lg font-semibold text-slate-950">
              Filtro de datos
            </h2>
            <div className="mt-4 flex flex-col gap-2">
              <label htmlFor="country-select" className="text-sm font-medium text-slate-600">
                Filtrar por país
              </label>
              <select
                id="country-select"
                value={selectedCountry || 'ALL'}
                onChange={(e) => setSelectedCountry(e.target.value || 'ALL')}
                className="w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none"
              >
                <option value="ALL">Todos los países</option>
                {availableCountries.map((country) => (
                  <option key={country} value={country}>
                    {getCountryLabel(country)}
                  </option>
                ))}
              </select>
            </div>
          </aside>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Tendencia ingresos vs gastos
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Evolución diaria en {primaryCurrency}
            </p>
          </div>
          <TrendingUp className="size-5 text-emerald-700" aria-hidden="true" />
        </div>

        <div className="mt-5 h-72 min-h-72 w-full">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center rounded-md bg-slate-50 text-sm font-medium text-slate-500">
                Cargando gráfica...
              </div>
            }
          >
            <TrendLineChart
              data={trendChartData}
              primaryCurrency={primaryCurrency}
            />
          </Suspense>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Gráficas</h2>
            <BarChart3 className="size-5 text-emerald-700" aria-hidden="true" />
          </div>

          <div className="mt-5 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Ingresos</span>
                <span className="text-slate-500">
                  {formatCurrency(totals.primaryIncome, primaryCurrency)}
                </span>
              </div>
              <div className="mt-2 h-5 overflow-hidden rounded-md bg-slate-100">
                <div
                  className="h-full rounded-md bg-emerald-600"
                  style={{ width: incomeBarWidth }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Gastos</span>
                <span className="text-slate-500">
                  {formatCurrency(totals.primaryExpenses, primaryCurrency)}
                </span>
              </div>
              <div className="mt-2 h-5 overflow-hidden rounded-md bg-slate-100">
                <div
                  className="h-full rounded-md bg-red-500"
                  style={{ width: expenseBarWidth }}
                />
              </div>
            </div>
          </div>
        </article>

        <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Mejor día</h2>
          <p className="mt-4 text-2xl font-semibold text-slate-950">
            {bestDay.count > 0 ? bestDay.weekday : '-'}
          </p>
          <p className="mt-1 text-sm text-slate-500">Promedio</p>
          <p className="mt-2 text-xl font-semibold text-emerald-700">
            {formatCurrency(bestDay.average, primaryCurrency)}
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Tendencias</h2>
            <p className="mt-1 text-sm text-slate-500">Últimos 30 días</p>
          </div>
          <TrendingUp className="size-5 text-emerald-700" aria-hidden="true" />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-500">Ingresos</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {trends.incomes === 'up' && '↑'}
              {trends.incomes === 'down' && '↓'}
              {trends.incomes === 'flat' && '→'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-500">Gastos</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {trends.expenses === 'up' && '↑'}
              {trends.expenses === 'down' && '↓'}
              {trends.expenses === 'flat' && '→'}
            </p>
          </div>
        </div>
      </section>
    </section>
  )
}

export default ReportsPage
