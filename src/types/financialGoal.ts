import type { CurrencyCode } from './settings'

export type FinancialGoalType = 'saving' | 'expense_limit' | 'income_target'
export type FinancialGoalStatus = 'active' | 'completed' | 'paused' | 'cancelled'

export interface FinancialGoal {
  readonly id: string
  readonly type: FinancialGoalType
  readonly name: string
  readonly targetAmount: number
  readonly currency: CurrencyCode
  readonly period: 'monthly'
  readonly startDate: string
  readonly endDate?: string
  readonly status: FinancialGoalStatus
  readonly createdAt: string
  readonly updatedAt: string
}

export interface FinancialGoalProgress {
  readonly goalId: string
  readonly currentAmount: number
  readonly targetAmount: number
  readonly remainingAmount: number
  readonly percentage: number
  readonly state: 'on_track' | 'achieved' | 'limit_reached' | 'limit_exceeded'
  readonly period: { readonly start: string; readonly end?: string }
  readonly currency: CurrencyCode
  readonly source: 'local-financial-domain'
  readonly calculatedAt: string
  readonly limitations: readonly string[]
}
