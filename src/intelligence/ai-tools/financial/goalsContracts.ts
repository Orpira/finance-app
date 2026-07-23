export type FinancialGoalStatus = 'draft' | 'planned' | 'active' | 'paused' | 'achieved' | 'cancelled'

export type FinancialGoalPriority = 'low' | 'medium' | 'high' | 'critical'

export interface FinancialGoalPeriodFilter {
  readonly from?: string
  readonly to?: string
  readonly timezone?: string
}

export interface FinancialGoalFilters {
  readonly currencyCode?: string
  readonly period?: FinancialGoalPeriodFilter
  readonly statuses?: readonly FinancialGoalStatus[]
  readonly priorities?: readonly FinancialGoalPriority[]
  readonly goalIds?: readonly string[]
  readonly query?: string
  readonly tags?: readonly string[]
}

export interface FinancialGoalInput {
  readonly requestId: string
  readonly requestedAt: string
  readonly filters?: FinancialGoalFilters
}

export interface FinancialGoalRecord {
  readonly goalId: string
  readonly label: string
  readonly currencyCode: string
  readonly status: FinancialGoalStatus
  readonly priority: FinancialGoalPriority
  readonly targetAmount: number
  readonly achievedAmount: number
  readonly progressPercentage: number
  readonly targetDate?: string
  readonly period?: FinancialGoalPeriodFilter
  readonly tags?: readonly string[]
}

export interface FinancialGoalSummary {
  readonly currencyCode?: string
  readonly goalCount: number
  readonly activeCount: number
  readonly achievedCount: number
  readonly totalTargetAmount: number
  readonly totalAchievedAmount: number
  readonly averageProgressPercentage: number
}

export interface FinancialGoalOutput {
  readonly summary: FinancialGoalSummary
  readonly items: readonly FinancialGoalRecord[]
}

export interface FinancialGoalSuccessResult {
  readonly kind: 'success'
  readonly output: FinancialGoalOutput
}

export interface FinancialGoalFailureResult {
  readonly kind: 'failure'
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type FinancialGoalResult =
  | FinancialGoalSuccessResult
  | FinancialGoalFailureResult
