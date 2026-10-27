import type { AppSettings, CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'
import {
  FINANCIAL_CONVERSION_INCOMPLETE,
  assertFinancialConversionIsComplete,
  type FinancialConversionSnapshot,
} from '../utils/financialConversionValidation'
import {
  resolveExchangeRate,
  type ExchangeRateResolutionSource,
  type ResolveExchangeRateOptions,
} from './currencyConversionService'

export const FINANCIAL_QUOTE_UNAVAILABLE = 'FINANCIAL_QUOTE_UNAVAILABLE'

export interface PrepareFinancialConversionSnapshotInput {
  amount: number
  currency: CurrencyCode
  date: string
  settings: Pick<AppSettings, 'secondaryCurrency' | 'rateMode'>
  manualPairRate?: number
  manualEurCopRate?: number
}

export interface PreparedFinancialConversionSnapshot extends FinancialConversionSnapshot {
  currency: CurrencyCode
  baseCurrency: CurrencyCode
  secondaryCurrency: CurrencyCode
  baseCurrencyValue: number
  secondaryCurrencyValue: number
  exchangeRateBaseToSecondary: number
  exchangeRateUsed: number
  eurCopExchangeRateUsed: number
  quoteSources: readonly ExchangeRateResolutionSource[]
}

function assertVerifiedRate(
  rate: number,
  source: ExchangeRateResolutionSource,
  baseCurrency: CurrencyCode,
  targetCurrency: CurrencyCode,
) {
  if (!Number.isFinite(rate) || rate <= 0 ||
    (source === 'default' && baseCurrency !== targetCurrency)) {
    throw new Error(FINANCIAL_QUOTE_UNAVAILABLE)
  }
}

/**
 * Prepara una instantánea completa sin persistir el movimiento. Solo admite
 * identidad, cotización API, tasa manual explícita o una tasa ya persistida.
 * El fallback de referencia nunca se considera una cotización verificable.
 */
export async function prepareFinancialConversionSnapshot(
  input: PrepareFinancialConversionSnapshotInput,
): Promise<PreparedFinancialConversionSnapshot> {
  const { amount, currency, date, settings } = input
  if (!Number.isFinite(amount)) throw new Error(FINANCIAL_CONVERSION_INCOMPLETE)

  const quoteCache = new Map<string, Promise<{ rate: number; source: ExchangeRateResolutionSource }>>()
  const manualRateFor = (baseCurrency: CurrencyCode, targetCurrency: CurrencyCode) => {
    if (baseCurrency === currency && targetCurrency === settings.secondaryCurrency &&
      input.manualPairRate !== undefined) {
      return input.manualPairRate
    }
    if (baseCurrency === 'EUR' && targetCurrency === 'COP') return input.manualEurCopRate
    return undefined
  }
  const quote = (
    baseCurrency: CurrencyCode,
    targetCurrency: CurrencyCode,
  ) => {
    const key = `${baseCurrency}:${targetCurrency}`
    const cached = quoteCache.get(key)
    if (cached) return cached
    const manualRate = manualRateFor(baseCurrency, targetCurrency)
    const options: ResolveExchangeRateOptions = {
      date,
      useApi: settings.rateMode === 'automatic',
      ...(manualRate !== undefined ? { manualRate } : {}),
    }
    const pending = resolveExchangeRate(baseCurrency, targetCurrency, options)
      .then((resolved) => {
        assertVerifiedRate(resolved.rate, resolved.source, baseCurrency, targetCurrency)
        return resolved
      })
    quoteCache.set(key, pending)
    return pending
  }

  const [pair, toEur, toCop, eurCop] = await Promise.all([
    quote(currency, settings.secondaryCurrency),
    quote(currency, 'EUR'),
    quote(currency, 'COP'),
    quote('EUR', 'COP'),
  ])

  const snapshot: PreparedFinancialConversionSnapshot = {
    currency,
    eurValue: roundMoney(amount * toEur.rate),
    copValue: roundMoney(amount * toCop.rate),
    baseCurrency: currency,
    secondaryCurrency: settings.secondaryCurrency,
    baseCurrencyValue: roundMoney(amount),
    secondaryCurrencyValue: roundMoney(amount * pair.rate),
    exchangeRateBaseToSecondary: pair.rate,
    exchangeRateUsed: pair.rate,
    eurCopExchangeRateUsed: eurCop.rate,
    quoteSources: [...new Set([pair.source, toEur.source, toCop.source, eurCop.source])],
  }
  assertFinancialConversionIsComplete(snapshot, amount)
  return snapshot
}
