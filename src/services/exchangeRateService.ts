import { db } from '../database/db'
import type {
  ExchangeRate,
  ExchangeRateSource,
} from '../types/exchangeRate'
import type { CurrencyCode } from '../types/settings'

export interface SaveExchangeRateInput {
  baseCurrency: CurrencyCode
  targetCurrency: CurrencyCode
  rate: number
  date: string
  source?: ExchangeRateSource
}

export async function saveExchangeRate(input: SaveExchangeRateInput) {
  return db.transaction('rw', db.exchangeRates, async () => {
    const source = input.source ?? 'manual'
    const sameDate = await db.exchangeRates
      .where('[baseCurrency+targetCurrency+date]')
      .equals([input.baseCurrency, input.targetCurrency, input.date])
      .toArray()
    const duplicate = sameDate.find((rate) => rate.rate === input.rate && rate.source === source)
    if (duplicate?.id !== undefined) return duplicate.id

    const exchangeRate: ExchangeRate = {
      ...input,
      source,
      createdAt: new Date().toISOString(),
    }
    return db.exchangeRates.add(exchangeRate)
  })
}

export function listExchangeRates() {
  return db.exchangeRates.orderBy('date').reverse().toArray()
}

export async function getExchangeRate(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  date: string,
) {
  const matches = await db.exchangeRates
    .where('[baseCurrency+targetCurrency+date]')
    .equals([baseCurrency, targetCurrency, date])
    .toArray()
  return matches.sort(compareNewestRate)[0]
}

export async function getLatestExchangeRate(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
) {
  const matches = await db.exchangeRates
    .where('[baseCurrency+targetCurrency+date]')
    .between(
      [baseCurrency, targetCurrency, ''],
      [baseCurrency, targetCurrency, '\uffff'],
      true,
      true,
    )
    .toArray()
  return matches.sort(compareNewestRate)[0]
}

function compareNewestRate(left: ExchangeRate, right: ExchangeRate) {
  return right.date.localeCompare(left.date) ||
    right.createdAt.localeCompare(left.createdAt) ||
    (right.id ?? 0) - (left.id ?? 0)
}

export function deleteExchangeRate(id: number) {
  return db.exchangeRates.delete(id)
}
