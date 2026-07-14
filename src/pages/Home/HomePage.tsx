import {
  ArrowRight,
  CalendarRange,
  Eye,
  EyeOff,
  Landmark,
  MinusCircle,
  PlusCircle,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { SensitiveAmount } from '../../components/SensitiveAmount'
import { UsageModeBadge } from '../../components/UsageModeBadge'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { buildHomeBalanceSummary, resolveHomeBalanceSummaryPromotion } from '../../services/homeBalanceSummaryService'
import type { BalanceReportResult } from '../../services/balanceReportService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { calculateFinancialTotals } from '../../utils/financeStats'
import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'
import type {
  CivilDate,
  IanaTimeZone,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  UtcInstant,
} from '../../types/financialSnapshot'
import { getReportedCountByUsageMode } from '../../utils/reportStatus'
import {
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
} from '../../utils/usageMode'

function monthRange(offset: number) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const endExclusive = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)

  return {
    from: start.toLocaleDateString('en-CA'),
    to: end.toLocaleDateString('en-CA'),
    endExclusive: endExclusive.toLocaleDateString('en-CA'),
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
  const [reportedCount, setReportedCount] = useState(0)
  const [promotedCurrentSummary, setPromotedCurrentSummary] = useState<{
    readonly requestId: UtcInstant
    readonly summary: BalanceReportResult
  } | null>(null)
  const [snapshotTime, setSnapshotTime] = useState<{
    instant: UtcInstant
    timezone: IanaTimeZone
    periodStart: CivilDate
    periodEndExclusive: CivilDate
  } | null>(null)
  const { hidden, toggle } = useSensitiveValues()

  useEffect(() => {
    let mounted = true
    const current = monthRange(0)
    const previous = monthRange(-1)

    async function loadDashboard(nextSettings?: AppSettings) {
      const resolvedSettings = nextSettings ?? await getSettings()
      const [period, incomes, expenses, oldIncomes, oldExpenses] = await Promise.all([
        getActiveEarningPeriod(),
        listServiceIncomes(current),
        listExpenses(current),
        listServiceIncomes(previous),
        listExpenses(previous),
      ])

      if (!mounted) return

      const isBasicUser = isBasicMode(resolvedSettings)
      const modeIncomes = incomes.filter((item) =>
        recordBelongsToUsageMode(item, resolvedSettings.usageMode),
      )
      const modeExpenses = expenses.filter((item) =>
        recordBelongsToUsageMode(item, resolvedSettings.usageMode),
      )
      const oldModeIncomes = oldIncomes.filter((item) =>
        recordBelongsToUsageMode(item, resolvedSettings.usageMode),
      )
      const oldModeExpenses = oldExpenses.filter((item) =>
        recordBelongsToUsageMode(item, resolvedSettings.usageMode),
      )
      const belongsToActivePeriod = (item: {
        earningPeriodId?: number
        seasonPeriodId?: number
      }) =>
        period?.id !== undefined &&
        (item.earningPeriodId === period.id || item.seasonPeriodId === period.id)
      const contextualIncomes = isBasicUser
        ? modeIncomes
        : modeIncomes.filter(belongsToActivePeriod)
      const contextualExpenses = isBasicUser
        ? modeExpenses
        : modeExpenses.filter(belongsToActivePeriod)
      const matchesActiveLocation = (item: { country?: string; city?: string }) =>
        (!item.country || item.country === resolvedSettings.country) &&
        (!resolvedSettings.city || !item.city || item.city === resolvedSettings.city)
      const reportableContextRecords = (
        isBasicUser ? contextualExpenses : contextualIncomes
      ).filter(matchesActiveLocation)

      setSettings(resolvedSettings)
      const explicitInstant = new Date().toISOString() as UtcInstant
      setSnapshotTime({
        instant: explicitInstant,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as IanaTimeZone,
        periodStart: current.from as CivilDate,
        periodEndExclusive: current.endExclusive as CivilDate,
      })
      setActivePeriod(period ?? null)
      setReportedCount(
        getReportedCountByUsageMode(
          reportableContextRecords,
          resolvedSettings.usageMode,
        ),
      )
      setCurrentIncomes(contextualIncomes)
      setCurrentExpenses(contextualExpenses)
      // Para variación mensual, el mes anterior no debe limitarse a la temporada activa actual.
      // De lo contrario, una temporada cerrada del mes anterior queda fuera y se muestra "sin datos".
      setPreviousIncomes(oldModeIncomes)
      setPreviousExpenses(oldModeExpenses)
    }

    void loadDashboard()

    function handleSettingsChanged(event: Event) {
      void loadDashboard((event as CustomEvent<AppSettings>).detail)
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      mounted = false
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
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

  const balanceSummary = useMemo(() => {
    if (!settings) {
      return null
    }

    return {
      current: promotedCurrentSummary !== null && promotedCurrentSummary.requestId === snapshotTime?.instant
        ? promotedCurrentSummary.summary
        : buildHomeBalanceSummary({
            incomes: currentIncomes,
            expenses: currentExpenses,
            currency: settings.defaultCurrency,
            usageMode: settings.usageMode,
            earningPeriodId: isBasicMode(settings) ? undefined : activePeriod?.id,
            scope: 'home.current-month',
            ...(snapshotTime === null
              ? {}
              : {
                  snapshotShadow: {
                    periodStart: snapshotTime.periodStart,
                    periodEndExclusive: snapshotTime.periodEndExclusive,
                    asOf: snapshotTime.instant,
                    timezone: snapshotTime.timezone,
                    candidateId: `home-current-month:${snapshotTime.periodStart}:${snapshotTime.instant}` as SnapshotCandidateId,
                    generatedAt: snapshotTime.instant,
                    sealedAt: snapshotTime.instant,
                    persistedAt: snapshotTime.instant,
                    revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
                  },
                }),
          }),
      previous: buildHomeBalanceSummary({
        incomes: previousIncomes,
        expenses: previousExpenses,
        currency: settings.defaultCurrency,
        usageMode: settings.usageMode,
        scope: 'home.previous-month',
      }),
    }
  }, [activePeriod?.id, currentExpenses, currentIncomes, previousExpenses, previousIncomes, promotedCurrentSummary, settings, snapshotTime])

  useEffect(() => {
    if (settings === null || snapshotTime === null) return
    let active = true
    const requestId = snapshotTime.instant
    void resolveHomeBalanceSummaryPromotion({
      incomes: currentIncomes,
      expenses: currentExpenses,
      currency: settings.defaultCurrency,
      usageMode: settings.usageMode,
      earningPeriodId: isBasicMode(settings) ? undefined : activePeriod?.id,
      scope: 'home.current-month',
      snapshotShadow: {
        periodStart: snapshotTime.periodStart,
        periodEndExclusive: snapshotTime.periodEndExclusive,
        asOf: snapshotTime.instant,
        timezone: snapshotTime.timezone,
        candidateId: `home-current-month:${snapshotTime.periodStart}:${snapshotTime.instant}` as SnapshotCandidateId,
        generatedAt: snapshotTime.instant,
        sealedAt: snapshotTime.instant,
        persistedAt: snapshotTime.instant,
        revisionReasonCode: 'revision.source_changed' as SnapshotNormativeCode,
      },
    }).then(({ summary }) => {
      if (active) setPromotedCurrentSummary({ requestId, summary })
    })
    return () => { active = false }
  }, [activePeriod?.id, currentExpenses, currentIncomes, settings, snapshotTime])

  if (!settings || !totals || !balanceSummary) {
    return <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">Cargando...</section>
  }

  if (requiresSeason(settings) && !activePeriod) {
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
      label: isBasicMode(settings) ? 'Balance' : 'Ganancia',
      value: totals.current.primaryNet,
      previous: totals.previous.primaryNet,
      sensitive: true,
      tone: 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-300',
    },
  ]

  const reportedCard = {
    icon: CalendarRange,
    label: isBasicMode(settings) ? 'Egresos reportados' : 'Servicios reportados',
    value: reportedCount,
    previous: 0,
    sensitive: false,
    tone: 'text-violet-700 bg-violet-100 dark:bg-violet-950 dark:text-violet-300',
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6 md:py-10">
      <header className="rounded-2xl bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-300">{settings.businessName || 'Private Balance'}</p>
            <div className="mt-2"><UsageModeBadge usageMode={settings.usageMode} /></div>
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

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <span className={`flex size-11 items-center justify-center rounded-xl ${reportedCard.tone}`}>
            <CalendarRange className="size-5" aria-hidden="true" />
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {isBasicMode(settings)
              ? 'Egresos marcados como cumplidos'
              : 'Servicios marcados como cumplidos'}
          </span>
        </div>
        <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">{reportedCard.label}</p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{reportedCard.value}</p>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Landmark className="size-5" aria-hidden="true" />
          </span>
          <Variation current={balanceSummary.current.generalBalance} previous={balanceSummary.previous.generalBalance} />
        </div>
        <p className="mt-6 text-sm font-medium text-slate-500 dark:text-slate-400">
          {isBasicMode(settings) ? 'Balance general' : 'Balance operativo'}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
          <SensitiveAmount hidden={hidden} value={formatCurrency(balanceSummary.current.generalBalance, settings.defaultCurrency)} />
        </p>
        <div className="mt-4 grid gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
          <p>
            Neto sin ajustes:{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              <SensitiveAmount hidden={hidden} value={formatCurrency(balanceSummary.current.netProfit, settings.defaultCurrency)} />
            </span>
          </p>
          <p>
            Impacto ajustes:{' '}
            <span className="font-semibold text-slate-900 dark:text-white">
              <SensitiveAmount hidden={hidden} value={formatCurrency(balanceSummary.current.impactByAdjustments, settings.defaultCurrency)} />
            </span>
          </p>
        </div>
      </article>

      {!isBasicMode(settings) && (
        <Link className="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:self-end" to="/resumen-completo">
          Ver todo el resumen
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

export default HomePage
