import { describe, expect, it } from 'vitest'

import {
  assertFinancialConversionIsComplete,
  detectFinancialConversionSuspicion,
  FINANCIAL_CONVERSION_INCOMPLETE,
} from '../src/utils/financialConversionValidation'

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    currency: 'EUR', eurValue: 10, copValue: 43_000,
    baseCurrency: 'EUR', secondaryCurrency: 'COP',
    baseCurrencyValue: 10, secondaryCurrencyValue: 43_000,
    exchangeRateBaseToSecondary: 4_300, exchangeRateUsed: 4_300,
    ...overrides,
  }
}

describe('integridad de conversión financiera', () => {
  it('rechaza el cero usado como sustituto de una conversión pendiente', () => {
    expect(() => assertFinancialConversionIsComplete(snapshot({
      eurValue: 0, baseCurrencyValue: 0,
    }), 10)).toThrow(FINANCIAL_CONVERSION_INCOMPLETE)
  })

  it('acepta un importe cero legítimo cuando la instantánea completa también es cero', () => {
    expect(() => assertFinancialConversionIsComplete(snapshot({
      eurValue: 0, copValue: 0, baseCurrencyValue: 0, secondaryCurrencyValue: 0,
    }), 0)).not.toThrow()
  })

  it('rechaza resultados obsoletos de otro importe o moneda', () => {
    expect(() => assertFinancialConversionIsComplete(snapshot(), 20)).toThrow(FINANCIAL_CONVERSION_INCOMPLETE)
    expect(() => assertFinancialConversionIsComplete(snapshot({ currency: 'USD' }), 10))
      .toThrow(FINANCIAL_CONVERSION_INCOMPLETE)
  })

  it('acepta una cotización manual coherente y redondeada', () => {
    expect(() => assertFinancialConversionIsComplete(snapshot({
      currency: 'USD', baseCurrency: 'USD', secondaryCurrency: 'EUR',
      baseCurrencyValue: 10, secondaryCurrencyValue: 9.26,
      exchangeRateBaseToSecondary: 0.926, eurValue: 9.26, copValue: 39_818,
    }), 10)).not.toThrow()
  })

  it('detecta el patrón histórico confirmado sin condenar snapshots legacy incompletos', () => {
    expect(detectFinancialConversionSuspicion(snapshot({ eurValue: 0, baseCurrencyValue: 0 }), 10))
      .toEqual(expect.arrayContaining(['NON_ZERO_AMOUNT_WITH_ZERO_EUR', 'NON_ZERO_AMOUNT_WITH_ZERO_BASE']))
    expect(detectFinancialConversionSuspicion({
      currency: 'EUR', eurValue: 10, copValue: 43_000, exchangeRateUsed: 4_300,
    }, 10)).toEqual([])
  })
})
