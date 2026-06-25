import {
  ArrowRight,
  CalendarRange,
  Eye,
  EyeOff,
  MinusCircle,
  PlusCircle,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { calculateFinancialTotals } from '../../utils/financeStats'
import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'

function monthRange(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)

  return {
    from: start.toLocaleDateString('en-CA'),
    to: end.toLocaleDateString('en-CA'),
  }
}

function Variation({ current, previous }: { current: number; previous: number }) {
  if (previous <= 0) {
    return (
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {previous === 0 && current > 0
          ? 'Nueva actividad este mes'
          : 'Sin datos el mes anterior'}
      </span>
    )
  }

  const value = ((current - previous) / previous) * 100
  const formatted = `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`

  return (
    <span
      className={[
        'rounded-full px-2.5 py-1 text-xs font-semibold',
        value >= 0
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
      ].join(' ')}
    >
      {formatted} vs. mes anterior
    </span>
  )
}

export function HomePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [currentIncomes, setCurrentIncomes] = useState<ServiceIncome[]>([])
  const [currentExpenses, setCurrentExpenses] = useState<Expense[]>([])
  const [previousIncomes, setPreviousIncomes] = useState<ServiceIncome[]>([])
  const [previousExpenses, setPreviousExpenses] = useState<Expense[]>([])
  const [activePeriod, setActivePeriod] = useState<EarningPeriod | null>(null)
  const { hidden, toggle } = useSensitiveValues()

  useEffect(() => {
    let mounted = true
    const current = monthRange(0)
    const previous = monthRange(-1)

    Promise.all([
      getSettings(),
      getActiveEarningPeriod(),
      listServiceIncomes(current),
      listExpenses(current),
      listServiceIncomes(previous),
      listExpenses(previous),
    ]).then(([nextSettings, period, incomes, expenses, oldIncomes, oldExpenses]) => {
      if (!mounted) return
      const isBasicUser = nextSettings.userType === 'basic'
      setSettings(nextSettings)
      setActivePeriod(period ?? null)
      setCurrentIncomes(isBasicUser ? incomes : incomes.filter((item) => item.earningPeriodId === period?.id))
      setCurrentExpenses(isBasicUser ? expenses : expenses.filter((item) => item.earningPeriodId === period?.id))
      setPreviousIncomes(isBasicUser ? oldIncomes : oldIncomes.filter((item) => item.earningPeriodId === period?.id))
      setPreviousExpenses(isBasicUser ? oldExpenses : oldExpenses.filter((item) => item.earningPeriodId === period?.id))
    })

    return () => {
      mounted = false
    }
  }, [])

  const totals = useMemo(() => {
    if (!settings) return null
    return {
      current: calculateFinancialTotals(
        currentIncomes,
        currentExpenses,
        settings.defaultCurrency,
        settings.secondaryCurrency,
      ),
      previous: calculateFinancialTotals(
        previousIncomes,
        previousExpenses,
        settings.defaultCurrency,
        settings.secondaryCurrency,
      ),
    }
  }, [currentExpenses, currentIncomes, previousExpenses, previousIncomes, settings])

  if (!settings || !totals) {
    return <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">Cargando...</section>
  }

  if (settings.userType === 'primary' && !activePeriod) {
    return <section className="mx-auto flex min-h-[70dvh] w-full max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <CalendarRange className="size-12 text-emerald-700" />
      <div><h1 className="text-2xl font-semibold">No hay temporada activa</h1><p className="mt-2 text-sm text-slate-500">Para registrar ingresos, egresos y citas, primero debes crear una temporada desde el módulo Temporadas.</p></div>
      <Link className="inline-flex h-11 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" to="/temporadas">Ir a Temporadas</Link>
    </section>
  }

  const cards = [
    {
      icon: PlusCircle,
      label: 'Ingresos',
      value: totals.current.primaryIncome,
      previous: totals.previous.primaryIncome,
      sensitive: true,
      tone: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
      icon: MinusCircle,
      label: 'Egresos',
      value: totals.current.primaryExpenses,
      previous: totals.previous.primaryExpenses,
      sensitive: true,
      tone: 'text-rose-700 bg-rose-100 dark:bg-rose-950 dark:text-rose-300',
    },
    {
      icon: TrendingUp,
      label: 'Ganancia',
      value: totals.current.primaryNet,
      previous: totals.previous.primaryNet,
      sensitive: true,
      tone: 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-300',
    },
  ]

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6 md:py-10">
      <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-300">{settings.businessName || 'Private Balance'}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Inicio</h1>
            <p className="mt-2 text-sm text-slate-300">Resumen financiero del mes actual</p>
          </div>
          <button
            aria-label={hidden ? 'Mostrar valores sensibles' : 'Ocultar valores sensibles'}
            className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={toggle}
            type="button"
          >
            {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(({ icon: Icon, label, previous, sensitive, tone, value }) => (
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" key={label}>
            <div className="flex items-center justify-between gap-3">
              <span className={`flex size-11 items-center justify-center rounded-xl ${tone}`}><Icon className="size-5" aria-hidden="true" /></span>
              <Variation current={value} previous={previous} />
            </div>
            <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
              <SensitiveAmount hidden={sensitive && hidden} value={formatCurrency(value, settings.defaultCurrency)} />
            </p>
          </article>
        ))}
      </div>

      {settings.userType === 'primary' && (
        <Link className="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:self-end" to="/resumen-completo">
          Ver todo el resumen
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

export default HomePage
