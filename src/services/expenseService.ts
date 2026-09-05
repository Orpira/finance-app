import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { Expense } from '../types/expense'
import type { CountryCode } from '../types/settings'
import { assertRecordIsMutable, getActiveEarningPeriod } from './earningPeriodService'
import { getSettings } from './settingsService'
import {
  recordBelongsToUsageMode,
  requiresSeason,
  resolveActiveUsageMode,
} from '../utils/usageMode'
import {
  assertExpenseAdjustmentIsValid,
  calculateAdjustmentCapacity,
} from '../utils/expenseAdjustments'
import {
  createAutomationOutboxRecord,
  enqueueAutomationEvent,
  scheduleAutomationOutboxFlush,
} from './automationOutboxService'
import { assertReportStatusUpdateIsAllowed } from '../utils/reportStatus'
import { normalizePersonalExpenseName } from '../utils/personalExpenseName'

const REPORT_FIELDS = ['reportStatusCode', 'reportStatusLabel', 'reportedAt', 'reportReference', 'reportNotes'] as const

function withoutReportFields<T extends object>(record: T): T {
  const clean = { ...record } as T & Record<string, unknown>
  REPORT_FIELDS.forEach((field) => delete clean[field])
  return clean
}

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

function normalizePersonalCategoryIdInput(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined
  if (typeof value !== 'string') {
    throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_ID')
  }
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

async function assertPersonalExpenseCategoryAssignment(
  categoryId: string | undefined,
  usageMode: 'basic' | 'professional',
  existingCategoryId?: string,
) {
  if (!categoryId) return
  if (usageMode !== 'basic') {
    throw new Error('PERSONAL_EXPENSE_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
  }
  const category = await db.personalExpenseCategories.get(categoryId)
  const isSameAsBefore = categoryId === existingCategoryId
  if (!category || category.usageMode !== 'basic' || (category.isArchived && !isSameAsBefore)) {
    throw new Error('La categoría de egreso personal no es válida.')
  }
}

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
  const activeUsageMode = resolveActiveUsageMode(settings)
  assertReportStatusUpdateIsAllowed(
    input as Expense,
    activeUsageMode,
    input,
  )
  const normalizedPersonalCategoryId = normalizePersonalCategoryIdInput(input.personalCategoryId)
  if (activeUsageMode === 'professional' && normalizedPersonalCategoryId !== undefined) {
    throw new Error('PERSONAL_EXPENSE_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
  }
  const period =
    requiresSeason(settings) ? await getActiveEarningPeriod() : undefined

  if (requiresSeason(settings) && !period) {
    throw new Error('No hay una temporada activa. Crea una temporada para registrar actividad.')
  }

  const createdAt = input.createdAt ?? formatLocalDateTime(new Date())

  const expense: Expense = withoutReportFields({
    usageMode: activeUsageMode,
    ...input,
    personalName: activeUsageMode === 'basic'
      ? normalizePersonalExpenseName(input.personalName)
      : undefined,
    personalCategoryId: activeUsageMode === 'basic' ? normalizedPersonalCategoryId : undefined,
    createdAt,
    earningPeriodId: period?.id,
    seasonPeriodId: period?.id,
  })

  const expenseId = await db.transaction('rw', [
    db.expenses,
    db.services,
    db.automationOutbox,
    db.personalExpenseCategories,
  ], async () => {
    await assertPersonalExpenseCategoryAssignment(
      expense.personalCategoryId,
      activeUsageMode,
    )
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
  return expense ? withoutReportFields(expense) : expense
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
  
  return filtered.map((item) => withoutReportFields(item))
}

export async function updateExpense(id: number, updates: UpdateExpenseInput) {
  const settings = await getSettings()
  const currentExpense = await db.expenses.get(id)
  if (
    !currentExpense ||
    !recordBelongsToUsageMode(currentExpense, resolveActiveUsageMode(settings))
  ) {
    throw new Error('Este egreso pertenece a otro modo de uso.')
  }
  assertReportStatusUpdateIsAllowed(currentExpense, resolveActiveUsageMode(settings), updates)
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(currentExpense)
  }
  return db.transaction('rw', [db.expenses, db.services, db.personalExpenseCategories], async () => {
    const latestExpense = await db.expenses.get(id)
    if (!latestExpense) throw new Error('El egreso que intentas modificar no existe.')
    assertReportStatusUpdateIsAllowed(latestExpense, resolveActiveUsageMode(settings), updates)
    const safeUpdates: UpdateExpenseInput = { ...updates }
    if (Object.hasOwn(updates, 'personalName')) {
      safeUpdates.personalName = resolveActiveUsageMode(settings) === 'basic'
        ? normalizePersonalExpenseName(updates.personalName)
        : latestExpense.personalName
    }
    if (Object.hasOwn(updates, 'personalCategoryId')) {
      const normalizedCategoryId = normalizePersonalCategoryIdInput(updates.personalCategoryId)
      if (resolveActiveUsageMode(settings) !== 'basic') {
        safeUpdates.personalCategoryId = undefined
      } else {
        await assertPersonalExpenseCategoryAssignment(
          normalizedCategoryId,
          resolveActiveUsageMode(settings),
          latestExpense.personalCategoryId,
        )
        safeUpdates.personalCategoryId = normalizedCategoryId
      }
    }
    const updatedExpense: Expense = withoutReportFields({
      ...latestExpense,
      ...safeUpdates,
      usageMode: latestExpense.usageMode ?? resolveActiveUsageMode(settings),
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
    !recordBelongsToUsageMode(currentExpense, resolveActiveUsageMode(settings))
  ) {
    throw new Error('Este egreso pertenece a otro modo de uso.')
  }
  if (requiresSeason(settings)) {
    await assertRecordIsMutable(currentExpense)
  }
  return db.transaction('rw', db.expenses, async () => {
    return db.expenses.delete(id)
  })
}
