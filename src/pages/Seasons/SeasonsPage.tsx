import { CalendarRange, ChevronRight, History, LockKeyhole, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  closeActiveEarningPeriod,
  getActiveEarningPeriod,
  getSeasonStatistics,
  listClosedEarningPeriods,
  type SeasonStatistics,
} from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'
import { formatCurrency } from '../../utils/currency'
import { countries } from '../../utils/countries'
import { getSeasonOverviewState } from '../../utils/seasonOverview'
import { useDialog } from '../../components/dialogs/useDialog'

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

function countryLabel(code?: string) {
  return countries.find((item) => item.value === code)?.label ?? code ?? 'Sin país'
}

type SeasonWithStats = { period: EarningPeriod; stats: SeasonStatistics }

export function ClosedSeasonCard({
  period,
  stats,
}: SeasonWithStats) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <History
              aria-label="Historial de temporada cerrada"
              className="size-4 text-slate-500"
            />
            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
              Cerrada
            </span>
          </div>
          <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">
            {period.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {period.city || 'Sin ciudad'}, {countryLabel(period.countryCode ?? period.country)} · {formatDate(period.startDate)} – {formatDate(period.endDate)}
          </p>
        </div>
        <Link
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          to={`/temporadas/${period.id}`}
        >
          Ver detalle
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <span>Bruto: <strong>{formatCurrency(stats.grossIncome, period.baseCurrency ?? 'EUR')}</strong></span>
        <span>Ganancia: <strong>{formatCurrency(stats.realGain, period.baseCurrency ?? 'EUR')}</strong></span>
        <span>Egresos: <strong>{formatCurrency(stats.expenses, period.baseCurrency ?? 'EUR')}</strong></span>
        <span>Servicios: <strong>{stats.serviceCount}</strong></span>
      </div>
    </article>
  )
}

export function SeasonHistoryPanel({
  closed,
  onCreate,
  showCreateAction = true,
}: {
  closed: readonly SeasonWithStats[]
  onCreate: () => void
  showCreateAction?: boolean
}) {
  const state = getSeasonOverviewState(null, closed.map(({ period }) => period))
  if (state.kind !== 'history') return null

  const byId = new Map(closed.map((item) => [item.period.id, item]))
  const recent = state.recent.flatMap((period) => {
    const item = byId.get(period.id)
    return item ? [item] : []
  })
  const remaining = state.remaining.flatMap((period) => {
    const item = byId.get(period.id)
    return item ? [item] : []
  })

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {showCreateAction ? 'Temporadas recientes' : 'Historial de temporadas'}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {showCreateAction
              ? 'No hay una temporada activa. Puedes consultar el historial o iniciar la siguiente.'
              : 'Consulta las temporadas cerradas sin modificar sus registros.'}
          </p>
        </div>
        {showCreateAction ? (
          <button
            className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white"
            onClick={onCreate}
            type="button"
          >
            <Plus aria-hidden="true" className="size-4" />
            Nueva temporada
          </button>
        ) : null}
      </div>

      <div className="grid gap-3">
        {recent.map(({ period, stats }) => (
          <ClosedSeasonCard key={period.id} period={period} stats={stats} />
        ))}
      </div>

      {remaining.length > 0 ? (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300 [&::-webkit-details-marker]:hidden">
            Ver todas las temporadas
            <ChevronRight aria-hidden="true" className="size-4 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-3 grid gap-3">
            {remaining.map(({ period, stats }) => (
              <ClosedSeasonCard key={period.id} period={period} stats={stats} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

export function SeasonsPage() {
  const { confirm } = useDialog()
  const navigate = useNavigate()
  const [active, setActive] = useState<EarningPeriod | null>(null)
  const [closed, setClosed] = useState<Array<{ period: EarningPeriod; stats: SeasonStatistics }>>([])
  const [activeStats, setActiveStats] = useState<SeasonStatistics | null>(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    const [current, old] = await Promise.all([getActiveEarningPeriod(), listClosedEarningPeriods()])
    const [currentStats, oldStats] = await Promise.all([
      current?.id ? getSeasonStatistics(current.id) : null,
      Promise.all(old.map(async (period) => ({ period, stats: await getSeasonStatistics(period.id!) }))),
    ])
    setActive(current ?? null)
    setActiveStats(currentStats)
    setClosed(oldStats)
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  async function startNewSeason() {
    if (!active) {
      navigate('/temporadas/nueva')
      return
    }
    const confirmed = await confirm({
      title: 'Cerrar temporada activa',
      message: 'Ya existe una temporada activa.\n\nPara crear una nueva temporada debes cerrar la temporada actual.\n¿Deseas cerrarla ahora y crear una nueva?',
      confirmLabel: 'Cerrar y continuar',
      confirmTone: 'warning',
    })
    if (!confirmed) return
    await closeActiveEarningPeriod()
    navigate(`/temporadas/nueva?basedOn=${active.id}`)
  }

  async function finishSeason() {
    if (!active) return
    const confirmed = await confirm({
      title: 'Finalizar temporada',
      message: 'Vas a finalizar la temporada actual.\n\nTodos los ingresos, egresos, ajustes y citas asociados quedarán en modo solo consulta. No podrán editarse ni eliminarse. Tampoco serán incluidos en los cálculos de nuevas temporadas.\n\n¿Deseas continuar?',
      confirmLabel: 'Finalizar temporada',
      confirmTone: 'danger',
    })
    if (!confirmed) return
    await closeActiveEarningPeriod()
    await load()
  }

  if (loading) return <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">Cargando temporadas...</section>

  const overview = getSeasonOverviewState(active, closed.map(({ period }) => period))

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader backLabel="Más" backTo="/more" eyebrow="Ciclos de actividad" title="Temporadas" />

      {overview.kind === 'active' && active ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">Activa</span>
              <h2 className="mt-3 text-2xl font-semibold">{active.name}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{active.city || 'Sin ciudad'}, {countryLabel(active.countryCode ?? active.country)} · desde {formatDate(active.startDate)} · prevista hasta {formatDate(active.plannedEndDate)} · {active.percentage}%</p>
            </div>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800" to={`/temporadas/${active.id}`}>Ver detalle <ChevronRight className="size-4" /></Link>
          </div>
          {activeStats && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Ingresos brutos', activeStats.grossIncome], ['Ganancia real', activeStats.realGain],
              ['Egresos', activeStats.expenses], ['Resultado de la temporada', activeStats.netGain],
            ].map(([label, value]) => <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/60" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(value), active.baseCurrency ?? 'EUR')}</p></div>)}
          </div>}
          <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-md border border-red-300 bg-white px-4 text-sm font-semibold text-red-700" onClick={finishSeason} type="button"><LockKeyhole className="size-4" /> Finalizar temporada</button>
        </article>
      ) : overview.kind === 'history' ? (
        <SeasonHistoryPanel closed={closed} onCreate={startNewSeason} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <CalendarRange className="mx-auto size-10 text-emerald-700" />
          <h2 className="mt-3 text-lg font-semibold">Crea tu primera temporada</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Organiza ingresos, egresos y citas dentro de tu primer ciclo de actividad.</p>
          <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" onClick={startNewSeason} type="button"><Plus className="size-4" /> Crear temporada</button>
        </div>
      )}

      {overview.kind === 'active' && closed.length > 0 ? (
        <SeasonHistoryPanel
          closed={closed}
          onCreate={startNewSeason}
          showCreateAction={false}
        />
      ) : null}
    </section>
  )
}

export default SeasonsPage
