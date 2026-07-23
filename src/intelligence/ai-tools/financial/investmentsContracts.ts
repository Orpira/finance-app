export type FinancialInvestmentStatus = 'planned' | 'active' | 'paused' | 'closed' | 'divested'

export type FinancialInvestmentAssetClass =
  | 'cash'
  | 'equity'
  | 'fixed-income'
  | 'fund'
  | 'crypto'
  | 'real-estate'
  | 'other'

export interface FinancialInvestmentPeriodFilter {
  readonly from?: string
  readonly to?: string
  readonly timezone?: string
}

export interface FinancialInvestmentFilters {
  readonly currencyCode?: string
  readonly period?: FinancialInvestmentPeriodFilter
  readonly statuses?: readonly FinancialInvestmentStatus[]
  readonly assetClasses?: readonly FinancialInvestmentAssetClass[]
  readonly investmentIds?: readonly string[]
  readonly query?: string
  readonly tags?: readonly string[]
}

export interface FinancialInvestmentInput {
  readonly requestId: string
  readonly requestedAt: string
  readonly filters?: FinancialInvestmentFilters
}

export interface FinancialInvestmentRecord {
  readonly investmentId: string
  readonly label: string
  readonly currencyCode: string
  readonly status: FinancialInvestmentStatus
  readonly assetClass: FinancialInvestmentAssetClass
  readonly investedAmount: number
  readonly currentValue: number
  readonly gainLossAmount: number
  readonly gainLossPercentage: number
  readonly openedAt?: string
  readonly closedAt?: string
  readonly period?: FinancialInvestmentPeriodFilter
  readonly tags?: readonly string[]
}

export interface FinancialInvestmentSummary {
  readonly currencyCode?: string
  readonly investmentCount: number
  readonly investedTotal: number
  readonly currentValueTotal: number
  readonly gainLossTotal: number
  readonly gainLossPercentage: number
}

export interface FinancialInvestmentOutput {
  readonly summary: FinancialInvestmentSummary
  readonly items: readonly FinancialInvestmentRecord[]
}

export interface FinancialInvestmentSuccessResult {
  readonly kind: 'success'
  readonly output: FinancialInvestmentOutput
}

export interface FinancialInvestmentFailureResult {
  readonly kind: 'failure'
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type FinancialInvestmentResult =
  | FinancialInvestmentSuccessResult
  | FinancialInvestmentFailureResult
