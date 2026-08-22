import type { ExchangeRate } from '../types/exchangeRate'
import type { CurrencyCode } from '../types/settings'
import {
  resolveExchangeRate,
  type ResolvedExchangeRate,
} from './currencyConversionService'
import { getLatestExchangeRate } from './exchangeRateService'

export type CurrencyQuoteSource = 'api' | 'cache' | 'manual' | 'reference' | 'unavailable'

export interface CurrencyQuote {
  baseCurrency: CurrencyCode
  targetCurrency: CurrencyCode
  rate: number | null
  source: CurrencyQuoteSource
  date: string
  updatedAt?: string
}

interface LoadCurrencyQuotesInput {
  baseCurrency: CurrencyCode
  targetCurrencies: readonly CurrencyCode[]
  date: string
  allowNetwork: boolean
  forceRefresh?: boolean
}

interface CurrencyQuoteDependencies {
  getLatestRate?: (
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
  ) => Promise<ExchangeRate | undefined>
  resolveRate?: (
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
    options: { date: string; useApi: boolean },
  ) => Promise<ResolvedExchangeRate>
}

const DEFAULT_QUOTE_TARGETS: readonly CurrencyCode[] = [
  'USD',
  'EUR',
  'GBP',
  'COP',
  'MXN',
  'ARS',
]

export function getCurrencyQuoteTargets(
  baseCurrency: CurrencyCode,
  secondaryCurrency: CurrencyCode,
) {
  return [...new Set<CurrencyCode>([
    secondaryCurrency,
    ...DEFAULT_QUOTE_TARGETS,
  ])]
    .filter((currency) => currency !== baseCurrency)
    .slice(0, 4)
}

function mapQuoteSource(source: ResolvedExchangeRate['source']): CurrencyQuoteSource {
  if (source === 'api') return 'api'
  if (source === 'offline') return 'cache'
  if (source === 'manual') return 'manual'
  return 'reference'
}

export async function loadCurrencyQuotes(
  input: LoadCurrencyQuotesInput,
  dependencies: CurrencyQuoteDependencies = {},
) {
  const getLatestRate = dependencies.getLatestRate ?? getLatestExchangeRate
  const resolveRate = dependencies.resolveRate ?? resolveExchangeRate
  const targetCurrencies = [...new Set(input.targetCurrencies)]
    .filter((currency) => currency !== input.baseCurrency)

  return Promise.all(targetCurrencies.map(async (targetCurrency): Promise<CurrencyQuote> => {
    const cachedRate = await getLatestRate(input.baseCurrency, targetCurrency)

    if (
      !input.forceRefresh &&
      cachedRate?.source === 'api' &&
      cachedRate.date === input.date
    ) {
      return {
        baseCurrency: input.baseCurrency,
        targetCurrency,
        rate: cachedRate.rate,
        source: 'cache',
        date: cachedRate.date,
        updatedAt: cachedRate.createdAt,
      }
    }

    try {
      const resolvedRate = await resolveRate(input.baseCurrency, targetCurrency, {
        date: input.date,
        useApi: input.allowNetwork,
      })
      const cachedResolution = resolvedRate.source === 'offline' || resolvedRate.source === 'manual'
        ? cachedRate
        : undefined
      const source = resolvedRate.source === 'offline' && cachedRate?.source === 'manual'
        ? 'manual'
        : mapQuoteSource(resolvedRate.source)

      return {
        baseCurrency: input.baseCurrency,
        targetCurrency,
        rate: resolvedRate.rate,
        source,
        date: cachedResolution?.date ?? input.date,
        updatedAt: cachedResolution?.createdAt,
      }
    } catch {
      return {
        baseCurrency: input.baseCurrency,
        targetCurrency,
        rate: null,
        source: 'unavailable',
        date: input.date,
      }
    }
  }))
}