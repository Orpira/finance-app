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
  const exchangeRate: ExchangeRate = {
    ...input,
    source: input.source ?? 'manual',
    createdAt: new Date().toISOString(),
  }

  return db.exchangeRates.add(exchangeRate)
}

export function listExchangeRates() {
  return db.exchangeRates.orderBy('date').reverse().toArray()
}

export async function getExchangeRate(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  date: string,
) {
  return db.exchangeRates
    .where('[baseCurrency+targetCurrency+date]')
    .equals([baseCurrency, targetCurrency, date])
    .first()
}

export async function getLatestExchangeRate(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
) {
  return db.exchangeRates
    .where('[baseCurrency+targetCurrency+date]')
    .between(
      [baseCurrency, targetCurrency, ''],
      [baseCurrency, targetCurrency, '\uffff'],
      true,
      true,
    )
    .last()
}

export function deleteExchangeRate(id: number) {
  return db.exchangeRates.delete(id)
}
