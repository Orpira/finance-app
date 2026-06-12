import {
  getLatestExchangeRate,
  saveExchangeRate,
} from './exchangeRateService'
import { EUR_COP_DEFAULT_RATE } from '../utils/currency'
import type { CurrencyCode } from '../types/settings'

const FRANKFURTER_API_BASE_URL = 'https://api.frankfurter.dev/v2/rate'

const currencyUnitsPerEur: Record<CurrencyCode, number> = {
  BGN: 1.95583,
  COP: EUR_COP_DEFAULT_RATE,
  CZK: 25,
  DKK: 7.46,
  EUR: 1,
  GBP: 0.86,
  HUF: 390,
  PLN: 4.3,
  RON: 5,
  SEK: 11.2,
  USD: 1.08,
}

export type ExchangeRateResolutionSource = 'api' | 'offline' | 'default' | 'manual'

interface FrankfurterRateResponse {
  rate: number
  date?: string
}

export interface ResolveExchangeRateOptions {
  date?: string
  manualRate?: number
  useApi?: boolean
}

export interface ResolveEurCopRateOptions extends ResolveExchangeRateOptions {
  manualEurCopRate?: number
}

export interface ResolvedExchangeRate {
  rate: number
  source: ExchangeRateResolutionSource
}

export interface ConvertedCurrencyValues {
  eurValue: number
  copValue: number
  eurCopRate: number
  source: ExchangeRateResolutionSource
}

export interface ConvertedCurrencyPairValues {
  primaryValue: number
  secondaryValue: number
  rate: number
  source: ExchangeRateResolutionSource
}

async function fetchExchangeRateFromApi(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  date?: string,
) {
  const url = new URL(
    `${FRANKFURTER_API_BASE_URL}/${baseCurrency}/${targetCurrency}`,
  )

  if (date) {
    url.searchParams.set('date', date)
  }

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error('No se pudo obtener la tasa online.')
  }

  const data = (await response.json()) as FrankfurterRateResponse

  if (typeof data.rate !== 'number' || data.rate <= 0) {
    throw new Error('La tasa online no es válida.')
  }

  return data.rate
}

function getOfflineExchangeRate(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
) {
  return currencyUnitsPerEur[targetCurrency] / currencyUnitsPerEur[baseCurrency]
}

export async function resolveExchangeRate(
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  options: ResolveExchangeRateOptions = {},
): Promise<ResolvedExchangeRate> {
  const { date, manualRate, useApi = true } = options

  if (baseCurrency === targetCurrency) {
    return { rate: 1, source: 'default' }
  }

  if (!useApi && manualRate && manualRate > 0) {
    return { rate: manualRate, source: 'manual' }
  }

  if (useApi && navigator.onLine) {
    try {
      const rate = await fetchExchangeRateFromApi(
        baseCurrency,
        targetCurrency,
        date,
      )

      await saveExchangeRate({
        baseCurrency,
        targetCurrency,
        rate,
        date: date ?? new Date().toISOString().slice(0, 10),
        source: 'api',
      })

      return { rate, source: 'api' }
    } catch {
      // Offline fallback below.
    }
  }

  const offlineRate = await getLatestExchangeRate(baseCurrency, targetCurrency)

  if (offlineRate) {
    return { rate: offlineRate.rate, source: 'offline' }
  }

  return {
    rate: getOfflineExchangeRate(baseCurrency, targetCurrency),
    source: 'default',
  }
}

export async function convertCurrency(
  amount: number,
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
  options: ResolveExchangeRateOptions = {},
) {
  const resolvedRate = await resolveExchangeRate(
    baseCurrency,
    targetCurrency,
    options,
  )

  return {
    value: amount * resolvedRate.rate,
    rate: resolvedRate.rate,
    source: resolvedRate.source,
  }
}

export async function convertCurrencyPair(
  amount: number,
  primaryCurrency: CurrencyCode,
  secondaryCurrency: CurrencyCode,
  options: ResolveExchangeRateOptions = {},
): Promise<ConvertedCurrencyPairValues> {
  const convertedValue = await convertCurrency(
    amount,
    primaryCurrency,
    secondaryCurrency,
    options,
  )

  return {
    primaryValue: amount,
    secondaryValue: convertedValue.value,
    rate: convertedValue.rate,
    source: convertedValue.source,
  }
}

export async function resolveEurCopExchangeRate(
  options: ResolveEurCopRateOptions = {},
): Promise<ResolvedExchangeRate> {
  const { manualEurCopRate, ...restOptions } = options

  return resolveExchangeRate('EUR', 'COP', {
    ...restOptions,
    manualRate: restOptions.manualRate ?? manualEurCopRate,
  })
}

export async function convertCurrencyToEurCop(
  amount: number,
  currency: CurrencyCode,
  options: ResolveEurCopRateOptions = {},
): Promise<ConvertedCurrencyValues> {
  const { manualEurCopRate, ...restOptions } = options
  const [eurConversion, copConversion] = await Promise.all([
    convertCurrency(amount, currency, 'EUR', restOptions),
    convertCurrency(amount, currency, 'COP', {
      ...restOptions,
      manualRate:
        currency === 'EUR'
          ? restOptions.manualRate ?? manualEurCopRate
          : restOptions.manualRate,
    }),
  ])
  const eurCopRate = await resolveEurCopExchangeRate(options)

  return {
    eurValue: eurConversion.value,
    copValue: copConversion.value,
    eurCopRate: eurCopRate.rate,
    source:
      eurConversion.source === 'api' || copConversion.source === 'api'
        ? 'api'
        : eurConversion.source === 'manual' || copConversion.source === 'manual'
          ? 'manual'
          : eurConversion.source === 'offline' ||
              copConversion.source === 'offline'
            ? 'offline'
            : 'default',
  }
}
