import {
  CalendarRange,
  Clock,
  Download,
  FileJson,
  Upload,
} from 'lucide-react'
import {
  type ChangeEvent,
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
import { downloadText } from '../../utils/download'
import {
  getCurrentMonthRange,
  getCurrentWeekRange,
  getCurrentYearRange,
} from '../../utils/currency'
import { countries, getCountryCurrency } from '../../utils/countries'
import {
  calculateFinancialTotals,
  getStoredExpenseValue,
  getStoredIncomeValue,
} from '../../utils/financeStats'

type Period = 'week' | 'month' | 'year'

const periods: Array<{ value: Period; label: string }> = [
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
]

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

export function ReportsPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [selectedCountry, setSelectedCountry] = useState<string | 'ALL' | null>(
    null,
  )
  const [availableCountries, setAvailableCountries] = useState<CountryCode[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [periodIncomes, setPeriodIncomes] = useState<ServiceIncome[]>([])
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([])
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
  const workedHours = Math.round((totals.serviceMinutes / 60) * 10) / 10

  async function handleExportCsv() {
    setExportStatus('exporting')
    setExportMessage('')

    try {
      const rows = [
        ['Tipo', 'Concepto', 'Valor', 'Moneda'],
        ...incomes.map((income) => [
          'Ingreso',
          income.date,
          getStoredIncomeValue(income, primaryCurrency),
          primaryCurrency,
        ]),
        ...expenses.map((expense) => [
          'Gasto',
          `${expense.date} ${expense.category}`,
          getStoredExpenseValue(expense, primaryCurrency),
          primaryCurrency,
        ]),
      ]
      const content = rows
        .map((row) =>
          row
            .map((value) => {
              const text = String(value)

              return text.includes(',') || text.includes('"') || text.includes('\n')
                ? `"${text.replaceAll('"', '""')}"`
                : text
            })
            .join(','),
        )
        .join('\n')
      const label =
        periods.find((periodOption) => periodOption.value === period)?.label ??
        'reporte'

      await downloadText(
        content,
        `reporte-${label.toLowerCase()}.csv`,
        'text/csv;charset=utf-8',
      )
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

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="grid gap-3">
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
    </section>
  )
}

export default ReportsPage
