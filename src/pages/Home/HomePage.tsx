import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CalendarRange,
  Eye,
  EyeOff,
  HeartPulse,
  Lightbulb,
  ListChecks,
  MessageCircleMore,
  MinusCircle,
  PlusCircle,
  ReceiptText,
  Pause,
  Play,
  Save,
  XCircle,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { SensitiveAmount } from '../../components/SensitiveAmount'
import { SeasonGoalCard } from '../../components/seasons/SeasonGoalCard'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import { listAppointments } from '../../services/appointmentService'
import { listExpenses } from '../../services/expenseService'
import { getPendingIncomeSummary, type PendingIncomeSummary } from '../../services/incomeReport.service'
import { listServiceIncomes } from '../../services/incomeService'
import { buildFinancialCopilotSnapshot } from '../../services/financialCopilotService'
import { buildHomeBalanceSummary, resolveHomeBalanceSummaryPromotion } from '../../services/homeBalanceSummaryService'
import { buildFinancialCopilot } from '../../intelligence/deterministic-copilot'
import type { BalanceReportResult } from '../../services/balanceReportService'
import { getSettings } from '../../services/settingsService'
import type { Appointment } from '../../types/appointment'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import { formatCurrency, roundMoney } from '../../utils/currency'
import { calculateFinancialTotals, sumIncomeAdditionalsValue } from '../../utils/financeStats'
import { getIncomeTypeLabel } from '../../utils/incomeTypes'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'
import { getActiveEarningPeriod, getSeasonGoalProgress, getSeasonStatistics, type SeasonStatistics } from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { FinancialGoal } from '../../types/financialGoal'
import { financialGoalService } from '../../services/financialGoalService'
import { buildFinancialGoalPresentation } from '../../services/financialGoalPresentation'
import { HOME_SECTION_ORDER } from './homeSectionOrder'
import type {
  CivilDate,
  IanaTimeZone,
  SnapshotCandidateId,
  SnapshotNormativeCode,
  UtcInstant,
} from '../../types/financialSnapshot'
import {
  hasRecordsForUsageMode,
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
} from '../../utils/usageMode'

function formatShortDateTime(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(`${value}T00:00`))
}

interface RecentMovement {
  key: string
  kind: 'ingreso' | 'gasto'
  date: string
  label: string
  amount: number
  currency: string
  href: string
}

function buildRecentMovements(incomes: ServiceIncome[], expenses: Expense[]): RecentMovement[] {
  const incomeMovements: RecentMovement[] = incomes.map((income) => ({
    key: `income-${income.id}`,
    kind: 'ingreso',
    date: income.date,
    label: `${getIncomeTypeLabel(income)} · ${getPaymentTypeLabel(income.paymentType)}`,
    amount: income.totalAmount,
    currency: income.currency,
    href: `/income/${income.id}`,
  }))
  const expenseMovements: RecentMovement[] = expenses.map((expense) => ({
    key: `expense-${expense.id}`,
    kind: 'gasto',
    date: expense.date,
    label: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    href: `/expenses/${expense.id}/editar`,
  }))

  return [...incomeMovements, ...expenseMovements]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5)
}

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
  const [activePeriodStats, setActivePeriodStats] = useState<SeasonStatistics | null>(null)
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
  const [pendingIncomeSummary, setPendingIncomeSummary] = useState<PendingIncomeSummary | null>(null)
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([])
  const [hasMovementHistory, setHasMovementHistory] = useState(false)
  const { hidden, toggle } = useSensitiveValues()

  useEffect(() => {
    let mounted = true

    function loadPendingIncomeSummary() {
      getPendingIncomeSummary()
        .then((summary) => {
          if (mounted) setPendingIncomeSummary(summary)
        })
        .catch((error) => {
          console.warn('No se pudo cargar el resumen de ingresos sin reportar.', error)
        })
    }

    function loadUpcomingAppointments() {
      const now = new Date()
      const twoWeeksAhead = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      listAppointments({
        from: now.toISOString(),
        to: twoWeeksAhead.toISOString(),
        completed: false,
      })
        .then((appointments) => {
          if (mounted) setUpcomingAppointments(appointments.slice(0, 3))
        })
        .catch((error) => {
          console.warn('No se pudo cargar la agenda próxima.', error)
        })
    }

    loadPendingIncomeSummary()
    loadUpcomingAppointments()

    window.addEventListener('finance-app:settings-changed', loadPendingIncomeSummary)

    return () => {
      mounted = false
      window.removeEventListener('finance-app:settings-changed', loadPendingIncomeSummary)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const current = monthRange(0)
    const previous = monthRange(-1)

    async function loadDashboard(nextSettings?: AppSettings) {
      const resolvedSettings = nextSettings ?? await getSettings()
      const [
        period,
        incomes,
        expenses,
        oldIncomes,
        oldExpenses,
        allIncomes,
        allExpenses,
        goals,
      ] = await Promise.all([
        getActiveEarningPeriod(),
        listServiceIncomes(current),
        listExpenses(current),
        listServiceIncomes(previous),
        listExpenses(previous),
        listServiceIncomes(),
        listExpenses(),
        financialGoalService.list(),
      ])
      const periodStats = period?.id ? await getSeasonStatistics(period.id) : null

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
      setSettings(resolvedSettings)
      const explicitInstant = new Date().toISOString() as UtcInstant
      setSnapshotTime({
        instant: explicitInstant,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone as IanaTimeZone,
        periodStart: current.from as CivilDate,
        periodEndExclusive: current.endExclusive as CivilDate,
      })
      setActivePeriod(period ?? null)
      setActivePeriodStats(periodStats)
      setCurrentIncomes(contextualIncomes)
      setCurrentExpenses(contextualExpenses)
      // Para variación mensual, el mes anterior no debe limitarse a la temporada activa actual.
      // De lo contrario, una temporada cerrada del mes anterior queda fuera y se muestra "sin datos".
      setPreviousIncomes(oldModeIncomes)
      setPreviousExpenses(oldModeExpenses)
      setHasMovementHistory(
        hasRecordsForUsageMode(allIncomes, resolvedSettings.usageMode) ||
          hasRecordsForUsageMode(allExpenses, resolvedSettings.usageMode),
      )
      setFinancialGoals(goals)
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

  const financialCopilot = useMemo(() => {
    if (!settings) return null

    return buildFinancialCopilot(buildFinancialCopilotSnapshot({
      asOfDate: new Date().toLocaleDateString('en-CA'),
      settings,
      currentIncomes,
      previousIncomes,
      currentExpenses,
      previousExpenses,
      pendingIncome: pendingIncomeSummary ?? { count: 0, overdueCount: 0 },
      appointments: upcomingAppointments,
      financialGoals,
    }))
  }, [currentExpenses, currentIncomes, financialGoals, pendingIncomeSummary, previousExpenses, previousIncomes, settings, upcomingAppointments])

  async function refreshFinancialGoals() {
    setFinancialGoals(await financialGoalService.list())
  }

  const recentMovements = useMemo(
    () => buildRecentMovements(currentIncomes, currentExpenses),
    [currentIncomes, currentExpenses],
  )

  if (!settings || !totals || !balanceSummary || !financialCopilot) {
    return <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">Cargando...</section>
  }

  if (requiresSeason(settings) && !activePeriod) {
    return <section className="mx-auto flex min-h-[70dvh] w-full max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <CalendarRange className="size-12 text-emerald-700" />
      <div><h1 className="text-2xl font-semibold">No hay temporada activa</h1><p className="mt-2 text-sm text-slate-500">Para registrar ingresos, egresos y citas, primero debes crear una temporada desde el módulo Temporadas.</p></div>
      <Link className="inline-flex h-11 items-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" to="/temporadas">Ir a Temporadas</Link>
    </section>
  }

  const currentAdditionalsTotal = sumIncomeAdditionalsValue(currentIncomes, settings.defaultCurrency)
  const previousAdditionalsTotal = sumIncomeAdditionalsValue(previousIncomes, settings.defaultCurrency)

  const cards = [
    {
      icon: PlusCircle,
      label: 'Ingresos',
      // additionalsTotal se muestra aparte en la tarjeta "Adicionales": no se
      // suma acá para no mostrar el mismo dinero contado dos veces.
      value: roundMoney(totals.current.primaryIncome - currentAdditionalsTotal),
      previous: roundMoney(totals.previous.primaryIncome - previousAdditionalsTotal),
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
   
    ...(!isBasicMode(settings)
      ? [
          {
            icon: Sparkles,
            label: 'Adicionales',
            value: currentAdditionalsTotal,
            previous: previousAdditionalsTotal,
            sensitive: true,
            tone: 'text-amber-700 bg-amber-100 dark:bg-amber-950 dark:text-amber-300',
          },
        ]
      : []),
       {
      icon: TrendingUp,
      label: isBasicMode(settings) ? 'Balance' : 'Ganancia',
      value: totals.current.primaryNet,
      previous: totals.previous.primaryNet,
      sensitive: true,
      tone: 'text-sky-700 bg-sky-100 dark:bg-sky-950 dark:text-sky-300',
    },
  ]
  const seasonGoalProgress =
    activePeriod && activePeriodStats
      ? getSeasonGoalProgress(activePeriod, activePeriodStats.realGain)
      : null

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-6 md:py-10">
      <header className="rounded-2xl bg-linear-to-br from-slate-950 via-slate-900 to-emerald-950 p-5 text-white shadow-xl sm:p-7">
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

      <section className="order-2" aria-labelledby="financial-summary-title">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200" id="financial-summary-title">{HOME_SECTION_ORDER[1]}</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
      </section>

      {seasonGoalProgress && activePeriod && (
        <div className="order-3">
          <SeasonGoalCard
            currency={(activePeriod.baseCurrency ?? settings.defaultCurrency) as CurrencyCode}
            hidden={hidden}
            plannedEndDate={activePeriod.plannedEndDate}
            progress={seasonGoalProgress}
          />
        </div>
      )}

      <section className="order-7" aria-labelledby="suggested-actions-title">
        <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200" id="suggested-actions-title">{HOME_SECTION_ORDER[6]}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Link className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" to="/income/nuevo">
          <PlusCircle className="size-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
          Registrar ingreso
        </Link>
        <Link className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-rose-200 hover:bg-rose-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" to="/expenses/nuevo">
          <ReceiptText className="size-5 text-rose-700 dark:text-rose-300" aria-hidden="true" />
          Registrar gasto
        </Link>
        {!isBasicMode(settings) && (
          <Link className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" to="/agenda/nueva">
            <CalendarPlus className="size-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            Crear cita
          </Link>
        )}
        <Link className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-violet-200 hover:bg-violet-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" to="/conversation">
          <MessageCircleMore className="size-5 text-violet-700 dark:text-violet-300" aria-hidden="true" />
          Consultar al Copiloto
        </Link>
        {financialCopilot.suggestedActions.map((action) => (
          <Link className="flex h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100" key={action.id} to={action.to}>
            <ArrowRight className="size-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            {action.label}
          </Link>
        ))}
        </div>
      </section>

      <section aria-labelledby="today-priorities-title" className="order-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200" id="today-priorities-title">
            <ListChecks className="size-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            {HOME_SECTION_ORDER[0]}
          </h2>
          {financialCopilot.todayPriorities.length > 0 ? <ul className="mt-3 grid gap-3">
            {financialCopilot.todayPriorities.slice(0, 1).map((priority) => (
              <li className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/40" key={priority.id}>
                <span className="text-sm font-medium text-amber-950 dark:text-amber-100">{priority.message}</span>
                <Link className="shrink-0 text-xs font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-200" to={priority.action.to}>
                  {priority.action.label}
                </Link>
              </li>
            ))}
          </ul> : <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">No hay asuntos urgentes para hoy.</p>}
      </section>

      <div className="contents">
        {!isBasicMode(settings) && (
          <article className="order-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <CalendarClock className="size-5 text-sky-700 dark:text-sky-300" aria-hidden="true" />
                {HOME_SECTION_ORDER[4]}
              </h2>
              <Link className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/agenda">
                Ver agenda
              </Link>
            </div>
            {upcomingAppointments.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                No tienes citas próximas en los siguientes 14 días.
              </p>
            ) : (
              <ul className="mt-4 flex flex-col gap-2">
                {upcomingAppointments.map((appointment) => (
                  <li key={appointment.id}>
                    <Link
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40"
                      to={`/agenda/${appointment.id}/editar`}
                    >
                      <span className="text-slate-700 dark:text-slate-200">{formatShortDateTime(appointment.dateTime)}</span>
                      <span className="font-semibold text-slate-950 dark:text-white">
                        <SensitiveAmount hidden={hidden} value={formatCurrency(appointment.expectedAmount, settings.defaultCurrency)} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>
        )}

        <article className="order-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <HeartPulse className="size-5 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            {HOME_SECTION_ORDER[2]}
          </h2>
          <p className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{financialCopilot.financialHealth.label}</p>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{financialCopilot.financialHealth.explanation}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-600 dark:text-slate-300">
            {financialCopilot.financialHealth.reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
          <div className="my-4 border-t border-slate-200 dark:border-slate-800" />
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Lightbulb className="size-5 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            Resumen del Copiloto
          </h3>
          <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{financialCopilot.summary}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {financialCopilot.insights.slice(0, 2).map((insight) => (
              <li
                className={[
                  'rounded-lg border px-3 py-2 text-sm',
                  insight.tone === 'attention'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
                    : insight.tone === 'positive'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-200',
                ].join(' ')}
                key={insight.id}
              >
                <p className="font-medium">{insight.message}</p>
                <p className="mt-1 text-xs leading-5 opacity-80">{insight.explanation}</p>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-semibold">Ver evidencia</summary>
                  <ul className="mt-1 space-y-1">
                    {insight.evidence.map((evidence) => (
                      <li key={`${insight.id}-${evidence.metric}`}>
                        {formatCurrency(evidence.currentValue, settings.defaultCurrency)} · {evidence.period}
                      </li>
                    ))}
                  </ul>
                </details>
                {insight.action && (
                  <Link className="mt-2 inline-flex text-xs font-semibold underline-offset-4 hover:underline" to={insight.action.to}>
                    {insight.action.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Link className="mt-4 inline-flex text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/resumen-completo">
            Ver todo
          </Link>
        </article>
      </div>

      {financialGoals.filter((goal) => goal.status !== 'cancelled').length > 0 ? (
        <section aria-labelledby="financial-goals-title" className="order-4 border-y border-slate-200 py-5 dark:border-slate-800">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200" id="financial-goals-title">{HOME_SECTION_ORDER[3]}</h2>
            <Link className="text-xs font-semibold text-emerald-700 dark:text-emerald-300" to="/conversation?query=Quiero%20crear%20un%20objetivo%20de%20ahorro">Crear objetivo</Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
            {financialGoals.filter((goal) => goal.status !== 'cancelled').map((goal) => {
              const progress = financialCopilot.readModels.goalProgress.metrics.find((item) => item.goalId === goal.id)
              const presentation = progress
                ? buildFinancialGoalPresentation(goal, progress, new Date().toLocaleDateString('en-CA'))
                : null
              return (
                <li className="grid gap-3 py-3 sm:grid-cols-[1fr_auto] sm:items-center" key={goal.id}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{goal.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {progress ? `${formatCurrency(progress.currentAmount, progress.currency)} de ${formatCurrency(progress.targetAmount, progress.currency)} · ${Math.min(progress.percentage, 100).toFixed(0)} %` : 'Progreso no disponible'}
                      {presentation ? ` · ${presentation.statusLabel}` : ''}
                    </p>
                    {progress ? <progress aria-label={`Progreso de ${goal.name}`} className="mt-2 h-2 w-full accent-emerald-700" max="100" value={Math.min(progress.percentage, 100)} /> : null}
                    {presentation ? (
                      <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <p>{presentation.daysRemaining} días restantes · Actualizado: {presentation.updatedAtLabel}</p>
                        <p className="text-slate-700 dark:text-slate-200">{presentation.recommendation}</p>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="sr-only" htmlFor={`goal-target-${goal.id}`}>Importe objetivo</label>
                    <input className="h-10 w-28 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900" defaultValue={goal.targetAmount} id={`goal-target-${goal.id}`} min="0.01" step="0.01" type="number" />
                    <button aria-label="Guardar importe objetivo" className="flex size-10 items-center justify-center rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-slate-800" onClick={() => { const input = document.getElementById(`goal-target-${goal.id}`) as HTMLInputElement | null; if (input) void financialGoalService.update(goal.id, { targetAmount: Number(input.value) }).then(refreshFinancialGoals) }} type="button"><Save className="size-4" aria-hidden="true" /></button>
                    <button aria-label={goal.status === 'paused' ? 'Reanudar objetivo' : 'Pausar objetivo'} className="flex size-10 items-center justify-center rounded-md hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:hover:bg-slate-800" onClick={() => void financialGoalService.setStatus(goal.id, goal.status === 'paused' ? 'active' : 'paused').then(refreshFinancialGoals)} type="button">{goal.status === 'paused' ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}</button>
                    <button aria-label="Cancelar objetivo" className="flex size-10 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 dark:hover:bg-rose-950" onClick={() => void financialGoalService.cancel(goal.id).then(refreshFinancialGoals)} type="button"><XCircle className="size-4" aria-hidden="true" /></button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <article className="order-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{HOME_SECTION_ORDER[5]}</h2>
          {recentMovements.length > 0 || hasMovementHistory ? (
            <Link className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-300" to="/movements">
              Ver todos
            </Link>
          ) : null}
        </div>
        {recentMovements.length === 0 ? (
          <div className="mt-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Aún no hay movimientos este mes</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Usa Registrar ingreso o Registrar gasto en Acciones sugeridas para comenzar.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {recentMovements.map((movement) => (
              <li key={movement.key}>
                <Link
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/40"
                  to={movement.href}
                >
                  <span className="min-w-0 truncate text-slate-700 dark:text-slate-200">
                    {movement.label} · {formatShortDate(movement.date)}
                  </span>
                  <span
                    className={[
                      'shrink-0 font-semibold',
                      movement.kind === 'ingreso'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-rose-700 dark:text-rose-300',
                    ].join(' ')}
                  >
                    {movement.kind === 'ingreso' ? '+' : '-'}
                    <SensitiveAmount hidden={hidden} value={formatCurrency(movement.amount, movement.currency as CurrencyCode)} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>

      {!isBasicMode(settings) && (
        <Link className="order-8 inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-lg bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:self-end" to="/resumen-completo">
          Ver todo el resumen
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      )}
    </section>
  )
}

export default HomePage
