import {
  answerFinancialCopilotQuery,
  canAnswerFinancialCopilotQuery,
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
  }

  return {
    async loadSnapshot(): Promise<FinancialCopilotSnapshot> {
      const now = dependencies.now()
      const currentRange = monthRange(now, 0)
      const previousRange = monthRange(now, -1)
      const [settings, activePeriod, currentIncomes, previousIncomes, currentExpenses, previousExpenses, pendingIncome] = await Promise.all([
        dependencies.getSettings(),
        dependencies.getActiveEarningPeriod(),
        dependencies.listServiceIncomes(currentRange),
        dependencies.listServiceIncomes(previousRange),
        dependencies.listExpenses(currentRange),
        dependencies.listExpenses(previousRange),
        dependencies.getPendingIncomeSummary(),
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
      })
    },
  }
}

export interface LocalFinancialCopilotQueryHandler {
  answer(query: string): Promise<FinancialCopilotQueryAnswer | null>
  clearMemory(): void
  getMemory(): FinancialCopilotSessionSnapshot | null
}

export function createLocalFinancialCopilotQueryHandler(input: {
  readonly loadSnapshot?: () => Promise<FinancialCopilotSnapshot>
} = {}): LocalFinancialCopilotQueryHandler {
  const service = createFinancialCopilotService()
  const loadSnapshot = input.loadSnapshot ?? (() => service.loadSnapshot())
  let memory: FinancialCopilotSessionMemory | null = null

  return {
    async answer(query) {
      if (!canAnswerFinancialCopilotQuery(query)) return null
      const snapshot = await loadSnapshot()
      memory ??= createFinancialCopilotSessionMemory({ currency: snapshot.currency })
      const answer = answerFinancialCopilotQuery(query, snapshot)
      if (answer !== null) {
        memory.remember({
          currency: snapshot.currency,
          ...(answer.period === null ? {} : { period: answer.period }),
          lastQuery: query.trim(),
          lastCategory: answer.category,
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
  }
}
