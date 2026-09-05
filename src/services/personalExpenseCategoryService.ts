import { db } from '../database/db'
import type { Expense } from '../types/expense'
import type { PersonalExpenseCategory } from '../types/personalExpenseCategory'
import {
  buildNormalizedPersonalExpenseCategoryName,
  INVALID_PERSONAL_EXPENSE_CATEGORY_NAME_MESSAGE,
  MAX_PERSONAL_EXPENSE_CATEGORY_NAME_LENGTH,
  normalizePersonalExpenseCategoryName,
} from '../utils/personalExpenseCategoryName'

export {
  buildNormalizedPersonalExpenseCategoryName,
  INVALID_PERSONAL_EXPENSE_CATEGORY_NAME_MESSAGE,
  MAX_PERSONAL_EXPENSE_CATEGORY_NAME_LENGTH,
  normalizePersonalExpenseCategoryName,
}

export function getPersonalExpenseCategoryName(
  expense: Pick<Expense, 'personalCategoryId'>,
  categories: readonly PersonalExpenseCategory[],
): string | undefined {
  if (!expense.personalCategoryId) return undefined
  return categories.find((category) => category.id === expense.personalCategoryId)?.name ?? 'Categoría no disponible'
}

export type PersonalExpenseCategoryListOptions = {
  archived?: 'active' | 'archived' | 'all'
}

export const PERSONAL_EXPENSE_CATEGORIES_CHANGED_EVENT = 'finance-app:personal-expense-categories-changed'

function notifyPersonalExpenseCategoriesChanged() {
  window.dispatchEvent(new CustomEvent(PERSONAL_EXPENSE_CATEGORIES_CHANGED_EVENT))
}

export async function getPersonalExpenseCategoryById(id: string) {
  return db.personalExpenseCategories.get(id)
}

export async function listPersonalExpenseCategories(
  options: PersonalExpenseCategoryListOptions = {},
): Promise<PersonalExpenseCategory[]> {
  const { archived = 'active' } = options
  const categories = await db.personalExpenseCategories.orderBy('name').toArray()
  if (archived === 'all') return categories
  return categories.filter((category) => archived === 'active' ? !category.isArchived : category.isArchived)
}

export async function createPersonalExpenseCategory(input: { name: string }) {
  const name = normalizePersonalExpenseCategoryName(input.name)
  const normalizedName = buildNormalizedPersonalExpenseCategoryName(name)
  const now = new Date().toISOString()
  const category = await db.transaction('rw', [db.personalExpenseCategories, db.expenses], async () => {
    const duplicate = await db.personalExpenseCategories.where('normalizedName').equals(normalizedName).first()
    if (duplicate) throw new Error('ya existe una categoría personal de egreso con ese nombre.')
    const nextCategory: PersonalExpenseCategory = {
      id: `pec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      normalizedName,
      usageMode: 'basic',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.personalExpenseCategories.put(nextCategory)
    return nextCategory
  })
  notifyPersonalExpenseCategoriesChanged()
  return category
}

export async function renamePersonalExpenseCategory(id: string, newName: string) {
  const name = normalizePersonalExpenseCategoryName(newName)
  const normalizedName = buildNormalizedPersonalExpenseCategoryName(name)
  const updated = await db.transaction('rw', [db.personalExpenseCategories, db.expenses], async () => {
    const category = await db.personalExpenseCategories.get(id)
    if (!category) throw new Error('La categoría no existe.')
    const duplicate = await db.personalExpenseCategories.where('normalizedName').equals(normalizedName).first()
    if (duplicate && duplicate.id !== id) throw new Error('ya existe una categoría personal de egreso con ese nombre.')
    const nextCategory = { ...category, name, normalizedName, updatedAt: new Date().toISOString() }
    await db.personalExpenseCategories.put(nextCategory)
    return nextCategory
  })
  notifyPersonalExpenseCategoriesChanged()
  return updated
}

export async function archivePersonalExpenseCategory(id: string) {
  return updateArchivedState(id, true)
}

export async function reactivatePersonalExpenseCategory(id: string) {
  return updateArchivedState(id, false)
}

async function updateArchivedState(id: string, isArchived: boolean) {
  const updated = await db.transaction('rw', [db.personalExpenseCategories, db.expenses], async () => {
    const category = await db.personalExpenseCategories.get(id)
    if (!category) throw new Error('La categoría no existe.')
    const nextCategory = { ...category, isArchived, updatedAt: new Date().toISOString() }
    await db.personalExpenseCategories.put(nextCategory)
    return nextCategory
  })
  notifyPersonalExpenseCategoriesChanged()
  return updated
}

export async function countExpenseReferencesForCategory(categoryId: string) {
  return db.expenses.where('personalCategoryId').equals(categoryId).count()
}

export async function deletePersonalExpenseCategory(id: string) {
  const result = await db.transaction('rw', [db.personalExpenseCategories, db.expenses], async () => {
    const category = await db.personalExpenseCategories.get(id)
    if (!category) throw new Error('La categoría no existe.')
    const count = await countExpenseReferencesForCategory(id)
    if (count > 0) throw new Error('Esta categoría está asociada a egresos existentes y no puede eliminarse. Puedes archivarla.')
    await db.personalExpenseCategories.delete(id)
    return true
  })
  notifyPersonalExpenseCategoriesChanged()
  return result
}
