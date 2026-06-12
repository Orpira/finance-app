import type { CurrencyCode } from './settings'

export type ExchangeRateSource = 'manual' | 'api'

export interface ExchangeRate {
  id?: number
  baseCurrency: CurrencyCode
  targetCurrency: CurrencyCode
  rate: number
  date: string
  source: ExchangeRateSource
  createdAt: string
}
