import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ActionableEmptyState } from '../../components/ActionableEmptyState'
import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import {
  getPendingIncomeSummary,
  getPendingIncomes,
  PENDING_INCOME_OVERDUE_AFTER_DAYS,
  type PendingIncomeSummary,
} from '../../services/incomeReport.service'
import type { ServiceIncome } from '../../types/service'
import { formatCurrency } from '../../utils/currency'
import { getStoredIncomeValue } from '../../utils/financeStats'

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${date}T00:00`))
}

function groupIncomesByDate(incomes: ServiceIncome[]) {
  const groups: Array<{ date: string; incomes: ServiceIncome[] }> = []

  incomes.forEach((income) => {
    const lastGroup = groups.at(-1)
    if (lastGroup && lastGroup.date === income.date) {
      lastGroup.incomes.push(income)
    } else {
      groups.push({ date: income.date, incomes: [income] })
    }
  })

  return groups
}

export function PendingIncomeEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700">
      <ActionableEmptyState
        action={{ label: 'Ver todos los ingresos', to: '/income' }}
        compact
        description="No hay ingresos pendientes de reportar. Puedes consultar el historial completo."
        title="Todo está al día"
      />
    </div>
  )
}

export function IncomePendingReportPage() {
  const { hidden } = useSensitiveValues()
  const [summary, setSummary] = useState<PendingIncomeSummary | null>(null)
  const [pendingIncomes, setPendingIncomes] = useState<ServiceIncome[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function load() {
      const [nextSummary, nextPending] = await Promise.all([
        getPendingIncomeSummary(),
        getPendingIncomes(),
      ])

      if (!mounted) return

      setSummary(nextSummary)
      setPendingIncomes(nextPending)
      setIsLoading(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [])

  if (isLoading || !summary) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  const groups = groupIncomesByDate(pendingIncomes)

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader backLabel="Inicio" backTo="/" eyebrow="Ingresos" title="Pendientes de reportar" />

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {summary.count} {summary.count === 1 ? 'ingreso pendiente' : 'ingresos pendientes'}
          </p>
          {summary.overdueCount > 0 && (
            <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {summary.overdueCount} con más de {PENDING_INCOME_OVERDUE_AFTER_DAYS} días
            </span>
          )}
        </div>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          <SensitiveAmount hidden={hidden} value={formatCurrency(summary.totalBaseCurrency, summary.baseCurrency)} />
        </p>
        {summary.oldestPendingDate && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Más antiguo: {formatShortDate(summary.oldestPendingDate)}
          </p>
        )}
      </article>

      {groups.length === 0 ? (
        <PendingIncomeEmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const groupTotal = group.incomes.reduce(
              (total, income) => total + getStoredIncomeValue(income, summary.baseCurrency),
              0,
            )

            return (
              <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800" key={group.date}>
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {formatShortDate(group.date)}
                  </p>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    <SensitiveAmount hidden={hidden} value={formatCurrency(groupTotal, summary.baseCurrency)} />
                  </p>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.incomes.map((income) => (
                    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm" key={income.id}>
                      <span className="text-slate-700 dark:text-slate-200">
                        Servicio #{income.id} · {income.reportStatusCode === 'unreviewed' ? 'Sin revisar' : 'Pendiente'}
                      </span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        <SensitiveAmount
                          hidden={hidden}
                          value={formatCurrency(getStoredIncomeValue(income, summary.baseCurrency), summary.baseCurrency)}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      {groups.length > 0 ? (
        <Link
          className="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:self-end"
          to="/income?reportStatus=unreviewed"
        >
          Ir a Ingresos para reportarlos
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  )
}

export default IncomePendingReportPage
