export type ConfigurableReportType = 'all' | 'income' | 'expense' | 'paymentType' | 'balance'
export type ConfigurableReportStatus = 'ALL' | 'reported' | 'unreported'
export type ConfigurableReportFormat = 'pdf' | 'csv' | 'xlsx'

export interface ReportConfiguration {
  readonly dateFrom: string
  readonly dateTo: string
  readonly type: ConfigurableReportType
  readonly category: string | 'ALL'
  readonly currency: string
  readonly status: ConfigurableReportStatus
  readonly format: ConfigurableReportFormat
}

interface ReportIncomeRecord {
  readonly date: string
  readonly currency?: string
  readonly reportStatus?: string
  readonly reportStatusCode?: string
  readonly status?: string
}

interface ReportExpenseRecord {
  readonly date: string
  readonly currency?: string
  readonly category?: string
}

export function validateReportConfiguration(configuration: ReportConfiguration):
  | { readonly valid: true }
  | { readonly valid: false; readonly reason: 'INVALID_PERIOD' | 'UNSUPPORTED_FORMAT' } {
  if (configuration.dateFrom > configuration.dateTo) {
    return { valid: false, reason: 'INVALID_PERIOD' }
  }
  if (!['pdf', 'csv', 'xlsx'].includes(configuration.format)) {
    return { valid: false, reason: 'UNSUPPORTED_FORMAT' }
  }
  return { valid: true }
}

function isReported(record: ReportIncomeRecord): boolean {
  const value = String(record.reportStatusCode ?? record.reportStatus ?? record.status ?? '').toLocaleLowerCase('es')
  return value === 'reported' || value === 'reportado'
}

export function filterConfigurableReportRecords<
  Income extends ReportIncomeRecord,
  Expense extends ReportExpenseRecord,
>(
  records: { readonly incomes: readonly Income[]; readonly expenses: readonly Expense[] },
  configuration: ReportConfiguration,
): { readonly incomes: readonly Income[]; readonly expenses: readonly Expense[] } {
  const validation = validateReportConfiguration(configuration)
  if (!validation.valid) return { incomes: [], expenses: [] }

  const inPeriod = (date: string) => date >= configuration.dateFrom && date <= configuration.dateTo
  const incomes = configuration.type === 'expense'
    ? []
    : records.incomes.filter((income) => {
        if (!inPeriod(income.date)) return false
        if (configuration.status === 'ALL') return true
        return configuration.status === 'reported' ? isReported(income) : !isReported(income)
      })
  const expenses = configuration.type === 'income' || configuration.type === 'paymentType'
    ? []
    : records.expenses.filter((expense) => (
        inPeriod(expense.date) &&
        (configuration.category === 'ALL' || expense.category === configuration.category)
      ))

  return { incomes, expenses }
}
