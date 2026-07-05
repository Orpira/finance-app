import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'
import { getStoredExpenseValue, getStoredIncomeValue } from '../utils/financeStats'
import {
  getIncomeType,
  getIncomeTypeLabel,
  isAdjustmentIncome,
} from '../utils/incomeTypes'

interface BaseRecordSummary {
  id?: number
  date: string
  label: string
  value: number
}

export interface BalanceAdjustmentRecord extends BaseRecordSummary {
  origin: 'income' | 'expense'
  kind: 'positive' | 'negative'
}

export interface BalanceGroupedTotal {
  type: string
  label: string
  count: number
  total: number
}

export interface BalanceReportResult {
  incomeGrossTotal: number
  expenseTotal: number
  adjustmentsPositiveTotal: number
  adjustmentsNegativeTotal: number
  adjustmentImpactTotal: number
  netProfit: number
  generalBalance: number
  impactByAdjustments: number
  incomesByType: BalanceGroupedTotal[]
  expensesByType: BalanceGroupedTotal[]
  adjustments: BalanceAdjustmentRecord[]
  incomeAdjustments: BalanceAdjustmentRecord[]
  expenseAdjustments: BalanceAdjustmentRecord[]
  hasData: boolean
}

interface BuildBalanceReportInput {
  incomes: ServiceIncome[]
  expenses: Expense[]
  currency: CurrencyCode
}

function mapIncomeAdjustment(
  income: ServiceIncome,
  value: number,
): BalanceAdjustmentRecord {
  return {
    id: income.id,
    origin: 'income',
    date: income.date,
    label: income.notes?.trim() || getIncomeTypeLabel(income),
    value,
    kind: value >= 0 ? 'positive' : 'negative',
  }
}

function mapExpenseAdjustment(
  expense: Expense,
  value: number,
): BalanceAdjustmentRecord {
  return {
    id: expense.id,
    origin: 'expense',
    date: expense.date,
    label: expense.notes?.trim() || expense.category || 'Ajuste',
    value,
    kind: value >= 0 ? 'positive' : 'negative',
  }
}

export function buildBalanceReport(input: BuildBalanceReportInput): BalanceReportResult {
  const incomesByTypeMap = new Map<string, BalanceGroupedTotal>()
  const expensesByTypeMap = new Map<string, BalanceGroupedTotal>()

  const incomeAdjustments: BalanceAdjustmentRecord[] = []
  const expenseAdjustments: BalanceAdjustmentRecord[] = []

  let incomeGrossTotal = 0
  let expenseTotal = 0
  let adjustmentsPositiveTotal = 0
  let adjustmentsNegativeTotal = 0

  for (const income of input.incomes) {
    const value = roundMoney(getStoredIncomeValue(income, input.currency))
    const incomeType = getIncomeType(income)
    const label = getIncomeTypeLabel(income)
    const currentType = incomesByTypeMap.get(incomeType) ?? {
      type: incomeType,
      label,
      count: 0,
      total: 0,
    }

    currentType.count += 1
    currentType.total = roundMoney(currentType.total + value)
    incomesByTypeMap.set(incomeType, currentType)

    if (isAdjustmentIncome(income)) {
      incomeAdjustments.push(mapIncomeAdjustment(income, value))
      if (value >= 0) {
        adjustmentsPositiveTotal = roundMoney(adjustmentsPositiveTotal + value)
      } else {
        adjustmentsNegativeTotal = roundMoney(adjustmentsNegativeTotal + Math.abs(value))
      }
      continue
    }

    incomeGrossTotal = roundMoney(incomeGrossTotal + value)
  }

  for (const expense of input.expenses) {
    const value = roundMoney(getStoredExpenseValue(expense, input.currency))
    const expenseType = expense.type
    const label = expenseType === 'ajuste' ? 'Ajuste' : 'Gasto'
    const currentType = expensesByTypeMap.get(expenseType) ?? {
      type: expenseType,
      label,
      count: 0,
      total: 0,
    }

    currentType.count += 1
    currentType.total = roundMoney(currentType.total + value)
    expensesByTypeMap.set(expenseType, currentType)

    if (expense.type === 'ajuste') {
      expenseAdjustments.push(mapExpenseAdjustment(expense, value))
      if (value >= 0) {
        adjustmentsPositiveTotal = roundMoney(adjustmentsPositiveTotal + value)
      } else {
        adjustmentsNegativeTotal = roundMoney(adjustmentsNegativeTotal + Math.abs(value))
      }
      continue
    }

    expenseTotal = roundMoney(expenseTotal + value)
  }

  const adjustments = [...incomeAdjustments, ...expenseAdjustments].sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date)
    }

    return (b.id ?? 0) - (a.id ?? 0)
  })

  const adjustmentImpactTotal = roundMoney(adjustmentsPositiveTotal - adjustmentsNegativeTotal)
  const netProfit = roundMoney(incomeGrossTotal - expenseTotal)
  const generalBalance = roundMoney(netProfit + adjustmentImpactTotal)

  return {
    incomeGrossTotal,
    expenseTotal,
    adjustmentsPositiveTotal,
    adjustmentsNegativeTotal,
    adjustmentImpactTotal,
    impactByAdjustments: adjustmentImpactTotal,
    netProfit,
    generalBalance,
    incomesByType: Array.from(incomesByTypeMap.values()).sort((first, second) =>
      first.label.localeCompare(second.label, 'es'),
    ),
    expensesByType: Array.from(expensesByTypeMap.values()).sort((first, second) =>
      first.label.localeCompare(second.label, 'es'),
    ),
    adjustments,
    incomeAdjustments,
    expenseAdjustments,
    hasData: input.incomes.length > 0 || input.expenses.length > 0,
  }
}