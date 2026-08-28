import { db } from '../database/db'
import type { Expense } from '../types/expense'
import type {
  FinancialGoal,
  FinancialGoalProgress,
} from '../types/financialGoal'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'
import { calculateFinancialTotals } from '../utils/financeStats'

export type CreateFinancialGoalInput = Pick<
  FinancialGoal,
  'type' | 'name' | 'targetAmount' | 'currency' | 'period' | 'startDate' | 'endDate'
>

interface FinancialGoalRepository {
  add(goal: FinancialGoal): Promise<unknown>
  put(goal: FinancialGoal): Promise<unknown>
  get(id: string): Promise<FinancialGoal | undefined>
  toArray(): Promise<FinancialGoal[]>
}

function validateGoal(input: CreateFinancialGoalInput): void {
  if (!Number.isFinite(input.targetAmount) || input.targetAmount <= 0) {
    throw new Error('FINANCIAL_GOAL_INVALID_TARGET')
  }
  if (input.name.trim().length === 0) throw new Error('FINANCIAL_GOAL_INVALID_NAME')
  if (input.endDate !== undefined && input.endDate < input.startDate) {
    throw new Error('FINANCIAL_GOAL_INVALID_PERIOD')
  }
}

export function calculateFinancialGoalProgress(
  goal: FinancialGoal,
  incomes: readonly ServiceIncome[],
  expenses: readonly Expense[],
  secondaryCurrency: CurrencyCode,
  calculatedAt = new Date().toISOString(),
): FinancialGoalProgress {
  const inPeriod = (date: string) => date >= goal.startDate && (goal.endDate === undefined || date <= goal.endDate)
  const totals = calculateFinancialTotals(
    incomes.filter((income) => inPeriod(income.date)),
    expenses.filter((expense) => inPeriod(expense.date)),
    goal.currency,
    secondaryCurrency,
  )
  const currentAmount = roundMoney(goal.type === 'saving'
    ? Math.max(totals.primaryNet, 0)
    : goal.type === 'income_target'
      ? totals.primaryIncome
      : totals.primaryExpenses)
  const limit = goal.type === 'expense_limit'
  const rawPercentage = Math.round((currentAmount / goal.targetAmount) * 10_000) / 100
  const percentage = limit ? rawPercentage : Math.min(rawPercentage, 100)
  const state = limit
    ? currentAmount > goal.targetAmount
      ? 'limit_exceeded'
      : currentAmount === goal.targetAmount
        ? 'limit_reached'
        : 'on_track'
    : currentAmount >= goal.targetAmount
      ? 'achieved'
      : 'on_track'

  return {
    goalId: goal.id,
    goalName: goal.name,
    goalType: goal.type,
    goalStatus: goal.status,
    currentAmount,
    targetAmount: goal.targetAmount,
    remainingAmount: roundMoney(Math.max(goal.targetAmount - currentAmount, 0)),
    percentage,
    state,
    period: { start: goal.startDate, ...(goal.endDate === undefined ? {} : { end: goal.endDate }) },
    currency: goal.currency,
    source: 'local-financial-domain',
    calculatedAt,
    limitations: [],
  }
}

export function createFinancialGoalService(input: {
  readonly repository?: FinancialGoalRepository
  readonly now?: () => Date
  readonly createId?: () => string
} = {}) {
  const repository = input.repository ?? db.financialGoals
  const now = input.now ?? (() => new Date())
  const createId = input.createId ?? (() => crypto.randomUUID())

  async function requireGoal(id: string): Promise<FinancialGoal> {
    const goal = await repository.get(id)
    if (goal === undefined) throw new Error('FINANCIAL_GOAL_NOT_FOUND')
    return goal
  }

  return {
    async create(values: CreateFinancialGoalInput): Promise<FinancialGoal> {
      validateGoal(values)
      const timestamp = now().toISOString()
      const goal: FinancialGoal = {
        ...values,
        name: values.name.trim(),
        id: createId(),
        status: 'active',
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      await repository.add(goal)
      return goal
    },
    async update(id: string, changes: Partial<Pick<CreateFinancialGoalInput, 'name' | 'targetAmount' | 'startDate' | 'endDate'>>): Promise<FinancialGoal> {
      const current = await requireGoal(id)
      const updated = { ...current, ...changes, updatedAt: now().toISOString() }
      validateGoal(updated)
      await repository.put(updated)
      return updated
    },
    async list(): Promise<FinancialGoal[]> {
      return (await repository.toArray()).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    },
    async setStatus(id: string, status: FinancialGoal['status']): Promise<FinancialGoal> {
      const updated = { ...(await requireGoal(id)), status, updatedAt: now().toISOString() }
      await repository.put(updated)
      return updated
    },
    pause(id: string) { return this.setStatus(id, 'paused') },
    cancel(id: string) { return this.setStatus(id, 'cancelled') },
  }
}

export const financialGoalService = createFinancialGoalService()
