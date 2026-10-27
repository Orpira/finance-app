import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveExchangeRateMock = vi.fn()
vi.mock('./currencyConversionService', () => ({
  resolveExchangeRate: (...args: unknown[]) => resolveExchangeRateMock(...args),
}))

const {
  FINANCIAL_QUOTE_UNAVAILABLE,
  prepareFinancialConversionSnapshot,
} = await import('./financialConversionSnapshotService')

beforeEach(() => {
  vi.clearAllMocks()
  resolveExchangeRateMock.mockImplementation(async (base: string, target: string) => {
    if (base === target) return { rate: 1, source: 'default' }
    if (base === 'USD' && target === 'EUR') return { rate: 0.8, source: 'api' }
    if (base === 'USD' && target === 'COP') return { rate: 3_600, source: 'api' }
    if (base === 'EUR' && target === 'COP') return { rate: 4_500, source: 'api' }
    throw new Error('unexpected pair')
  })
})

describe('prepareFinancialConversionSnapshot', () => {
  it('construye el snapshot completo para los mismos parámetros de la operación', async () => {
    const result = await prepareFinancialConversionSnapshot({
      amount: 25,
      currency: 'USD',
      date: '2026-08-20',
      settings: { secondaryCurrency: 'COP', rateMode: 'automatic' },
    })

    expect(result).toMatchObject({
      currency: 'USD',
      eurValue: 20,
      copValue: 90_000,
      baseCurrency: 'USD',
      secondaryCurrency: 'COP',
      baseCurrencyValue: 25,
      secondaryCurrencyValue: 90_000,
      exchangeRateBaseToSecondary: 3_600,
      exchangeRateUsed: 3_600,
      eurCopExchangeRateUsed: 4_500,
    })
    expect(resolveExchangeRateMock).toHaveBeenCalledWith('USD', 'COP', expect.objectContaining({ date: '2026-08-20' }))
  })

  it('admite cotizaciones manuales u offline persistidas', async () => {
    resolveExchangeRateMock.mockImplementation(async (base: string, target: string) => ({
      rate: base === target ? 1 : base === 'EUR' ? 4_300 : 1 / 4_300,
      source: base === target ? 'default' : 'offline',
    }))

    const result = await prepareFinancialConversionSnapshot({
      amount: 43_000,
      currency: 'COP',
      date: '2026-08-20',
      settings: { secondaryCurrency: 'COP', rateMode: 'manual' },
    })
    expect(result.eurValue).toBe(10)
    expect(result.quoteSources).toContain('offline')
    expect(resolveExchangeRateMock).toHaveBeenCalledWith('COP', 'EUR', expect.objectContaining({ useApi: false }))
  })

  it('aplica una tasa manual explícita al par sin convertirlo dos veces', async () => {
    resolveExchangeRateMock.mockImplementation(async (base: string, target: string, options: { manualRate?: number }) => {
      if (base === target) return { rate: 1, source: 'default' }
      if (options.manualRate) return { rate: options.manualRate, source: 'manual' }
      return { rate: base === 'EUR' ? 4_300 : 1 / 4_300, source: 'offline' }
    })

    const result = await prepareFinancialConversionSnapshot({
      amount: 10,
      currency: 'EUR',
      date: '2026-08-20',
      settings: { secondaryCurrency: 'COP', rateMode: 'manual' },
      manualPairRate: 4_400,
      manualEurCopRate: 4_400,
    })
    expect(result.copValue).toBe(44_000)
    expect(result.secondaryCurrencyValue).toBe(44_000)
    expect(resolveExchangeRateMock.mock.calls.filter(([base, target]) => base === 'EUR' && target === 'COP')).toHaveLength(1)
  })

  it('rechaza el fallback de referencia para pares distintos', async () => {
    resolveExchangeRateMock.mockResolvedValue({ rate: 4_300, source: 'default' })

    await expect(prepareFinancialConversionSnapshot({
      amount: 10,
      currency: 'EUR',
      date: '2026-08-20',
      settings: { secondaryCurrency: 'COP', rateMode: 'manual' },
    })).rejects.toThrow(FINANCIAL_QUOTE_UNAVAILABLE)
  })

  it('rechaza tasas no finitas o no positivas', async () => {
    resolveExchangeRateMock.mockResolvedValue({ rate: 0, source: 'offline' })

    await expect(prepareFinancialConversionSnapshot({
      amount: 10,
      currency: 'EUR',
      date: '2026-08-20',
      settings: { secondaryCurrency: 'COP', rateMode: 'manual' },
    })).rejects.toThrow(FINANCIAL_QUOTE_UNAVAILABLE)
  })
})
