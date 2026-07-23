export type FinancialBalanceUsageMode = 'basic' | 'professional'

export interface FinancialBalancePeriodFilter {
  readonly from?: string
  readonly to?: string
  readonly timezone?: string
}

export interface FinancialBalanceFilters {
  readonly currencyCode?: string
  readonly usageMode?: FinancialBalanceUsageMode
  readonly period?: FinancialBalancePeriodFilter
  readonly includeAdjustments?: boolean
  readonly tags?: readonly string[]
}

export interface FinancialBalanceInput {
  readonly requestId: string
  readonly requestedAt: string
  readonly filters?: FinancialBalanceFilters
}

export interface FinancialBalanceSummaryItem {
  readonly category: string
  readonly label: string
  readonly count: number
  readonly totalAmount: number
}

export interface FinancialBalanceSummary {
  readonly currencyCode: string
  readonly incomeTotal: number
  readonly expenseTotal: number
  readonly adjustmentTotal: number
  readonly netBalance: number
  readonly hasData: boolean
}

export interface FinancialBalanceOutput {
  readonly summary: FinancialBalanceSummary
  readonly period?: FinancialBalancePeriodFilter
  readonly breakdown?: readonly FinancialBalanceSummaryItem[]
}

export interface FinancialBalanceSuccessResult {
  readonly kind: 'success'
  readonly output: FinancialBalanceOutput
}

export interface FinancialBalanceFailureResult {
  readonly kind: 'failure'
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type FinancialBalanceResult =
  | FinancialBalanceSuccessResult
  | FinancialBalanceFailureResult
