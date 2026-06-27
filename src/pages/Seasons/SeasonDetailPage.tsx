import { CopyPlus, LockKeyhole, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { getEarningPeriodById, getSeasonStatistics, listSeasonRecords, updateActiveEarningPeriod, type SeasonStatistics } from '../../services/earningPeriodService'
import { listCityOptions } from '../../services/locationService'
import type { Appointment } from '../../types/appointment'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { CountryCode, CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { countries, getCityOption, getCountryCurrency } from '../../utils/countries'
import { getIncomeTypeLabel, isServiceIncome } from '../../utils/incomeTypes'

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value)) : 'En curso'
}

export function SeasonDetailPage() {
  const id = Number(useParams().id)
  const [period, setPeriod] = useState<EarningPeriod | null>()
  const [stats, setStats] = useState<SeasonStatistics | null>(null)
  const [records, setRecords] = useState<{ incomes: ServiceIncome[]; expenses: Expense[]; appointments: Appointment[] } | null>(null)

  useEffect(() => {
    if (!Number.isFinite(id)) return
    Promise.all([getEarningPeriodById(id), getSeasonStatistics(id), listSeasonRecords(id)]).then(([item, itemStats, itemRecords]) => {
      setPeriod(item ?? null); setStats(itemStats); setRecords(itemRecords)
    })
  }, [id])

  if (!Number.isFinite(id)) return <section className="mx-auto max-w-2xl py-8"><PageHeader backLabel="Temporadas" backTo="/temporadas" title="Temporada no encontrada" /></section>
  if (period === undefined || !stats || !records) return <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">Cargando temporada...</section>
  if (!period) return <section className="mx-auto max-w-2xl py-8"><PageHeader backLabel="Temporadas" backTo="/temporadas" title="Temporada no encontrada" /></section>
  const currency = period.baseCurrency ?? 'EUR'
  const country = countries.find((item) => item.value === (period.countryCode ?? period.country))?.label ?? period.country
  const cards = [
    ['Ingresos brutos', stats.grossIncome], ['Ganancia real', stats.realGain], ['Egresos', stats.expenses],
    ['Ajustes', stats.adjustments], ['Ganancia neta', stats.netGain], ['Mejor día', stats.bestDay?.amount ?? 0],
  ]

  async function editActiveSeason() {
    if (!period?.id || period.status !== 'active') return
    const nextName = window.prompt('Nombre de la temporada', period.name)
    if (nextName === null) return
    const nextCity = window.prompt('Ciudad de la temporada', period.city ?? '')
    if (nextCity === null) return
    const nextPercentageValue = window.prompt('Porcentaje de ganancia', String(period.percentage))
    if (nextPercentageValue === null) return
    const nextPercentage = Number(nextPercentageValue)
    if (!Number.isFinite(nextPercentage) || nextPercentage < 0 || nextPercentage > 100) {
      window.alert('El porcentaje debe estar entre 0 y 100.')
      return
    }
    try {
      const cityOptions = await listCityOptions()
      const selectedCity = getCityOption(nextCity.trim(), cityOptions)
      const nextCountry = selectedCity?.country ?? (period.countryCode ?? period.country) as CountryCode
      const updated = await updateActiveEarningPeriod(period.id, {
        name: nextName.trim() || period.name,
        notes: period.notes,
        percentage: nextPercentage,
        city: nextCity.trim() || period.city,
        country: nextCountry,
        countryCode: nextCountry,
        baseCurrency: getCountryCurrency(nextCountry) ?? period.baseCurrency,
      })
      if (updated) setPeriod(updated)
    } catch (reason) {
      window.alert(reason instanceof Error ? reason.message : 'No se pudo actualizar la temporada.')
    }
  }

  return <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <PageHeader backLabel="Temporadas" backTo="/temporadas" eyebrow={period.status === 'closed' ? 'Solo consulta' : 'Temporada activa'} title={period.name}>
      {period.status === 'closed' ? <Link className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" to={`/temporadas/nueva?basedOn=${period.id}`}><CopyPlus className="size-4" /> Crear basada en esta</Link> : <button className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" onClick={editActiveSeason} type="button"><Pencil className="size-4" /> Editar temporada</button>}
    </PageHeader>
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2"><span className={period.status === 'closed' ? 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:!text-slate-100' : 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:!text-emerald-100'}>{period.status === 'closed' ? 'Temporada cerrada' : 'Activa'}</span>{period.status === 'closed' && <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:!text-slate-300"><LockKeyhole className="size-3" /> Registros bloqueados</span>}</div>
      <p className="mt-3 text-sm text-slate-600 dark:!text-slate-300">{period.city}, {country} · {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.percentage}%</p>
      {period.notes && <p className="mt-2 text-sm text-slate-500">{period.notes}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{cards.map(([label, amount]) => <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(amount), currency)}</p></article>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">Servicios por día</h2><div className="mt-3 grid gap-2">{stats.servicesByDay.length ? stats.servicesByDay.map((item) => <div className="flex justify-between text-sm" key={item.date}><span>{formatDate(item.date)} · {item.count} servicios</span><strong>{formatCurrency(item.amount, currency)}</strong></div>) : <p className="text-sm text-slate-500">Sin servicios.</p>}</div></section>
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">Egresos por categoría</h2><div className="mt-3 grid gap-2">{stats.expensesByCategory.length ? stats.expensesByCategory.map((item) => <div className="flex justify-between text-sm" key={item.category}><span>{item.category}</span><strong>{formatCurrency(item.amount, currency)}</strong></div>) : <p className="text-sm text-slate-500">Sin egresos.</p>}</div></section>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <ReadOnlyList title={`Ingresos (${records.incomes.length})`} empty="Sin ingresos." items={records.incomes.map((item) => ({ key: item.id, title: `${getIncomeTypeLabel(item)} · ${item.date}`, detail: `${formatCurrency(item.totalAmount, item.currency as CurrencyCode)} · ${isServiceIncome(item) ? 'ganancia' : 'monto efectivo'} ${formatCurrency(item.realGain, item.currency as CurrencyCode)}` }))} />
      <ReadOnlyList title={`Egresos y ajustes (${records.expenses.length})`} empty="Sin egresos ni ajustes." items={records.expenses.map((item) => ({ key: item.id, title: `${item.date} · ${item.category}`, detail: `${item.type === 'ajuste' ? 'Ajuste' : 'Egreso'} · ${formatCurrency(item.amount, item.currency as CurrencyCode)}` }))} />
      <ReadOnlyList title={`Citas (${records.appointments.length})`} empty="Sin citas." items={records.appointments.map((item) => ({ key: item.id, title: formatDate(item.dateTime), detail: `${formatCurrency(item.expectedAmount, item.currency as CurrencyCode)} · ${item.completed ? 'Completada' : 'Registrada'}` }))} />
    </div>
  </section>
}

function ReadOnlyList({ title, empty, items }: { title: string; empty: string; items: Array<{ key?: number; title: string; detail: string }> }) {
  return <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-semibold">{title}</h2>{items.length ? <ul className="mt-3 divide-y divide-slate-100">{items.map((item, index) => <li className="py-2 text-sm" key={item.key ?? index}><p className="font-medium">{item.title}</p><p className="mt-0.5 text-slate-500">{item.detail}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">{empty}</p>}</section>
}

export default SeasonDetailPage
