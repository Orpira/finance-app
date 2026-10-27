import { roundMoney } from './currency'

export const FINANCIAL_CONVERSION_INCOMPLETE = 'FINANCIAL_CONVERSION_INCOMPLETE'

export interface FinancialConversionSnapshot {
  currency: string
  eurValue: number
  copValue: number
  baseCurrency?: string
  secondaryCurrency?: string
  baseCurrencyValue?: number
  secondaryCurrencyValue?: number
  exchangeRateBaseToSecondary?: number
  exchangeRateUsed?: number
}

/** Valida la instantánea ya calculada; no obtiene ni inventa cotizaciones. */
export function assertFinancialConversionIsComplete(
  record: FinancialConversionSnapshot,
  sourceAmount: number,
): void {
  const values = [sourceAmount, record.eurValue, record.copValue]
  if (!values.every(Number.isFinite) || !Number.isFinite(record.exchangeRateUsed) || record.exchangeRateUsed! <= 0) {
    throw new Error(FINANCIAL_CONVERSION_INCOMPLETE)
  }
  if (!record.baseCurrency || record.baseCurrency !== record.currency ||
    !record.secondaryCurrency || record.baseCurrencyValue === undefined ||
    record.secondaryCurrencyValue === undefined ||
    !Number.isFinite(record.baseCurrencyValue) ||
    !Number.isFinite(record.secondaryCurrencyValue) ||
    !Number.isFinite(record.exchangeRateBaseToSecondary) ||
    record.exchangeRateBaseToSecondary! <= 0) {
    throw new Error(FINANCIAL_CONVERSION_INCOMPLETE)
  }

  const pairRate = record.exchangeRateBaseToSecondary
  if (roundMoney(record.baseCurrencyValue) !== roundMoney(sourceAmount) ||
    roundMoney(record.secondaryCurrencyValue) !==
      roundMoney(sourceAmount * pairRate!)) {
    throw new Error(FINANCIAL_CONVERSION_INCOMPLETE)
  }

  if (sourceAmount === 0) {
    if (record.eurValue !== 0 || record.copValue !== 0 ||
      record.baseCurrencyValue !== 0 || record.secondaryCurrencyValue !== 0) {
      throw new Error(FINANCIAL_CONVERSION_INCOMPLETE)
    }
    return
  }

  if (record.eurValue === 0 || Math.sign(record.eurValue) !== Math.sign(sourceAmount) ||
    Math.sign(record.copValue) !== Math.sign(sourceAmount)) {
    throw new Error(FINANCIAL_CONVERSION_INCOMPLETE)
  }
}

export const FINANCIAL_CONVERSION_FIELDS = new Set([
  'currency', 'realGain', 'amount', 'eurValue', 'copValue', 'baseCurrency',
  'secondaryCurrency', 'baseCurrencyValue', 'secondaryCurrencyValue',
  'exchangeRateBaseToSecondary', 'exchangeRateUsed',
])

export function updatesFinancialConversion(updates: object) {
  return Object.keys(updates).some((field) => FINANCIAL_CONVERSION_FIELDS.has(field))
}

export type FinancialConversionSuspicion =
  | 'NON_ZERO_AMOUNT_WITH_ZERO_EUR'
  | 'NON_ZERO_AMOUNT_WITH_ZERO_BASE'
  | 'INCONSISTENT_COMPLETE_SNAPSHOT'

/** Auditoría conservadora: no considera sospechoso un snapshot legacy incompleto por sí solo. */
export function detectFinancialConversionSuspicion(
  record: FinancialConversionSnapshot,
  sourceAmount: number,
): FinancialConversionSuspicion[] {
  const reasons: FinancialConversionSuspicion[] = []
  if (sourceAmount !== 0 && record.eurValue === 0) reasons.push('NON_ZERO_AMOUNT_WITH_ZERO_EUR')
  if (sourceAmount !== 0 && record.baseCurrencyValue === 0) reasons.push('NON_ZERO_AMOUNT_WITH_ZERO_BASE')
  const hasCompleteSnapshot = record.baseCurrency !== undefined && record.secondaryCurrency !== undefined &&
    record.baseCurrencyValue !== undefined && record.secondaryCurrencyValue !== undefined &&
    record.exchangeRateBaseToSecondary !== undefined && record.exchangeRateUsed !== undefined
  if (hasCompleteSnapshot) {
    try {
      assertFinancialConversionIsComplete(record, sourceAmount)
    } catch {
      reasons.push('INCONSISTENT_COMPLETE_SNAPSHOT')
    }
  }
  return [...new Set(reasons)]
}
