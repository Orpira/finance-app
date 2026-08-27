import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { CurrencyCode } from '../../types/settings'
import { getStoredExpenseValue, getStoredIncomePrincipalValue } from '../../utils/financeStats'
import { getIncomeCompactLabel, getIncomeTypeLabel } from '../../utils/incomeTypes'
import { getRecordReportBadge } from '../../utils/reportStatus'

export interface UnifiedMovement {
  key: string
  kind: 'income' | 'expense'
  date: string
  label: string
  amount: number
  currency: string
  href: string
  reportBadge?: { label: string; isReported: boolean; isUnreviewed: boolean }
  category: string
  reported?: boolean
  searchText: string
}

export function shouldShowMovementReportBadge(
  showUnreportedIncome: boolean,
  reportBadge: UnifiedMovement['reportBadge'],
): boolean {
  return Boolean(reportBadge && (showUnreportedIncome || reportBadge.isReported))
}

export function toUnifiedMovements(incomes: ServiceIncome[], expenses: Expense[]): UnifiedMovement[] {
  const incomeMovements: UnifiedMovement[] = incomes.map((income) => ({
    key: `income-${income.id}`,
    kind: 'income',
    date: income.date,
    label: getIncomeCompactLabel(income),
    amount: getStoredIncomePrincipalValue(income, income.currency as CurrencyCode),
    currency: income.currency,
    href: `/income/${income.id}`,
    reportBadge: getRecordReportBadge(income),
    category: getIncomeTypeLabel(income),
    reported: getRecordReportBadge(income).isReported,
    searchText: getIncomeCompactLabel(income),
  }))

  const expenseMovements: UnifiedMovement[] = expenses.map((expense) => ({
    key: `expense-${expense.id}`,
    kind: 'expense',
    date: expense.date,
    label: expense.category,
    amount: getStoredExpenseValue(expense, expense.currency as CurrencyCode),
    currency: expense.currency,
    href: `/expenses/${expense.id}/editar`,
    category: expense.category,
    searchText: expense.category,
  }))

  return [...incomeMovements, ...expenseMovements]
}