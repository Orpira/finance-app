import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import { roundMoney } from './currency'

export const ADJUSTMENT_LIMIT_ERROR =
  'El importe del ajuste supera el saldo disponible del ingreso seleccionado.'

export interface AdjustmentCapacity {
  adjustedAmount: number
  availableAmount: number
  currency: string
  incomeAmount: number
  income: ServiceIncome
}

function getExpenseValueInCurrency(expense: Expense, currency: string) {
  if (expense.currency === currency) return expense.amount
  if (expense.baseCurrency === currency && expense.baseCurrencyValue !== undefined) {
    return expense.baseCurrencyValue
  }
  if (
    expense.secondaryCurrency === currency &&
    expense.secondaryCurrencyValue !== undefined
  ) {
    return expense.secondaryCurrencyValue
  }
  if (currency === 'EUR') return expense.eurValue
  if (currency === 'COP') return expense.copValue
  return undefined
}

export function calculateAdjustmentCapacity(
  income: ServiceIncome,
  expenses: Expense[],
  excludedExpenseId?: number,
): AdjustmentCapacity {
  const adjustedAmount = expenses.reduce((total, expense) => {
    if (
      expense.type !== 'ajuste' ||
      expense.relatedIncomeId !== income.id ||
      expense.id === excludedExpenseId
    ) {
      return total
    }

    const value = getExpenseValueInCurrency(expense, income.currency)
    if (value === undefined) {
      throw new Error(
        `No se puede validar el ajuste #${expense.id ?? '-'} en la moneda del ingreso relacionado.`,
      )
    }
    return total + value
  }, 0)

  return {
    adjustedAmount: roundMoney(adjustedAmount),
    availableAmount: roundMoney(Math.max(0, income.totalAmount - adjustedAmount)),
    currency: income.currency,
    incomeAmount: roundMoney(income.totalAmount),
    income,
  }
}

export function assertExpenseAdjustmentIsValid(
  expense: Expense,
  incomes: ServiceIncome[],
  expenses: Expense[],
  excludedExpenseId?: number,
) {
  if (expense.type !== 'ajuste' || expense.relatedIncomeId === undefined) return

  const income = incomes.find((item) => item.id === expense.relatedIncomeId)
  if (!income) {
    throw new Error('El ingreso relacionado con este ajuste no existe.')
  }

  const adjustmentValue = getExpenseValueInCurrency(expense, income.currency)
  if (adjustmentValue === undefined) {
    throw new Error(
      'El ajuste debe poder convertirse a la moneda del ingreso seleccionado.',
    )
  }

  const capacity = calculateAdjustmentCapacity(
    income,
    expenses,
    excludedExpenseId,
  )
  if (roundMoney(adjustmentValue) > capacity.availableAmount) {
    throw new Error(ADJUSTMENT_LIMIT_ERROR)
  }
}

export function assertAllExpenseAdjustmentsAreValid(
  incomes: ServiceIncome[],
  expenses: Expense[],
) {
  const totalsByIncome = new Map<number, number>()

  expenses.forEach((expense) => {
    if (expense.type !== 'ajuste' || expense.relatedIncomeId === undefined) return

    const income = incomes.find((item) => item.id === expense.relatedIncomeId)
    if (!income) throw new Error('El ingreso relacionado con un ajuste no existe.')

    const value = getExpenseValueInCurrency(expense, income.currency)
    if (value === undefined) {
      throw new Error(
        'Un ajuste no se puede validar en la moneda de su ingreso relacionado.',
      )
    }
    totalsByIncome.set(
      expense.relatedIncomeId,
      roundMoney((totalsByIncome.get(expense.relatedIncomeId) ?? 0) + value),
    )
  })

  totalsByIncome.forEach((total, incomeId) => {
    const income = incomes.find((item) => item.id === incomeId)
    if (!income || total > roundMoney(income.totalAmount)) {
      throw new Error(ADJUSTMENT_LIMIT_ERROR)
    }
  })
}
