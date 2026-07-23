export type FinancialReportKind =
  | 'balance'
  | 'transactions'
  | 'budget'
  | 'goals'
  | 'investments'
  | 'portfolio'
  | 'custom'

export type FinancialReportFormat = 'json' | 'csv' | 'xlsx' | 'pdf' | 'markdown'

export interface FinancialReportPeriodFilter {
  readonly from?: string
  readonly to?: string
  readonly timezone?: string
}

export interface FinancialReportFilters {
  readonly currencyCode?: string
  readonly kind?: FinancialReportKind
  readonly period?: FinancialReportPeriodFilter
  readonly tags?: readonly string[]
  readonly sections?: readonly string[]
}

export interface FinancialReportInput {
  readonly requestId: string
  readonly requestedAt: string
  readonly format: FinancialReportFormat
  readonly filters?: FinancialReportFilters
}

export interface FinancialReportRow {
  readonly [column: string]: string | number | boolean | null
}

export interface FinancialReportSection {
  readonly sectionId: string
  readonly title: string
  readonly description?: string
  readonly rows: readonly FinancialReportRow[]
}

export interface FinancialReportSummary {
  readonly currencyCode?: string
  readonly sectionCount: number
  readonly rowCount: number
  readonly reportTitle: string
}

export interface FinancialReportOutput {
  readonly reportId: string
  readonly generatedAt: string
  readonly format: FinancialReportFormat
  readonly summary: FinancialReportSummary
  readonly sections: readonly FinancialReportSection[]
}

export interface FinancialReportSuccessResult {
  readonly kind: 'success'
  readonly output: FinancialReportOutput
}

export interface FinancialReportFailureResult {
  readonly kind: 'failure'
  readonly code: string
  readonly message: string
  readonly retryable: boolean
}

export type FinancialReportResult =
  | FinancialReportSuccessResult
  | FinancialReportFailureResult
