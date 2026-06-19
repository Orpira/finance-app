import { useEffect, useMemo, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  listEarningPeriods,
  listServiceIncomesByEarningPeriod,
} from '../../services/earningPeriodService'
import { getSettings } from '../../services/settingsService'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { countries, getCountryCurrency } from '../../utils/countries'
import { formatCurrency } from '../../utils/currency'
import { calculateBestIncomeWeekday } from '../../utils/financeStats'

interface BestDayHistoryRow {
  bestDay?: ReturnType<typeof calculateBestIncomeWeekday>
  countryCity: string
  currency: CurrencyCode
  incomeCount: number
  period: EarningPeriod
}

function formatDateTime(value: string | undefined) {
  if (!value) {
    return '-'
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value.slice(0, 10)
  }

  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsedDate)
}

function getCountryLabel(countryCode: string | undefined) {
  if (!countryCode) {
    return 'Sin país'
  }

  return (
    countries.find((country) => country.value === countryCode)?.label ??
    countryCode
  )
}

function getPeriodCurrency(
  period: EarningPeriod,
  settings: AppSettings,
): CurrencyCode {
  return (
    getCountryCurrency(period.countryCode ?? (period.country as CountryCode)) ??
    settings.defaultCurrency
  )
}

function getCountryCity(period: EarningPeriod) {
  return `${getCountryLabel(period.countryCode ?? period.country)}/${
    period.city?.trim() || 'Sin ciudad'
  }`
}

async function buildRows(settings: AppSettings) {
  const periods = await listEarningPeriods()
  const rows = await Promise.all(
    periods.map(async (period) => {
      const incomes: ServiceIncome[] = period.id
        ? await listServiceIncomesByEarningPeriod(period.id)
        : []
      const currency = getPeriodCurrency(period, settings)

      return {
        bestDay: calculateBestIncomeWeekday(incomes, currency),
        countryCity: getCountryCity(period),
        currency,
        incomeCount: incomes.length,
        period,
      }
    }),
  )

  return rows.filter((row) => row.incomeCount > 0 || row.period.status === 'closed')
}

export function BestDaysHistoryPage() {
  const [rows, setRows] = useState<BestDayHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadHistory() {
      const settings = await getSettings()
      const nextRows = await buildRows(settings)

      if (!isMounted) {
        return
      }

      setRows(nextRows)
      setIsLoading(false)
    }

    loadHistory()

    return () => {
      isMounted = false
    }
  }, [])

  const emptyMessage = useMemo(() => {
    if (isLoading) {
      return 'Cargando historial...'
    }

    return 'Aún no hay períodos con ingresos registrados.'
  }, [isLoading])

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel="Dashboard"
        backTo="/dashboard"
        eyebrow="Períodos de ganancia"
        title="Historial de mejores días"
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">{emptyMessage}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Desde</th>
                  <th className="px-4 py-3">Hasta</th>
                  <th className="px-4 py-3">Porcentaje</th>
                  <th className="px-4 py-3">Mejor día</th>
                  <th className="px-4 py-3">Promedio</th>
                  <th className="px-4 py-3">País/Ciudad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {rows.map((row) => (
                  <tr key={row.period.id ?? row.period.name}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-950">
                      {row.period.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.period.status === 'active' ? 'Activo' : 'Cerrado'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {formatDateTime(row.period.startDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.period.status === 'active'
                        ? 'En curso'
                        : formatDateTime(row.period.endDate)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.period.percentage}%
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.bestDay?.weekday ?? 'Sin datos suficientes'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.bestDay
                        ? formatCurrency(row.bestDay.average, row.currency)
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.countryCity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

export default BestDaysHistoryPage
