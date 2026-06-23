import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { Expense } from '../types/expense'
import type { CountryCode } from '../types/settings'
import { assertRecordIsMutable, requireActiveEarningPeriod } from './earningPeriodService'

export interface ExpenseListOptions extends DateRangeListOptions {
  category?: string
  country?: CountryCode
  city?: string
  earningPeriodId?: number
}

export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt'> & {
  createdAt?: string
}
export type UpdateExpenseInput = Partial<CreateExpenseInput>

export async function createExpense(input: CreateExpenseInput) {
  const period = await requireActiveEarningPeriod()
  return db.expenses.add({
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
    earningPeriodId: period.id,
    seasonPeriodId: period.id,
  })
}

export async function getExpenseById(id: number) {
  return db.expenses.get(id)
}

export async function listExpenses(options: ExpenseListOptions = {}) {
  const { from, to, category, country, city, earningPeriodId, newestFirst = true } = options
  const lowerBound = from ?? ''
  const upperBound = to ?? '\uffff'
  const collection =
    from || to
      ? db.expenses.where('date').between(lowerBound, upperBound, true, true)
      : db.expenses.orderBy('date')

  if (newestFirst) {
    collection.reverse()
  }

  const expenses = await collection.toArray()

  let filtered = expenses
  
  if (category) {
    filtered = filtered.filter((expense) => expense.category === category)
  }
  
  if (country) {
    filtered = filtered.filter((expense) => expense.country === country)
  }

  if (city) {
    filtered = filtered.filter((expense) => expense.city === city)
  }
  if (earningPeriodId !== undefined) {
    filtered = filtered.filter((expense) => expense.earningPeriodId === earningPeriodId)
  }
  
  return filtered
}

export async function updateExpense(id: number, updates: UpdateExpenseInput) {
  await assertRecordIsMutable(await db.expenses.get(id))
  await db.expenses.update(id, updates)
  return db.expenses.get(id)
}

export async function deleteExpense(id: number) {
  await assertRecordIsMutable(await db.expenses.get(id))
  return db.expenses.delete(id)
}
