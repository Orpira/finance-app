import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { Expense } from '../types/expense'
import type { CountryCode } from '../types/settings'
import { assertRecordIsMutable, getActiveEarningPeriod } from './earningPeriodService'
import { getSettings } from './settingsService'
import { recordBelongsToUsageMode, requiresSeason } from '../utils/usageMode'
import {
  assertExpenseAdjustmentIsValid,
  calculateAdjustmentCapacity,
} from '../utils/expenseAdjustments'
import {
  createAutomationOutboxRecord,
  enqueueAutomationEvent,
  scheduleAutomationOutboxFlush,
} from './automationOutboxService'
import {
  assertRecordIsNotReported,
  assertReportedRecordUpdateIsAllowed,
  normalizeReportStatus,
} from '../catalogs/reportStatuses'
import { assertReportStatusUpdateIsAllowed } from '../utils/reportStatus'

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

function formatLocalDateTime(date: Date) {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export async function createExpense(input: CreateExpenseInput) {
  const settings = await getSettings()
  const period =
    requiresSeason(settings) ? await getActiveEarningPeriod() : undefined

  if (requiresSeason(settings) && !period) {
    throw new Error('No hay una temporada activa. Crea una temporada para registrar actividad.')
  }

  const createdAt = input.createdAt ?? formatLocalDateTime(new Date())

  const expense: Expense = normalizeReportStatus({
    usageMode: settings.usageMode,
    ...input,
    createdAt,
    earningPeriodId: period?.id,
    seasonPeriodId: period?.id,
  })

  const expenseId = await db.transaction('rw', [
    db.expenses,
    db.services,
    db.automationOutbox,
  ], async () => {
    const [incomes, expenses] = await Promise.all([
      db.services.toArray(),
      db.expenses.toArray(),
    ])
    assertExpenseAdjustmentIsValid(expense, incomes, expenses)
    const nextExpenseId = await db.expenses.add(expense)
    await enqueueAutomationEvent(
      createAutomationOutboxRecord('expense.created', {
        expense: { ...expense, id: nextExpenseId },
      }),
    )
    return nextExpenseId
  })
  scheduleAutomationOutboxFlush()

  return expenseId
}

export async function getExpenseById(id: number) {
  const expense = await db.expenses.get(id)
  return expense ? normalizeReportStatus(expense) : expense
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
  
  return filtered.map((item) => normalizeReportStatus(item))
}

export async function updateExpense(id: number, updates: UpdateExpenseInput) {
  const settings = await getSettings()
  const currentExpense = await db.expenses.get(id)
  if (
    !currentExpense ||
    !recordBelongsToUsageMode(currentExpense, settings.usageMode)
  ) {
    throw new Error('Este egreso pertenece a otro modo de uso.')
  }
  assertReportStatusUpdateIsAllowed(currentExpense, settings.usageMode, updates)
  assertReportedRecordUpdateIsAllowed(currentExpense, updates)
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(currentExpense)
  }
  return db.transaction('rw', [db.expenses, db.services], async () => {
    const latestExpense = await db.expenses.get(id)
    if (!latestExpense) throw new Error('El egreso que intentas modificar no existe.')
    assertReportStatusUpdateIsAllowed(latestExpense, settings.usageMode, updates)
    assertReportedRecordUpdateIsAllowed(latestExpense, updates)

    const updatedExpense: Expense = normalizeReportStatus({
      ...latestExpense,
      ...updates,
      usageMode: latestExpense.usageMode ?? settings.usageMode,
    })
    const [incomes, expenses] = await Promise.all([
      db.services.toArray(),
      db.expenses.toArray(),
    ])
    assertExpenseAdjustmentIsValid(updatedExpense, incomes, expenses, id)
    await db.expenses.put(updatedExpense)
    return updatedExpense
  })
}

export async function getAdjustmentCapacity(
  incomeId: number,
  excludedExpenseId?: number,
) {
  const [income, expenses] = await Promise.all([
    db.services.get(incomeId),
    db.expenses.where('relatedIncomeId').equals(incomeId).toArray(),
  ])
  if (!income) throw new Error('El ingreso seleccionado no existe.')
  return calculateAdjustmentCapacity(income, expenses, excludedExpenseId)
}

export function listExpenseAdjustmentsForIncome(incomeId: number) {
  return db.expenses
    .where('relatedIncomeId')
    .equals(incomeId)
    .filter((expense) => expense.type === 'ajuste')
    .reverse()
    .sortBy('createdAt')
}

export async function deleteExpense(id: number) {
  const settings = await getSettings()
  const currentExpense = await db.expenses.get(id)
  if (
    !currentExpense ||
    !recordBelongsToUsageMode(currentExpense, settings.usageMode)
  ) {
    throw new Error('Este egreso pertenece a otro modo de uso.')
  }
  assertRecordIsNotReported(currentExpense)
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(currentExpense)
  }
  return db.transaction('rw', db.expenses, async () => {
    assertRecordIsNotReported(await db.expenses.get(id))
    return db.expenses.delete(id)
  })
}
