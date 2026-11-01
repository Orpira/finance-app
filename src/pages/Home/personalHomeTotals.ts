import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { CurrencyCode } from '../../types/settings'
import { calculateFinancialTotals } from '../../utils/financeStats'
import { recordBelongsToUsageMode } from '../../utils/usageMode'

/** Personal carries its balance across months; internal transfers are excluded. */
export function calculatePersonalHomeTotals(
  incomes: ServiceIncome[],
  expenses: Expense[],
  currency: CurrencyCode,
  secondaryCurrency: CurrencyCode,
) {
  return calculateFinancialTotals(
    incomes.filter((income) => recordBelongsToUsageMode(income, 'basic')),
    expenses.filter((expense) => recordBelongsToUsageMode(expense, 'basic')),
    currency,
    secondaryCurrency,
  )
}
