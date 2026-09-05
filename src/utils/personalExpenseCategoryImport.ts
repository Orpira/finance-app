import { buildNormalizedPersonalExpenseCategoryName } from './personalExpenseCategoryName'

export type ImportedPersonalExpenseCategory = {
  id?: unknown
  name?: unknown
  normalizedName?: unknown
  usageMode?: unknown
  isArchived?: unknown
  createdAt?: unknown
  updatedAt?: unknown
}

export type ImportedPersonalExpenseCategoryReference = {
  usageMode?: string
  personalCategoryId?: string
}

export function assertPersonalExpenseCategoriesAreValid(
  categories: ImportedPersonalExpenseCategory[],
  expenses: ImportedPersonalExpenseCategoryReference[],
) {
  const ids = new Set<string>()
  const normalizedNames = new Set<string>()

  categories.forEach((category) => {
    if (typeof category.id !== 'string' || !category.id) {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_ID')
    }
    if (typeof category.name !== 'string' || !category.name.trim()) {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_NAME')
    }
    if (category.usageMode !== 'basic') {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_USAGE_MODE')
    }
    if (category.isArchived !== undefined && typeof category.isArchived !== 'boolean') {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_IS_ARCHIVED')
    }
    if (category.createdAt !== undefined && typeof category.createdAt !== 'string') {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_TIMESTAMP')
    }
    if (category.updatedAt !== undefined && typeof category.updatedAt !== 'string') {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_INVALID_TIMESTAMP')
    }

    const canonicalNormalizedName = buildNormalizedPersonalExpenseCategoryName(category.name)
    if (
      category.normalizedName !== undefined &&
      category.normalizedName !== canonicalNormalizedName
    ) {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_NORMALIZED_NAME_MISMATCH')
    }
    if (ids.has(category.id)) {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_DUPLICATE_ID')
    }
    ids.add(category.id)
    if (normalizedNames.has(canonicalNormalizedName)) {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_DUPLICATE_NAME')
    }
    normalizedNames.add(canonicalNormalizedName)
  })

  expenses.forEach((expense) => {
    if (!expense.personalCategoryId) return
    if (expense.usageMode !== 'basic') {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_NOT_ALLOWED_FOR_PROFESSIONAL')
    }
    if (!ids.has(expense.personalCategoryId)) {
      throw new Error('PERSONAL_EXPENSE_CATEGORY_ORPHAN_REFERENCE')
    }
  })
}
