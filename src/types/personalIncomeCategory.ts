export type PersonalIncomeCategoryUsageMode = 'basic'

export interface PersonalIncomeCategory {
  id: string
  name: string
  normalizedName: string
  usageMode: PersonalIncomeCategoryUsageMode
  isArchived: boolean
  createdAt: string
  updatedAt: string
}
