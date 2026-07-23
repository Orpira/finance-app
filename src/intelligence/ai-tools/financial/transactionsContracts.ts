export type FinancialTransactionKind = 'income' | 'expense' | 'adjustment' | 'transfer'

export type FinancialTransactionStatus = 'pending' | 'cleared' | 'reported' | 'reconciled'

export type FinancialTransactionSortField = 'date' | 'amount' | 'label' | 'status'

export type FinancialTransactionSortDirection = 'asc' | 'desc'

export interface FinancialTransactionPeriodFilter {
  readonly from?: string
  readonly to?: string
  readonly timezone?: string
}

export interface FinancialTransactionFilters {
  readonly currencyCode?: string
  readonly period?: FinancialTransactionPeriodFilter
  readonly kinds?: readonly FinancialTransactionKind[]
  readonly statuses?: readonly FinancialTransactionStatus[]
  readonly query?: string
  readonly minAmount?: number
  readonly maxAmount?: number
  readonly tags?: readonly string[]
}

export interface FinancialTransactionSort {
  readonly field: FinancialTransactionSortField
  readonly direction: FinancialTransactionSortDirection
}

export interface FinancialTransactionInput {
  readonly requestId: string
  readonly requestedAt: string
  readonly filters?: FinancialTransactionFilters
  readonly sort?: FinancialTransactionSort
  readonly limit?: number
  readonly cursor?: string
}

export interface FinancialTransactionSummary {
  readonly currencyCode?: string
  readonly matchedCount: number
  readonly incomeTotal: number
  readonly expenseTotal: number
  readonly netTotal: number
}

export interface FinancialTransactionRecord {
  readonly transactionId: string
  readonly kind: FinancialTransactionKind
  readonly date: string
  readonly label: string
  readonly amount: number
  readonly currencyCode: string
  readonly status?: FinancialTransactionStatus
  readonly category?: string
  readonly tags?: readonly string[]
}

export interface FinancialTransactionOutput {
  readonly summary: FinancialTransactionSummary
  readonly items: readonly FinancialTransactionRecord[]
  readonly nextCursor?: string
}

export interface FinancialTransactionSuccessResult {
  readonly kind: 'success'
  readonly output: FinancialTransactionOutput
}

export interface FinancialTransactionFailureResult {
  readonly kind: 'failure'
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type FinancialTransactionResult =
  | FinancialTransactionSuccessResult
  | FinancialTransactionFailureResult
