import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import { roundMoney } from './currency'

const weekdayNames = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

export function getStoredIncomeValue(
  income: ServiceIncome,
  currency: CurrencyCode,
) {
  if (income.baseCurrency === currency && income.baseCurrencyValue !== undefined) {
    return income.baseCurrencyValue
  }

  if (
    income.secondaryCurrency === currency &&
    income.secondaryCurrencyValue !== undefined
  ) {
    return income.secondaryCurrencyValue
  }

  if (currency === 'EUR') {
    return income.eurValue
  }

  if (currency === 'COP') {
    return income.copValue
  }

  return 0
}

export function getStoredExpenseValue(expense: Expense, currency: CurrencyCode) {
  if (
    expense.baseCurrency === currency &&
    expense.baseCurrencyValue !== undefined
  ) {
    return expense.baseCurrencyValue
  }

  if (
    expense.secondaryCurrency === currency &&
    expense.secondaryCurrencyValue !== undefined
  ) {
    return expense.secondaryCurrencyValue
  }

  if (currency === 'EUR') {
    return expense.eurValue
  }

  if (currency === 'COP') {
    return expense.copValue
  }

  return 0
}

export function calculateFinancialTotals(
  incomes: ServiceIncome[],
  expenses: Expense[],
  primaryCurrency: CurrencyCode,
  secondaryCurrency: CurrencyCode,
) {
  const primaryIncome = incomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, primaryCurrency),
    0,
  )
  const secondaryIncome = incomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, secondaryCurrency),
    0,
  )
  const primaryExpenses = expenses.reduce(
    (total, expense) => total + getStoredExpenseValue(expense, primaryCurrency),
    0,
  )
  const secondaryExpenses = expenses.reduce(
    (total, expense) =>
      total + getStoredExpenseValue(expense, secondaryCurrency),
    0,
  )

  return {
    primaryIncome: roundMoney(primaryIncome),
    secondaryIncome: roundMoney(secondaryIncome),
    primaryExpenses: roundMoney(primaryExpenses),
    secondaryExpenses: roundMoney(secondaryExpenses),
    primaryNet: roundMoney(primaryIncome - primaryExpenses),
    secondaryNet: roundMoney(secondaryIncome - secondaryExpenses),
    serviceMinutes: incomes.reduce((total, income) => total + income.duration, 0),
    serviceCount: incomes.length,
    expenseCount: expenses.length,
  }
}

export function calculateAverageIncome(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
) {
  if (incomes.length === 0) {
    return 0
  }

  const incomeTotal = incomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, currency),
    0,
  )

  return roundMoney(incomeTotal / incomes.length)
}

export function calculateBestIncomeDay(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
) {
  const totalsByWeekday = weekdayNames.map((weekday) => ({
    average: 0,
    count: 0,
    total: 0,
    weekday,
  }))

  incomes.forEach((income) => {
    const weekday = new Date(`${income.date}T00:00`).getDay()
    totalsByWeekday[weekday].total += getStoredIncomeValue(income, currency)
    totalsByWeekday[weekday].count += 1
  })

  const daysWithAverage = totalsByWeekday.map((day) => ({
    ...day,
    average: day.count > 0 ? roundMoney(day.total / day.count) : 0,
  }))

  return daysWithAverage.reduce(
    (bestDay, day) => (day.average > bestDay.average ? day : bestDay),
    daysWithAverage[0],
  )
}

export function calculateTrend(currentValue: number, previousValue: number) {
  if (currentValue === previousValue) {
    return 'flat'
  }

  return currentValue > previousValue ? 'up' : 'down'
}
