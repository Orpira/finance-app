import { db } from '../database/db'
import type { PersonalIncomeCategory } from '../types/personalIncomeCategory'
import type { ServiceIncome } from '../types/service'
import {
  buildNormalizedPersonalIncomeCategoryName,
  INVALID_PERSONAL_INCOME_CATEGORY_NAME_MESSAGE,
  MAX_PERSONAL_INCOME_CATEGORY_NAME_LENGTH,
  normalizePersonalIncomeCategoryName,
} from '../utils/personalIncomeCategoryName'

export {
  buildNormalizedPersonalIncomeCategoryName,
  INVALID_PERSONAL_INCOME_CATEGORY_NAME_MESSAGE,
  MAX_PERSONAL_INCOME_CATEGORY_NAME_LENGTH,
  normalizePersonalIncomeCategoryName,
}

export function getPersonalIncomeCategoryName(
  income: Pick<ServiceIncome, 'personalCategoryId'>,
  categories: readonly PersonalIncomeCategory[],
): string | undefined {
  if (!income.personalCategoryId) return undefined

  const category = categories.find((item) => item.id === income.personalCategoryId)
  if (!category) return 'Categoría no disponible'
  return category.name
}

export type PersonalIncomeCategoryListOptions = {
  archived?: 'active' | 'archived' | 'all'
}

/** Mirrors the `finance-app:settings-changed` pattern (settingsService.ts) so open
 * selectors/lists can refresh without a full reload after any mutation. */
export const PERSONAL_INCOME_CATEGORIES_CHANGED_EVENT = 'finance-app:personal-income-categories-changed'

function notifyPersonalIncomeCategoriesChanged() {
  window.dispatchEvent(new CustomEvent(PERSONAL_INCOME_CATEGORIES_CHANGED_EVENT))
}

export async function getPersonalIncomeCategoryById(id: string) {
  return db.personalIncomeCategories.get(id)
}

export async function listPersonalIncomeCategories(
  options: PersonalIncomeCategoryListOptions = {},
): Promise<PersonalIncomeCategory[]> {
  const { archived = 'active' } = options
  const categories = await db.personalIncomeCategories.orderBy('name').toArray()

  if (archived === 'all') {
    return categories
  }

  return categories.filter((category) => {
    if (archived === 'active') return !category.isArchived
    return category.isArchived
  })
}

export async function createPersonalIncomeCategory(input: { name: string }) {
  const name = normalizePersonalIncomeCategoryName(input.name)
  const normalizedName = buildNormalizedPersonalIncomeCategoryName(name)
  const now = new Date().toISOString()

  const category = await db.transaction('rw', [db.personalIncomeCategories, db.services], async () => {
    const categories = await db.personalIncomeCategories.toArray()
    const exists = categories.some(
      (existingCategory) => existingCategory.normalizedName === normalizedName,
    )

    if (exists) {
      throw new Error('ya existe una categoría personal con ese nombre.')
    }

    const newCategory: PersonalIncomeCategory = {
      id: `pic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      normalizedName,
      usageMode: 'basic',
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    }

    await db.personalIncomeCategories.put(newCategory)
    return newCategory
  })
  notifyPersonalIncomeCategoriesChanged()
  return category
}

export async function renamePersonalIncomeCategory(id: string, newName: string) {
  const name = normalizePersonalIncomeCategoryName(newName)
  const normalizedName = buildNormalizedPersonalIncomeCategoryName(name)

  const updated = await db.transaction('rw', [db.personalIncomeCategories, db.services], async () => {
    const category = await db.personalIncomeCategories.get(id)
    if (!category) {
      throw new Error('La categoría no existe.')
    }

    const categories = await db.personalIncomeCategories.toArray()
    const duplicate = categories.some(
      (item) => item.id !== id && item.normalizedName === normalizedName,
    )

    if (duplicate) {
      throw new Error('ya existe una categoría personal con ese nombre.')
    }

    const nextCategory: PersonalIncomeCategory = {
      ...category,
      name,
      normalizedName,
      updatedAt: new Date().toISOString(),
    }

    await db.personalIncomeCategories.put(nextCategory)
    return nextCategory
  })
  notifyPersonalIncomeCategoriesChanged()
  return updated
}

export async function archivePersonalIncomeCategory(id: string) {
  const updated = await db.transaction('rw', [db.personalIncomeCategories, db.services], async () => {
    const category = await db.personalIncomeCategories.get(id)
    if (!category) throw new Error('La categoría no existe.')

    const nextCategory: PersonalIncomeCategory = {
      ...category,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    }

    await db.personalIncomeCategories.put(nextCategory)
    return nextCategory
  })
  notifyPersonalIncomeCategoriesChanged()
  return updated
}

export async function reactivatePersonalIncomeCategory(id: string) {
  const updated = await db.transaction('rw', [db.personalIncomeCategories, db.services], async () => {
    const category = await db.personalIncomeCategories.get(id)
    if (!category) throw new Error('La categoría no existe.')

    const nextCategory: PersonalIncomeCategory = {
      ...category,
      isArchived: false,
      updatedAt: new Date().toISOString(),
    }

    await db.personalIncomeCategories.put(nextCategory)
    return nextCategory
  })
  notifyPersonalIncomeCategoriesChanged()
  return updated
}

export async function countIncomeReferencesForCategory(categoryId: string) {
  return db.services.where('personalCategoryId').equals(categoryId).count()
}

export async function deletePersonalIncomeCategory(id: string) {
  const result = await db.transaction('rw', [db.personalIncomeCategories, db.services], async () => {
    const category = await db.personalIncomeCategories.get(id)
    if (!category) {
      throw new Error('La categoría no existe.')
    }

    const count = await countIncomeReferencesForCategory(id)
    if (count > 0) {
      throw new Error('Esta categoría está asociada a ingresos existentes y no puede eliminarse. Puedes archivarla.')
    }

    await db.personalIncomeCategories.delete(id)
    return true
  })
  notifyPersonalIncomeCategoriesChanged()
  return result
}
