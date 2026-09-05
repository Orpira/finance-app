import { buildNormalizedPersonalIncomeCategoryName } from './personalIncomeCategoryName'

export type ImportedPersonalIncomeCategory = {
  id?: unknown
  name?: unknown
  normalizedName?: unknown
  usageMode?: unknown
  isArchived?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export type ImportedPersonalIncomeCategoryReference = {
  usageMode?: string
  personalCategoryId?: string
}

/**
 * Fail-closed guard for backup restoration: a corrupt or manipulated
 * personalIncomeCategories payload must never partially import. This must
 * run before the destructive db.transaction clears local data (ADR pending
 * Bloque 6.3).
 */
export function assertPersonalIncomeCategoriesAreValid(
  categories: ImportedPersonalIncomeCategory[],
  incomes: ImportedPersonalIncomeCategoryReference[],
) {
  const ids = new Set<string>()
  const normalizedNames = new Set<string>()

  categories.forEach((category) => {
    if (typeof category.id !== 'string' || !category.id) {
      throw new Error('PERSONAL_INCOME_CATEGORY_INVALID_ID')
    }
    if (typeof category.name !== 'string' || !category.name.trim()) {
      throw new Error('PERSONAL_INCOME_CATEGORY_INVALID_NAME')
    }
    if (category.usageMode !== 'basic') {
      throw new Error('PERSONAL_INCOME_CATEGORY_INVALID_USAGE_MODE')
    }
    if (category.isArchived !== undefined && typeof category.isArchived !== 'boolean') {
      throw new Error('PERSONAL_INCOME_CATEGORY_INVALID_IS_ARCHIVED')
    }
    if (category.createdAt !== undefined && typeof category.createdAt !== 'string') {
      throw new Error('PERSONAL_INCOME_CATEGORY_INVALID_TIMESTAMP')
    }
    if (category.updatedAt !== undefined && typeof category.updatedAt !== 'string') {
      throw new Error('PERSONAL_INCOME_CATEGORY_INVALID_TIMESTAMP')
    }

    const canonicalNormalizedName = buildNormalizedPersonalIncomeCategoryName(category.name)
    if (
      category.normalizedName !== undefined &&
      category.normalizedName !== canonicalNormalizedName
    ) {
      throw new Error('PERSONAL_INCOME_CATEGORY_NORMALIZED_NAME_MISMATCH')
    }

    if (ids.has(category.id)) {
      throw new Error('PERSONAL_INCOME_CATEGORY_DUPLICATE_ID')
    }
    ids.add(category.id)

    if (normalizedNames.has(canonicalNormalizedName)) {
      throw new Error('PERSONAL_INCOME_CATEGORY_DUPLICATE_NAME')
    }
    normalizedNames.add(canonicalNormalizedName)
  })

  incomes.forEach((income) => {
    if (!income.personalCategoryId) return

    if (income.usageMode !== 'basic') {
      throw new Error('PERSONAL_INCOME_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
    }

    if (!ids.has(income.personalCategoryId)) {
      throw new Error('PERSONAL_INCOME_CATEGORY_ORPHAN_REFERENCE')
    }
  })
}
