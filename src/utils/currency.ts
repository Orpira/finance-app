import type { CurrencyCode } from '../types/settings'

export const EUR_COP_DEFAULT_RATE = 4300

export function formatCurrency(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount)
}

export function getTodayInputDate() {
  return new Date().toISOString().slice(0, 10)
}

export function getCurrentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const from = new Date(year, month, 1).toISOString().slice(0, 10)
  const to = new Date(year, month + 1, 0).toISOString().slice(0, 10)

  return { from, to }
}

export function getCurrentWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  }
}

export function getCurrentYearRange() {
  const now = new Date()
  const year = now.getFullYear()

  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  }
}

export function getLastDaysRange(days: number) {
  const now = new Date()
  const fromDate = new Date(now)
  fromDate.setDate(now.getDate() - (days - 1))

  return {
    from: fromDate.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  }
}

export function calculateEurCopValues(
  amount: number,
  currency: CurrencyCode,
  eurCopRate: number,
) {
  if (currency === 'COP') {
    return {
      eurValue: amount / eurCopRate,
      copValue: amount,
    }
  }

  return {
    eurValue: amount,
    copValue: amount * eurCopRate,
  }
}

export function roundMoney(amount: number) {
  return Math.round(amount * 100) / 100
}
