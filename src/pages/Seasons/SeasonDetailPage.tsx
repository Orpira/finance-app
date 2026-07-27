import { ChevronDown, CopyPlus, LockKeyhole, Pencil, Star } from 'lucide-react'
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
import { useDialog } from '../../components/dialogs/useDialog'
import { RecordDetailDialog, type RecordDetailItem, type RecordDetailRequest } from '../../components/dialogs/RecordDetailDialog'

const DETAIL_CLOSE_ANIMATION_MS = 200

function formatDate(value?: string) {
  return value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(value)) : 'En curso'
}

export function SeasonDetailPage() {
  const { alert, prompt } = useDialog()
  const id = Number(useParams().id)
  const [period, setPeriod] = useState<EarningPeriod | null>()
  const [stats, setStats] = useState<SeasonStatistics | null>(null)
  const [records, setRecords] = useState<{ incomes: ServiceIncome[]; expenses: Expense[]; appointments: Appointment[] } | null>(null)
  const [detailRequest, setDetailRequest] = useState<RecordDetailRequest | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

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

  function openDayDetail(day: { date: string; count: number; amount: number }) {
    if (!records) return
    const items = records.incomes
      .filter((income) => income.date === day.date)
      .map((income) => ({
        key: income.id,
        title: `${getIncomeTypeLabel(income)} · ${income.date}`,
        detail: `${formatCurrency(income.totalAmount, income.currency as CurrencyCode)} · ${isServiceIncome(income) ? 'ganancia' : 'monto efectivo'} ${formatCurrency(income.realGain, income.currency as CurrencyCode)}`,
      }))
    setDetailRequest({ title: `Servicios · ${formatDate(day.date)}`, items })
    setIsDetailOpen(true)
  }

  function openCategoryDetail(category: { category: string; amount: number }) {
    if (!records) return
    const items = records.expenses
      .filter((expense) => expense.category === category.category)
      .map((expense) => ({
        key: expense.id,
        title: `${expense.date} · ${expense.category}`,
        detail: `${expense.type === 'ajuste' ? 'Ajuste' : 'Egreso'} · ${formatCurrency(expense.amount, expense.currency as CurrencyCode)}`,
      }))
    setDetailRequest({ title: `Egresos · ${category.category}`, items })
    setIsDetailOpen(true)
  }

  function closeDetail() {
    setIsDetailOpen(false)
    window.setTimeout(() => setDetailRequest(null), DETAIL_CLOSE_ANIMATION_MS)
  }

  async function editActiveSeason() {
    if (!period?.id || period.status !== 'active') return
    const nextName = await prompt({
      title: 'Nombre de la temporada',
      initialValue: period.name,
      placeholder: 'Nombre de la temporada',
    })
    if (nextName === null) return
    const nextCity = await prompt({
      title: 'Ciudad de la temporada',
      initialValue: period.city ?? '',
      placeholder: 'Ciudad',
    })
    if (nextCity === null) return
    const nextPercentageValue = await prompt({
      title: 'Porcentaje de ganancia',
      initialValue: String(period.percentage),
      placeholder: '0–100',
      inputMode: 'decimal',
    })
    if (nextPercentageValue === null) return
    const nextPercentage = Number(nextPercentageValue)
    if (!Number.isFinite(nextPercentage) || nextPercentage < 0 || nextPercentage > 100) {
      await alert({
        type: 'warning',
        title: 'Porcentaje no válido',
        message: 'El porcentaje debe estar entre 0 y 100.',
      })
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
      await alert({
        type: 'error',
        title: 'No se pudo actualizar la temporada',
        message: reason instanceof Error ? reason.message : 'No se pudo actualizar la temporada.',
      })
    }
  }

  return <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
    <PageHeader backLabel="Temporadas" backTo="/temporadas" eyebrow={period.status === 'closed' ? 'Solo consulta' : 'Temporada activa'} title={period.name}>
      {period.status === 'closed' ? <Link className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" to={`/temporadas/nueva?basedOn=${period.id}`}><CopyPlus className="size-4" /> Crear basada en esta</Link> : <button className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" onClick={editActiveSeason} type="button"><Pencil className="size-4" /> Editar temporada</button>}
    </PageHeader>
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2"><span className={period.status === 'closed' ? 'rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:!text-slate-100' : 'rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900 dark:!text-emerald-100'}>{period.status === 'closed' ? 'Temporada cerrada' : 'Activa'}</span>{period.status === 'closed' && <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:!text-slate-300"><LockKeyhole className="size-3" /> Registros bloqueados</span>}</div>
      <p className="mt-3 text-sm text-slate-600 dark:!text-slate-300">{period.city}, {country} · {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.percentage}%</p>
    </div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{cards.map(([label, amount]) => <article className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900" key={String(label)}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold">{formatCurrency(Number(amount), currency)}</p></article>)}</div>
    <div className="grid gap-4 lg:grid-cols-2">
      <details className="group rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden"><span>Servicios por día</span><ChevronDown aria-hidden="true" className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-3 grid gap-2">
          {stats.servicesByDay.length ? stats.servicesByDay.map((item) => {
            const isBestDay = stats.bestDay?.date === item.date

            return (
              <div
                className={[
                  'flex items-center justify-between rounded-lg text-sm',
                  isBestDay
                    ? 'border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200'
                    : '',
                ].join(' ')}
                key={item.date}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isBestDay && <Star aria-hidden="true" className="size-3.5 fill-amber-500 text-amber-500" />}
                  {formatDate(item.date)} · {item.count} servicios
                  {isBestDay && <span className="text-xs font-semibold uppercase tracking-wide">Mejor día</span>}
                </span>
                <div className="flex items-center gap-3">
                  <strong>{formatCurrency(item.amount, currency)}</strong>
                  <button className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300" onClick={() => openDayDetail(item)} type="button">Ver detalle</button>
                </div>
              </div>
            )
          }) : <p className="text-sm text-slate-500">Sin servicios.</p>}
        </div>
      </details>
      <details className="group rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden"><span>Egresos por categoría</span><ChevronDown aria-hidden="true" className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>
        <div className="mt-3 grid gap-2">
          {stats.expensesByCategory.length ? stats.expensesByCategory.map((item) => (
            <div className="flex items-center justify-between text-sm" key={item.category}>
              <span>{item.category}</span>
              <div className="flex items-center gap-3">
                <strong>{formatCurrency(item.amount, currency)}</strong>
                <button className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300" onClick={() => openCategoryDetail(item)} type="button">Ver detalle</button>
              </div>
            </div>
          )) : <p className="text-sm text-slate-500">Sin egresos.</p>}
        </div>
      </details>
    </div>
    <ReadOnlyList title={`Citas (${records.appointments.length})`} empty="Sin citas." items={records.appointments.map((item) => ({ key: item.id, title: formatDate(item.dateTime), detail: `${formatCurrency(item.expectedAmount, item.currency as CurrencyCode)} · ${item.completed ? 'Completada' : 'Registrada'}` }))} />
    {detailRequest && (
      <RecordDetailDialog onClose={closeDetail} open={isDetailOpen} request={detailRequest} />
    )}
  </section>
}

function ReadOnlyList({ title, empty, items }: { title: string; empty: string; items: RecordDetailItem[] }) {
  return <details className="group rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><summary className="flex cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden"><span>{title}</span><ChevronDown aria-hidden="true" className="size-4 text-slate-400 transition-transform group-open:rotate-180" /></summary>{items.length ? <ul className="mt-3 divide-y divide-slate-100">{items.map((item, index) => <li className="py-2 text-sm" key={item.key ?? index}><p className="font-medium">{item.title}</p><p className="mt-0.5 text-slate-500">{item.detail}</p></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">{empty}</p>}</details>
}

export default SeasonDetailPage
