import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode, UsageMode } from '../types/settings'
import { roundMoney } from './currency'
import { isAdjustmentIncome, isServiceIncome } from './incomeTypes'
import { getEffectiveFinancialDuration } from './serviceDuration'
import { recordBelongsToUsageMode } from './usageMode'

export const weekdayNames = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
]

/**
 * Valor almacenado del ingreso PRINCIPAL (servicio u horas) ya convertido a
 * `currency`, sin Adicionales — exactamente lo que quedó calculado al crear
 * o editar el ingreso. Uso interno: `getStoredIncomeValue` (agregados de
 * balance) y `getStoredAdditionalsValue` (derivar la tasa de conversión) se
 * apoyan en esta función en vez de una en la otra, para no reintroducir
 * Adicionales dentro de sí misma.
 */
function getStoredBaseIncomeValue(income: ServiceIncome, currency: CurrencyCode) {
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

  if (income.currency === currency) {
    return income.realGain
  }

  return 0
}

export function getStoredIncomePrincipalValue(
  income: ServiceIncome,
  currency: CurrencyCode,
) {
  return roundMoney(getStoredBaseIncomeValue(income, currency))
}

/**
 * Porción de additionalsTotal ya convertida a `currency`, derivada
 * proporcionalmente del importe principal ya convertido (mismo tipo de
 * cambio implícito en baseCurrencyValue/eurValue/copValue), ya que
 * additionalsTotal no tiene su propio snapshot por moneda.
 */
export function getStoredAdditionalsValue(
  income: ServiceIncome,
  currency: CurrencyCode,
) {
  const additionalsTotal = income.additionalsTotal ?? 0

  if (additionalsTotal <= 0 || !income.realGain) {
    return 0
  }

  const convertedBaseValue = getStoredBaseIncomeValue(income, currency)
  return roundMoney(convertedBaseValue * (additionalsTotal / income.realGain))
}

/**
 * Valor total del ingreso para efectos de BALANCE agregado (Inicio,
 * Ganancia, reportes): importe principal + Adicionales. El registro del
 * ingreso en sí (`realGain`/`totalAmount`) nunca incluye Adicionales — esta
 * función es el único punto donde ambos se suman, exclusivamente para
 * agregados, nunca persistido sobre el ingreso individual.
 */
export function getStoredIncomeValue(
  income: ServiceIncome,
  currency: CurrencyCode,
) {
  return roundMoney(
    getStoredIncomePrincipalValue(income, currency) +
      getStoredAdditionalsValue(income, currency),
  )
}

export function sumIncomeAdditionalsValue(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
) {
  return roundMoney(
    incomes.reduce(
      (total, income) => total + getStoredAdditionalsValue(income, currency),
      0,
    ),
  )
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

  if (expense.currency === currency) {
    return expense.amount
  }

  return 0
}

export interface SeasonFinancialResult {
  netIncome: number
  expenses: number
  result: number
}

interface CalculateSeasonFinancialResultInput {
  incomes: readonly ServiceIncome[]
  expenses: readonly Expense[]
  currency: CurrencyCode
  usageMode: UsageMode
  earningPeriodId?: number
}

export function recordBelongsToEarningPeriod(
  record: { earningPeriodId?: number; seasonPeriodId?: number },
  earningPeriodId?: number,
) {
  if (
    record.earningPeriodId !== undefined &&
    record.seasonPeriodId !== undefined &&
    record.earningPeriodId !== record.seasonPeriodId
  ) {
    return false
  }

  if (earningPeriodId === undefined) return true

  const recordPeriodIds = [record.earningPeriodId, record.seasonPeriodId].filter(
    (value): value is number => value !== undefined,
  )

  return recordPeriodIds.length > 0 && recordPeriodIds.every((value) => value === earningPeriodId)
}

export function calculateSeasonFinancialResult({
  incomes,
  expenses,
  currency,
  usageMode,
  earningPeriodId,
}: CalculateSeasonFinancialResultInput): SeasonFinancialResult {
  const netIncome = roundMoney(
    incomes
      .filter(
        (income) =>
          recordBelongsToUsageMode(income, usageMode) &&
          recordBelongsToEarningPeriod(income, earningPeriodId) &&
          !isAdjustmentIncome(income),
      )
      .reduce((total, income) => total + getStoredIncomeValue(income, currency), 0),
  )
  const expenseTotal = roundMoney(
    expenses
      .filter(
        (expense) =>
          recordBelongsToUsageMode(expense, usageMode) &&
          recordBelongsToEarningPeriod(expense, earningPeriodId) &&
          expense.type === 'gasto',
      )
      .reduce((total, expense) => total + getStoredExpenseValue(expense, currency), 0),
  )

  return {
    netIncome,
    expenses: expenseTotal,
    result: roundMoney(netIncome - expenseTotal),
  }
}

export function calculateFinancialTotals(
  incomes: ServiceIncome[],
  expenses: Expense[],
  primaryCurrency: CurrencyCode,
  secondaryCurrency: CurrencyCode,
) {
  const serviceIncomes = incomes.filter(isServiceIncome)
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
    serviceMinutes: serviceIncomes.reduce(
      (total, income) => total + (getEffectiveFinancialDuration(income) ?? 0),
      0,
    ),
    serviceCount: serviceIncomes.length,
    expenseCount: expenses.length,
  }
}

export function calculateAverageIncome(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
) {
  const serviceIncomes = incomes.filter(isServiceIncome)
  if (serviceIncomes.length === 0) {
    return 0
  }

  const incomeTotal = serviceIncomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, currency),
    0,
  )

  return roundMoney(incomeTotal / serviceIncomes.length)
}

export function calculateBestIncomeDay(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
) {
  const serviceIncomes = incomes.filter(isServiceIncome)
  const totalsByWeekday = weekdayNames.map((weekday) => ({
    average: 0,
    count: 0,
    total: 0,
    weekday,
  }))

  serviceIncomes.forEach((income) => {
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

export function calculateIncomeDaysRanking(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
) {
  const serviceIncomes = incomes.filter(isServiceIncome)
  const totalsByDate = new Map<
    string,
    {
      cities: Set<string>
      count: number
      date: string
      total: number
    }
  >()

  serviceIncomes.forEach((income) => {
    const currentDay = totalsByDate.get(income.date) ?? {
      cities: new Set<string>(),
      count: 0,
      date: income.date,
      total: 0,
    }

    if (income.city) {
      currentDay.cities.add(income.city)
    }
    currentDay.count += 1
    currentDay.total += getStoredIncomeValue(income, currency)
    totalsByDate.set(income.date, currentDay)
  })

  return Array.from(totalsByDate.values())
    .map((day) => ({
      ...day,
      average: day.count > 0 ? roundMoney(day.total / day.count) : 0,
      cityNames: Array.from(day.cities).sort((firstCity, secondCity) =>
        firstCity.localeCompare(secondCity, 'es'),
      ),
      total: roundMoney(day.total),
    }))
    .sort((firstDay, secondDay) => {
      if (secondDay.total !== firstDay.total) {
        return secondDay.total - firstDay.total
      }

      return secondDay.date.localeCompare(firstDay.date)
    })
}

export function calculateTrend(currentValue: number, previousValue: number) {
  if (currentValue === previousValue) {
    return 'flat'
  }

  return currentValue > previousValue ? 'up' : 'down'
}
