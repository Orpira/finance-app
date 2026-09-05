import type { Expense } from '../../types/expense'
import type { PersonalExpenseCategory } from '../../types/personalExpenseCategory'
import type { PersonalIncomeCategory } from '../../types/personalIncomeCategory'
import type { ServiceIncome } from '../../types/service'
import type { CurrencyCode } from '../../types/settings'
import { getStoredExpenseValue, getStoredIncomePrincipalValue } from '../../utils/financeStats'
import { getIncomeTypeLabel } from '../../utils/incomeTypes'
import {
  getExpenseCategoryBadgeLabel,
  getExpenseDisplayName,
  getIncomeCategoryBadgeLabel,
  getIncomeDisplayName,
} from '../../utils/activityLabels'
import { getRecordReportBadge } from '../../utils/reportStatus'
import { resolveRecordUsageMode } from '../../utils/usageMode'

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
  /** Discreet Personal-only badge (never shown for Profesional records). */
  personalCategoryLabel?: string
  reported?: boolean
  searchText: string
}

export function shouldShowMovementReportBadge(
  showUnreportedIncome: boolean,
  reportBadge: UnifiedMovement['reportBadge'],
): boolean {
  return Boolean(reportBadge && (showUnreportedIncome || reportBadge.isReported))
}

export function toUnifiedMovements(
  incomes: ServiceIncome[],
  expenses: Expense[],
  personalIncomeCategories: readonly PersonalIncomeCategory[] = [],
  personalExpenseCategories: readonly PersonalExpenseCategory[] = [],
): UnifiedMovement[] {
  const incomeMovements: UnifiedMovement[] = incomes.map((income) => ({
    key: `income-${income.id}`,
    kind: 'income',
    date: income.date,
    label: getIncomeDisplayName(income),
    amount: getStoredIncomePrincipalValue(income, income.currency as CurrencyCode),
    currency: income.currency,
    href: `/income/${income.id}`,
    reportBadge: getRecordReportBadge(income),
    category: getIncomeTypeLabel(income),
    personalCategoryLabel: getIncomeCategoryBadgeLabel(income, personalIncomeCategories),
    reported: getRecordReportBadge(income).isReported,
    searchText: [getIncomeDisplayName(income), income.notes].filter(Boolean).join(' '),
  }))

  const expenseMovements: UnifiedMovement[] = expenses.map((expense) => {
    // Profesional conserva la presentación previa (solo categoría); Personal
    // identifica el egreso por su nombre libre o el fallback "Egreso #ID".
    const label = resolveRecordUsageMode(expense) === 'basic'
      ? getExpenseDisplayName(expense)
      : expense.category

    return {
      key: `expense-${expense.id}`,
      kind: 'expense',
      date: expense.date,
      label,
      amount: getStoredExpenseValue(expense, expense.currency as CurrencyCode),
      currency: expense.currency,
      href: `/expenses/${expense.id}/editar`,
      category: expense.category,
      personalCategoryLabel: getExpenseCategoryBadgeLabel(expense, personalExpenseCategories),
      searchText: [label, expense.notes].filter(Boolean).join(' '),
    }
  })

  return [...incomeMovements, ...expenseMovements]
}
