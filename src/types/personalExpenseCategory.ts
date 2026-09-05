export type PersonalExpenseCategoryUsageMode = 'basic'

export interface PersonalExpenseCategory {
  id: string
  name: string
  normalizedName: string
  usageMode: PersonalExpenseCategoryUsageMode
  isArchived: boolean
  createdAt: string
  updatedAt: string
}
