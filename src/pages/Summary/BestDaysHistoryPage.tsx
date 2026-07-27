import { useEffect, useMemo, useState } from 'react'

import { RecordDetailDialog, type RecordDetailRequest } from '../../components/dialogs/RecordDetailDialog'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  getSeasonStatistics,
  listEarningPeriods,
  listServiceIncomesByEarningPeriod,
} from '../../services/earningPeriodService'
import { getSettings } from '../../services/settingsService'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { AppSettings, CountryCode, CurrencyCode } from '../../types/settings'
import { countries, getCountryCurrency } from '../../utils/countries'
import { formatCurrency, roundMoney } from '../../utils/currency'
import { weekdayNames } from '../../utils/financeStats'
import { getIncomeTypeLabel, isServiceIncome } from '../../utils/incomeTypes'

interface BestDayHistoryRow {
  bestDay?: { average: number; amount: number; date: string }
  countryCity: string
  currency: CurrencyCode
  incomeCount: number
  period: EarningPeriod
}

const DETAIL_CLOSE_ANIMATION_MS = 200

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

function getWeekdayLabel(date: string) {
  return weekdayNames[new Date(`${date}T00:00`).getDay()]
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
    period.baseCurrency ??
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
      const currency = getPeriodCurrency(period, settings)
      const stats = period.id ? await getSeasonStatistics(period.id) : undefined
      const bestDayDetail = stats?.servicesByDay.find(
        (day) => day.date === stats.bestDay?.date,
      )

      return {
        // La misma fuente que alimenta "Mejor día" en el detalle de
        // Temporadas (getSeasonStatistics), para que ambas pantallas
        // coincidan siempre.
        bestDay:
          stats?.bestDay && bestDayDetail
            ? {
                amount: stats.bestDay.amount,
                average:
                  bestDayDetail.count > 0
                    ? roundMoney(stats.bestDay.amount / bestDayDetail.count)
                    : 0,
                date: stats.bestDay.date,
              }
            : undefined,
        countryCity: getCountryCity(period),
        currency,
        incomeCount: stats?.serviceCount ?? 0,
        period,
      }
    }),
  )

  return rows.filter((row) => row.incomeCount > 0 || row.period.status === 'closed')
}

export function BestDaysHistoryPage() {
  const [rows, setRows] = useState<BestDayHistoryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [detailRequest, setDetailRequest] = useState<RecordDetailRequest | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  async function openBestDayDetail(row: BestDayHistoryRow) {
    if (!row.bestDay || !row.period.id) return

    const incomes = await listServiceIncomesByEarningPeriod(row.period.id)
    const items = incomes
      .filter((income) => income.date === row.bestDay?.date)
      .map((income) => ({
        key: income.id,
        title: `${getIncomeTypeLabel(income)} · ${income.date}`,
        detail: `${formatCurrency(income.totalAmount, income.currency as CurrencyCode)} · ${isServiceIncome(income) ? 'ganancia' : 'monto efectivo'} ${formatCurrency(income.realGain, income.currency as CurrencyCode)}`,
      }))

    setDetailRequest({
      title: `Servicios · ${formatDateTime(row.bestDay.date)} (${getWeekdayLabel(row.bestDay.date)})`,
      items,
    })
    setIsDetailOpen(true)
  }

  function closeDetail() {
    setIsDetailOpen(false)
    window.setTimeout(() => setDetailRequest(null), DETAIL_CLOSE_ANIMATION_MS)
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel="Resumen completo"
        backTo="/resumen-completo"
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
                  <th className="px-4 py-3">Ganancia</th>
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
                      {row.bestDay
                        ? formatCurrency(row.bestDay.amount, row.currency)
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      {row.bestDay ? (
                        <button
                          className="font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
                          onClick={() => openBestDayDetail(row)}
                          type="button"
                        >
                          {formatDateTime(row.bestDay.date)} ({getWeekdayLabel(row.bestDay.date)})
                        </button>
                      ) : (
                        'Sin datos suficientes'
                      )}
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
      {detailRequest && (
        <RecordDetailDialog onClose={closeDetail} open={isDetailOpen} request={detailRequest} />
      )}
    </section>
  )
}

export default BestDaysHistoryPage
