import { CalendarRange, ChevronRight, LockKeyhole, Plus } from 'lucide-react'
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
import { useDialog } from '../../components/dialogs/useDialog'

function formatDate(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value))
}

function countryLabel(code?: string) {
  return countries.find((item) => item.value === code)?.label ?? code ?? 'Sin país'
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

  useEffect(() => { load() }, [])

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

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader backLabel="Más" backTo="/more" eyebrow="Ciclos de actividad" title="Temporadas">
        <button className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" onClick={startNewSeason} type="button">
          <Plus className="size-4" /> Nueva temporada
        </button>
      </PageHeader>

      {active ? (
        <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/40">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white">Activa</span>
              <h2 className="mt-3 text-2xl font-semibold">{active.name}</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{active.city || 'Sin ciudad'}, {countryLabel(active.countryCode ?? active.country)} · desde {formatDate(active.startDate)} · {active.percentage}%</p>
            </div>
            <Link className="inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300 bg-white px-3 text-sm font-semibold text-emerald-800" to={`/temporadas/${active.id}`}>Ver detalle <ChevronRight className="size-4" /></Link>
          </div>
          {activeStats && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Ingresos brutos', activeStats.grossIncome], ['Ganancia real', activeStats.realGain],
              ['Egresos', activeStats.expenses], ['Ganancia neta', activeStats.netGain],
            ].map(([label, value]) => <div className="rounded-lg bg-white/80 p-3 dark:bg-slate-900/60" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(value), active.baseCurrency ?? 'EUR')}</p></div>)}
          </div>}
          <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-md border border-red-300 bg-white px-4 text-sm font-semibold text-red-700" onClick={finishSeason} type="button"><LockKeyhole className="size-4" /> Finalizar temporada</button>
        </article>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <CalendarRange className="mx-auto size-10 text-emerald-700" />
          <h2 className="mt-3 text-lg font-semibold">No hay una temporada activa</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">Crea una temporada para comenzar a registrar ingresos, egresos y citas.</p>
          <button className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" onClick={startNewSeason} type="button"><Plus className="size-4" /> Crear temporada</button>
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold">Temporadas cerradas</h2>
        {closed.length === 0 ? <p className="mt-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-500">Aún no hay temporadas cerradas.</p> :
          <div className="mt-3 grid gap-3">{closed.map(({ period, stats }) => (
            <Link className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 dark:border-slate-800 dark:bg-slate-900" key={period.id} to={`/temporadas/${period.id}`}>
              <div className="flex items-center justify-between gap-3"><div><p className="font-semibold">{period.name}</p><p className="mt-1 text-sm text-slate-500">{period.city}, {countryLabel(period.countryCode ?? period.country)} · {formatDate(period.startDate)} – {formatDate(period.endDate)}</p></div><ChevronRight className="size-5 text-slate-400" /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4"><span>Bruto: <strong>{formatCurrency(stats.grossIncome, period.baseCurrency ?? 'EUR')}</strong></span><span>Ganancia: <strong>{formatCurrency(stats.realGain, period.baseCurrency ?? 'EUR')}</strong></span><span>Egresos: <strong>{formatCurrency(stats.expenses, period.baseCurrency ?? 'EUR')}</strong></span><span>Servicios: <strong>{stats.serviceCount}</strong></span></div>
            </Link>
          ))}</div>}
      </section>
    </section>
  )
}

export default SeasonsPage
