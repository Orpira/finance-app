import {
  answerFinancialCopilotQuery,
  canAnswerFinancialCopilotQuery,
  canAnswerFinancialCopilotFollowUp,
  createInsufficientContextAnswer,
  createFinancialCopilotSessionMemory,
  type FinancialCopilotQueryAnswer,
  type FinancialCopilotSessionMemory,
  type FinancialCopilotSessionSnapshot,
  type FinancialCopilotSnapshot,
} from '../intelligence/deterministic-copilot'
import type { Appointment } from '../types/appointment'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'
import type { FinancialGoal } from '../types/financialGoal'
import {
  calculateFinancialTotals,
  getStoredExpenseValue,
  getStoredIncomeValue,
} from '../utils/financeStats'
import { isBasicMode, recordBelongsToUsageMode } from '../utils/usageMode'
import { listAppointments } from './appointmentService'
import { getActiveEarningPeriod } from './earningPeriodService'
import { listExpenses } from './expenseService'
import { getPendingIncomeSummary } from './incomeReport.service'
import { listServiceIncomes } from './incomeService'
import { getSettings } from './settingsService'
import { calculateFinancialGoalProgress, financialGoalService } from './financialGoalService'

export interface BuildFinancialCopilotSnapshotInput {
  readonly asOfDate: string
  readonly calculatedAt?: string
  readonly settings: AppSettings
  readonly currentIncomes: readonly ServiceIncome[]
  readonly previousIncomes: readonly ServiceIncome[]
  readonly currentExpenses: readonly Expense[]
  readonly previousExpenses: readonly Expense[]
  readonly pendingIncome: {
    readonly count: number
    readonly overdueCount: number
  }
  readonly appointments: readonly Appointment[]
  readonly financialGoals?: readonly FinancialGoal[]
}

function previousCivilDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function getMonthMetadata(asOfDate: string, offset: number) {
  const [year, month] = asOfDate.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1 + offset, 1))
  const end = new Date(Date.UTC(year, month + offset, 0))
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(start),
  }
}

function weekRange(asOfDate: string, offset: number) {
  const date = new Date(`${asOfDate}T00:00:00.000Z`)
  const mondayOffset = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - mondayOffset + offset * 7)
  const start = date.toISOString().slice(0, 10)
  date.setUTCDate(date.getUTCDate() + 6)
  return { start, end: date.toISOString().slice(0, 10) }
}

function uniqueSortedDates(records: readonly { readonly date: string }[]): string[] {
  return [...new Set(records.map((record) => record.date))].sort()
}

export function buildFinancialCopilotSnapshot(
  input: BuildFinancialCopilotSnapshotInput,
): FinancialCopilotSnapshot {
  const currency = input.settings.defaultCurrency
  const currentTotals = calculateFinancialTotals(
    [...input.currentIncomes],
    [...input.currentExpenses],
    currency,
    input.settings.secondaryCurrency,
  )
  const previousTotals = calculateFinancialTotals(
    [...input.previousIncomes],
    [...input.previousExpenses],
    currency,
    input.settings.secondaryCurrency,
  )
  const allIncomes = [...input.currentIncomes, ...input.previousIncomes]
  const allExpenses = [...input.currentExpenses, ...input.previousExpenses]
  const selectRange = <T extends { readonly date: string }>(records: readonly T[], range: { start: string; end: string }) =>
    records.filter((record) => record.date >= range.start && record.date <= range.end)
  const currentWeekRange = weekRange(input.asOfDate, 0)
  const previousWeekRange = weekRange(input.asOfDate, -1)
  const currentWeekIncomes = selectRange(allIncomes, currentWeekRange)
  const currentWeekExpenses = selectRange(allExpenses, currentWeekRange)
  const previousWeekIncomes = selectRange(allIncomes, previousWeekRange)
  const previousWeekExpenses = selectRange(allExpenses, previousWeekRange)
  const currentWeekTotals = calculateFinancialTotals(
    currentWeekIncomes,
    currentWeekExpenses,
    currency,
    input.settings.secondaryCurrency,
  )
  const previousWeekTotals = calculateFinancialTotals(
    previousWeekIncomes,
    previousWeekExpenses,
    currency,
    input.settings.secondaryCurrency,
  )
  const categories = new Map<string, { amount: number; count: number }>()

  for (const expense of input.currentExpenses) {
    const current = categories.get(expense.category) ?? { amount: 0, count: 0 }
    categories.set(expense.category, {
      amount: current.amount + getStoredExpenseValue(expense, currency),
      count: current.count + 1,
    })
  }

  const pendingAppointments = input.appointments
    .filter((appointment) => !appointment.completed && appointment.dateTime.slice(0, 10) >= input.asOfDate)
    .sort((left, right) => left.dateTime.localeCompare(right.dateTime))
  const previousAppointments = input.appointments
    .filter((appointment) => appointment.dateTime.slice(0, 10) < input.asOfDate)
    .sort((left, right) => right.dateTime.localeCompare(left.dateTime))
  const yesterday = previousCivilDate(input.asOfDate)
  const yesterdayIncomes = input.currentIncomes.filter((income) => income.date === yesterday)

  return {
    asOfDate: input.asOfDate,
    calculatedAt: input.calculatedAt ?? `${input.asOfDate}T00:00:00.000Z`,
    source: 'local-financial-domain',
    period: {
      current: getMonthMetadata(input.asOfDate, 0),
      previous: getMonthMetadata(input.asOfDate, -1),
    },
    limitations: [],
    currency,
    currentMonth: {
      income: currentTotals.primaryIncome,
      expenses: currentTotals.primaryExpenses,
      incomeCount: input.currentIncomes.length,
      expenseCount: input.currentExpenses.length,
    },
    previousMonth: {
      income: previousTotals.primaryIncome,
      expenses: previousTotals.primaryExpenses,
      incomeCount: input.previousIncomes.length,
      expenseCount: input.previousExpenses.length,
    },
    currentWeek: {
      income: currentWeekTotals.primaryIncome,
      expenses: currentWeekTotals.primaryExpenses,
      incomeCount: currentWeekIncomes.length,
      expenseCount: currentWeekExpenses.length,
    },
    previousWeek: {
      income: previousWeekTotals.primaryIncome,
      expenses: previousWeekTotals.primaryExpenses,
      incomeCount: previousWeekIncomes.length,
      expenseCount: previousWeekExpenses.length,
    },
    movementDates: {
      currentIncome: uniqueSortedDates(input.currentIncomes),
      currentExpenses: uniqueSortedDates(input.currentExpenses),
      previousIncome: uniqueSortedDates(input.previousIncomes),
      previousExpenses: uniqueSortedDates(input.previousExpenses),
    },
    goalProgress: (input.financialGoals ?? [])
      .filter((goal) => goal.status !== 'cancelled')
      .map((goal) => calculateFinancialGoalProgress(
        goal,
        allIncomes,
        allExpenses,
        input.settings.secondaryCurrency,
        input.calculatedAt ?? `${input.asOfDate}T00:00:00.000Z`,
      )),
    expenseCategories: Array.from(categories, ([category, values]) => ({
      category,
      amount: values.amount,
      count: values.count,
    })).sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category, 'es')),
    pendingIncome: { ...input.pendingIncome },
    appointments: {
      todayPendingCount: pendingAppointments.filter((appointment) => appointment.dateTime.slice(0, 10) === input.asOfDate).length,
      nextPendingDateTime: pendingAppointments[0]?.dateTime ?? null,
      lastDateTime: previousAppointments[0]?.dateTime ?? null,
    },
    yesterdayIncome: {
      amount: yesterdayIncomes.reduce(
        (total, income) => total + getStoredIncomeValue(income, currency),
        0,
      ),
      count: yesterdayIncomes.length,
    },
  }
}

interface FinancialCopilotServiceDependencies {
  readonly now?: () => Date
  readonly getSettings?: typeof getSettings
  readonly getActiveEarningPeriod?: typeof getActiveEarningPeriod
  readonly listServiceIncomes?: typeof listServiceIncomes
  readonly listExpenses?: typeof listExpenses
  readonly listAppointments?: typeof listAppointments
  readonly getPendingIncomeSummary?: typeof getPendingIncomeSummary
  readonly listFinancialGoals?: typeof financialGoalService.list
}

function monthRange(reference: Date, offset: number) {
  const start = new Date(reference.getFullYear(), reference.getMonth() + offset, 1)
  const end = new Date(reference.getFullYear(), reference.getMonth() + offset + 1, 0)
  return {
    from: start.toLocaleDateString('en-CA'),
    to: end.toLocaleDateString('en-CA'),
  }
}

export function createFinancialCopilotService(
  input: FinancialCopilotServiceDependencies = {},
) {
  const dependencies = {
    now: input.now ?? (() => new Date()),
    getSettings: input.getSettings ?? getSettings,
    getActiveEarningPeriod: input.getActiveEarningPeriod ?? getActiveEarningPeriod,
    listServiceIncomes: input.listServiceIncomes ?? listServiceIncomes,
    listExpenses: input.listExpenses ?? listExpenses,
    listAppointments: input.listAppointments ?? listAppointments,
    getPendingIncomeSummary: input.getPendingIncomeSummary ?? getPendingIncomeSummary,
    listFinancialGoals: input.listFinancialGoals ?? (() => financialGoalService.list()),
  }

  return {
    async loadSnapshot(): Promise<FinancialCopilotSnapshot> {
      const now = dependencies.now()
      const currentRange = monthRange(now, 0)
      const previousRange = monthRange(now, -1)
      const [settings, activePeriod, currentIncomes, previousIncomes, currentExpenses, previousExpenses, pendingIncome, financialGoals] = await Promise.all([
        dependencies.getSettings(),
        dependencies.getActiveEarningPeriod(),
        dependencies.listServiceIncomes(currentRange),
        dependencies.listServiceIncomes(previousRange),
        dependencies.listExpenses(currentRange),
        dependencies.listExpenses(previousRange),
        dependencies.getPendingIncomeSummary(),
        dependencies.listFinancialGoals(),
      ])
      const periodId = isBasicMode(settings) ? undefined : activePeriod?.id
      const appointments = isBasicMode(settings)
        ? []
        : await dependencies.listAppointments(periodId === undefined ? {} : { earningPeriodId: periodId })
      const filterMode = <T extends { usageMode?: AppSettings['usageMode']; earningPeriodId?: number; seasonPeriodId?: number }>(
        records: readonly T[],
        restrictToActivePeriod: boolean,
      ) => records.filter((record) => {
        if (!recordBelongsToUsageMode(record, settings.usageMode)) return false
        if (!restrictToActivePeriod || periodId === undefined) return true
        return record.earningPeriodId === periodId || record.seasonPeriodId === periodId
      })

      return buildFinancialCopilotSnapshot({
        asOfDate: now.toLocaleDateString('en-CA'),
        calculatedAt: now.toISOString(),
        settings,
        currentIncomes: filterMode(currentIncomes, true),
        previousIncomes: filterMode(previousIncomes, false),
        currentExpenses: filterMode(currentExpenses, true),
        previousExpenses: filterMode(previousExpenses, false),
        pendingIncome,
        appointments,
        financialGoals,
      })
    },
  }
}

export interface LocalFinancialCopilotQueryHandler {
  answer(query: string): Promise<FinancialCopilotQueryAnswer | null>
  clearMemory(): void
  getMemory(): FinancialCopilotSessionSnapshot | null
  removeMemoryFilter(filter: 'period' | 'currency' | 'category'): void
}

export function createLocalFinancialCopilotQueryHandler(input: {
  readonly loadSnapshot?: () => Promise<FinancialCopilotSnapshot>
} = {}): LocalFinancialCopilotQueryHandler {
  const service = createFinancialCopilotService()
  const loadSnapshot = input.loadSnapshot ?? (() => service.loadSnapshot())
  let memory: FinancialCopilotSessionMemory | null = null

  return {
    async answer(query) {
      const isDirectQuery = canAnswerFinancialCopilotQuery(query)
      const isFollowUp = canAnswerFinancialCopilotFollowUp(query)
      if (!isDirectQuery && !isFollowUp) return null
      const snapshot = await loadSnapshot()
      memory ??= createFinancialCopilotSessionMemory({ currency: snapshot.currency })
      const currentMemory = memory.getSnapshot()
      let answer = isDirectQuery ? answerFinancialCopilotQuery(query, snapshot) : null

      if (answer === null && isFollowUp) {
        const normalized = query.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (/y el mes anterior|mes anterior\?*$/.test(normalized)) {
          if (currentMemory.lastMetric === 'income' || currentMemory.lastMetric === 'expenses') {
            const isIncome = currentMemory.lastMetric === 'income'
            const value = isIncome ? snapshot.previousMonth.income : snapshot.previousMonth.expenses
            const count = isIncome ? snapshot.previousMonth.incomeCount : snapshot.previousMonth.expenseCount
            const formatted = new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.currency }).format(value)
            answer = {
              intent: 'previous-period',
              text: `En ${snapshot.period.previous.label} registraste ${formatted} en ${isIncome ? 'ingresos' : 'gastos'}.`,
              explanation: `El total corresponde a ${count} movimientos del mes anterior.`,
              period: 'previous_month',
              category: null,
              metric: currentMemory.lastMetric,
            }
          }
        } else if (/por que|explicame (ese|el) cambio/.test(normalized)) {
          if (currentMemory.lastResult !== null) {
            answer = {
              intent: 'context-explanation',
              text: currentMemory.lastResult.explanation,
              explanation: `Esta explicación se refiere a: ${currentMemory.lastResult.text}`,
              period: currentMemory.period,
              category: currentMemory.lastCategory,
              ...(currentMemory.lastMetric === null ? {} : { metric: currentMemory.lastMetric }),
            }
          }
        } else if (/categoria principal|categoria fue la (mayor|principal)/.test(normalized)) {
          if (currentMemory.lastMetric === 'expenses') {
            const topCategory = snapshot.expenseCategories[0]
            answer = {
              intent: 'top-category-follow-up',
              text: topCategory === undefined
                ? 'No hay gastos por categoría en el periodo activo.'
                : `${topCategory.category} fue la categoría principal con ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.currency }).format(topCategory.amount)}.`,
              explanation: topCategory === undefined ? 'No existen movimientos comparables.' : `Agrupa ${topCategory.count} gastos del periodo.`,
              period: currentMemory.period,
              category: topCategory?.category ?? null,
              metric: 'expenses',
            }
          }
        } else if (/cuantos movimientos fueron/.test(normalized)) {
          if (currentMemory.lastMetric !== null) {
            const previous = currentMemory.period === 'previous_month'
            const period = previous ? snapshot.previousMonth : snapshot.currentMonth
            const count = currentMemory.lastMetric === 'income'
              ? period.incomeCount
              : currentMemory.lastMetric === 'expenses'
                ? period.expenseCount
                : period.incomeCount + period.expenseCount
            answer = {
              intent: 'movement-count-follow-up',
              text: `Fueron ${count} movimientos en el periodo consultado.`,
              explanation: 'El conteo usa los movimientos locales incluidos en el mismo periodo y filtro.',
              period: currentMemory.period,
              category: currentMemory.lastCategory,
              metric: currentMemory.lastMetric,
            }
          }
        } else if (/que fechas/.test(normalized)) {
          if (currentMemory.lastMetric === 'income' || currentMemory.lastMetric === 'expenses') {
            const previous = currentMemory.period === 'previous_month'
            const dates = currentMemory.lastMetric === 'income'
              ? (previous ? snapshot.movementDates.previousIncome : snapshot.movementDates.currentIncome)
              : (previous ? snapshot.movementDates.previousExpenses : snapshot.movementDates.currentExpenses)
            const formattedDates = dates.map((date) => new Intl.DateTimeFormat('es-ES', {
              day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
            }).format(new Date(`${date}T00:00:00.000Z`)))
            answer = {
              intent: 'movement-dates-follow-up',
              text: formattedDates.length === 0 ? 'No hay fechas para el resultado consultado.' : `Fechas: ${formattedDates.join(', ')}.`,
              explanation: 'Son las fechas únicas de los movimientos incluidos en el último periodo y métrica.',
              period: currentMemory.period,
              category: currentMemory.lastCategory,
              metric: currentMemory.lastMetric,
            }
          }
        } else if (/solo (los )?pendientes|muestrame.*pendientes/.test(normalized)) {
          answer = {
            intent: 'pending-only-follow-up',
            text: `Tienes ${snapshot.pendingIncome.count} ingresos sin reportar.`,
            explanation: `${snapshot.pendingIncome.overdueCount} superan los 7 días pendientes.`,
            period: currentMemory.period,
            category: null,
            metric: 'pending_income',
          }
        } else if (/comparalo con la semana anterior|semana anterior/.test(normalized)) {
          if (currentMemory.lastMetric === 'income' || currentMemory.lastMetric === 'expenses') {
            const metric = currentMemory.lastMetric
            const current = metric === 'income' ? snapshot.currentWeek.income : snapshot.currentWeek.expenses
            const previous = metric === 'income' ? snapshot.previousWeek.income : snapshot.previousWeek.expenses
            const money = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.currency }).format(value)
            answer = {
              intent: 'previous-week-comparison',
              text: `Esta semana: ${money(current)}. Semana anterior: ${money(previous)}.`,
              explanation: `La diferencia es ${money(current - previous)} usando la misma métrica en semanas completas de lunes a domingo.`,
              period: 'previous_week',
              category: currentMemory.lastCategory,
              metric,
            }
          }
        } else if (/que puedo hacer/.test(normalized)) {
          if (currentMemory.lastMetric !== null) {
            const label = currentMemory.lastMetric === 'pending_income'
              ? 'Revisar los ingresos pendientes y marcar uno tras confirmarlo.'
              : currentMemory.lastCategory
                ? `Abrir los movimientos filtrados por ${currentMemory.lastCategory}.`
                : 'Comparar el periodo o abrir los movimientos que forman el resultado.'
            answer = {
              intent: 'suggested-action-follow-up',
              text: label,
              explanation: 'La acción sugerida está vinculada al último resultado calculado en esta sesión.',
              period: currentMemory.period,
              category: currentMemory.lastCategory,
              metric: currentMemory.lastMetric,
            }
          }
        } else if (/crear una accion.*(esto|partir)/.test(normalized)) {
          if (currentMemory.lastMetric !== null) {
            answer = {
              intent: 'create-action-follow-up',
              text: 'Puedo preparar una acción relacionada, pero no ejecutaré ningún cambio sin mostrarte una propuesta y pedir confirmación.',
              explanation: 'La acción se basará únicamente en el último resultado local de esta sesión.',
              period: currentMemory.period,
              category: currentMemory.lastCategory,
              metric: currentMemory.lastMetric,
            }
          }
        } else if (/muestrame solo |solo la categoria /.test(normalized)) {
          if (currentMemory.lastMetric === 'expenses') {
            const category = snapshot.expenseCategories.find((item) => normalized.includes(item.category.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '')))
            if (category !== undefined) {
              answer = {
                intent: 'top-category-follow-up',
                text: `${category.category}: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: snapshot.currency }).format(category.amount)} en ${category.count} gastos.`,
                explanation: 'Se mantuvo el periodo activo y se aplicó únicamente el filtro de categoría solicitado.',
                period: currentMemory.period,
                category: category.category,
                metric: 'expenses',
              }
            }
          }
        }

        answer ??= createInsufficientContextAnswer()
      }
      if (answer !== null) {
        memory.remember({
          currency: snapshot.currency,
          ...(answer.period === null ? {} : { period: answer.period }),
          lastQuery: query.trim(),
          lastCategory: answer.category,
          lastMetric: answer.metric ?? currentMemory.lastMetric,
          lastResult: {
            intent: answer.intent,
            text: answer.text,
            explanation: answer.explanation,
          },
          lastFilter: answer.metric === 'income'
            ? { type: 'income' }
            : answer.metric === 'expenses'
              ? { type: 'expense', ...(answer.category === null ? {} : { category: answer.category }) }
              : answer.metric === 'pending_income'
                ? { type: 'income', reported: false }
                : currentMemory.lastFilter,
          lastEntity: answer.category === null
            ? currentMemory.lastEntity
            : { type: 'expense-category', label: answer.category },
          hiddenFilters: [],
        })
      }
      return answer
    },
    clearMemory() {
      memory?.clear()
    },
    getMemory() {
      return memory?.getSnapshot() ?? null
    },
    removeMemoryFilter(filter) {
      memory?.removeFilter(filter)
    },
  }
}
