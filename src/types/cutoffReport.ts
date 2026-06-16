import type { CurrencyCode } from './settings'

export type CutoffFrequency = 'weekly' | 'biweekly' | 'monthly'

export interface CutoffReport {
  id?: number
  frequency: CutoffFrequency
  periodStart: string
  periodEnd: string
  generatedAt: string
  currency: CurrencyCode
  incomeTotal: number
  expenseTotal: number
  netTotal: number
  incomeCount: number
  expenseCount: number
  serviceMinutes: number
  paymentTypeTotals: Record<string, number>
  expenseCategoryTotals: Record<string, number>
}
