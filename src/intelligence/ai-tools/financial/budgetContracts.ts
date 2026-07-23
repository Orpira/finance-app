export type FinancialBudgetStatus = 'draft' | 'planned' | 'active' | 'paused' | 'closed' | 'archived'

export interface FinancialBudgetPeriodFilter {
  readonly from?: string
  readonly to?: string
  readonly timezone?: string
}

export interface FinancialBudgetFilters {
  readonly currencyCode?: string
  readonly period?: FinancialBudgetPeriodFilter
  readonly statuses?: readonly FinancialBudgetStatus[]
  readonly budgetIds?: readonly string[]
  readonly tags?: readonly string[]
}

export interface FinancialBudgetInput {
  readonly requestId: string
  readonly requestedAt: string
  readonly filters?: FinancialBudgetFilters
}

export interface FinancialBudgetRecord {
  readonly budgetId: string
  readonly label: string
  readonly currencyCode: string
  readonly status: FinancialBudgetStatus
  readonly plannedAmount: number
  readonly spentAmount: number
  readonly remainingAmount: number
  readonly period?: FinancialBudgetPeriodFilter
  readonly tags?: readonly string[]
}

export interface FinancialBudgetSummary {
  readonly currencyCode?: string
  readonly budgetCount: number
  readonly plannedTotal: number
  readonly spentTotal: number
  readonly remainingTotal: number
}

export interface FinancialBudgetOutput {
  readonly summary: FinancialBudgetSummary
  readonly items: readonly FinancialBudgetRecord[]
}

export interface FinancialBudgetSuccessResult {
  readonly kind: 'success'
  readonly output: FinancialBudgetOutput
}

export interface FinancialBudgetFailureResult {
  readonly kind: 'failure'
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type FinancialBudgetResult =
  | FinancialBudgetSuccessResult
  | FinancialBudgetFailureResult
