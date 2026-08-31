import type { CurrencyCode } from '../types/settings'

export const EUR_COP_DEFAULT_RATE = 4300

export function formatCurrency(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 2,
  }).format(amount)
}

/**
 * Fecha calendario LOCAL (no UTC) en formato YYYY-MM-DD — la fecha de
 * negocio canónica de Private Balance para ingresos, egresos, citas y
 * temporadas. Un movimiento registrado a las 00:47 hora local pertenece al
 * día local en que ocurrió, aunque su instante UTC equivalente todavía
 * corresponda al día anterior (p.ej. 01/09 00:47 en Madrid = 31/08 22:47
 * UTC). `date.toISOString().slice(0, 10)` desplaza un día hacia atrás
 * cualquier hora local posterior a medianoche en husos UTC+; esta función
 * deriva la fecha solo de los componentes locales del `Date`, nunca de su
 * representación UTC, y por eso es DST-safe sin offsets manuales.
 */
export function getLocalDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function getTodayInputDate() {
  return getLocalDateKey(new Date())
}

export function getCurrentMonthRange() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const from = getLocalDateKey(new Date(year, month, 1))
  const to = getLocalDateKey(new Date(year, month + 1, 0))

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
    from: getLocalDateKey(monday),
    to: getLocalDateKey(sunday),
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
    from: getLocalDateKey(fromDate),
    to: getLocalDateKey(now),
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
