import { Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { isEarningPeriodClosed } from '../../services/earningPeriodService'
import { listExpenseAdjustmentsForIncome } from '../../services/expenseService'
import { getServiceIncomeById } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { CurrencyCode } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { getIncomeTypeLabel, isServiceIncome } from '../../utils/incomeTypes'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import { recordBelongsToUsageMode, requiresSeason } from '../../utils/usageMode'

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(
    new Date(`${value}T00:00`),
  )
}

export function IncomeDetailPage() {
  const incomeId = Number(useParams().incomeId)
  const { hidden } = useSensitiveValues()
  const [income, setIncome] = useState<ServiceIncome | null>()
  const [adjustments, setAdjustments] = useState<Expense[]>([])
  const [canEdit, setCanEdit] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadDetail() {
      if (!Number.isFinite(incomeId)) {
        setIncome(null)
        return
      }

      const [currentIncome, currentAdjustments, settings] = await Promise.all([
        getServiceIncomeById(incomeId),
        listExpenseAdjustmentsForIncome(incomeId),
        getSettings(),
      ])
      if (!mounted) return

      if (
        !currentIncome ||
        !recordBelongsToUsageMode(currentIncome, settings.usageMode)
      ) {
        setIncome(null)
        return
      }

      const closed =
        requiresSeason(settings) &&
        ((await isEarningPeriodClosed(
          currentIncome.earningPeriodId ?? currentIncome.seasonPeriodId,
        )) ||
          isLocationSeasonClosed(
            currentIncome,
            settings.closedLocationSeasons,
          ))
      if (!mounted) return

      setIncome(currentIncome)
      setAdjustments(
        currentAdjustments.filter((adjustment) =>
          recordBelongsToUsageMode(adjustment, settings.usageMode),
        ),
      )
      setCanEdit(!closed)
    }

    loadDetail()
    return () => {
      mounted = false
    }
  }, [incomeId])

  if (income === undefined) {
    return <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">Cargando ingreso...</section>
  }

  if (!income) {
    return <section className="mx-auto max-w-3xl"><PageHeader backLabel="Ingresos" backTo="/income" title="Ingreso no encontrado" /></section>
  }

  const isService = isServiceIncome(income)

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Ingresos"
        backTo="/income"
        eyebrow={getIncomeTypeLabel(income)}
        title={`${getIncomeTypeLabel(income)} #${income.id}`}
      >
        {canEdit && (
          <Link className="inline-flex h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" to={`/income/${income.id}/editar`}>
            <Pencil className="size-4" aria-hidden="true" /> Modificar
          </Link>
        )}
      </PageHeader>

      <section className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
        <div><p className="text-xs font-semibold uppercase text-slate-500">Valor original</p><p className="mt-1 text-xl font-semibold"><SensitiveAmount hidden={hidden} value={formatCurrency(income.totalAmount, income.currency as CurrencyCode)} /></p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">{isService ? 'Ganancia real' : 'Monto efectivo'}</p><p className="mt-1 text-xl font-semibold"><SensitiveAmount hidden={hidden} value={formatCurrency(income.realGain, income.currency as CurrencyCode)} /></p></div>
        <div><p className="text-xs font-semibold uppercase text-slate-500">Fecha</p><p className="mt-1 font-semibold">{formatDate(income.date)}</p></div>
        {isService && <div><p className="text-xs font-semibold uppercase text-slate-500">Duración</p><p className="mt-1 font-semibold">{income.actualDuration ?? income.duration} minutos</p></div>}
        {income.notes && <div className="sm:col-span-3"><p className="text-xs font-semibold uppercase text-slate-500">Observación</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{income.notes}</p></div>}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Ajustes relacionados</h2>
          {adjustments.length > 0 && <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Afectado por ajuste · {adjustments.length}</span>}
        </div>
        {adjustments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Este ingreso no tiene ajustes de egreso relacionados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {adjustments.map((adjustment) => (
              <li className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]" key={adjustment.id}>
                <div><p className="font-medium">Ajuste #{adjustment.id} · {formatDate(adjustment.date)}</p>{adjustment.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{adjustment.notes}</p>}</div>
                <p className="font-semibold text-rose-700"><SensitiveAmount hidden={hidden} value={formatCurrency(adjustment.amount, adjustment.currency as CurrencyCode)} /></p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}

export default IncomeDetailPage
