import { describe, expect, it, vi } from 'vitest'

import {
  getCurrencyQuoteTargets,
  loadCurrencyQuotes,
} from './currencyQuoteService'

describe('getCurrencyQuoteTargets', () => {
  it('prioriza la moneda secundaria y completa cuatro monedas sin repetir la base', () => {
    expect(getCurrencyQuoteTargets('EUR', 'COP')).toEqual([
      'COP',
      'USD',
      'GBP',
      'MXN',
    ])
  })
})

describe('loadCurrencyQuotes', () => {
  it('reutiliza la cotización API del día sin volver a resolverla', async () => {
    const resolveRate = vi.fn()
    const quotes = await loadCurrencyQuotes({
      allowNetwork: true,
      baseCurrency: 'EUR',
      date: '2026-08-21',
      targetCurrencies: ['USD'],
    }, {
      getLatestRate: vi.fn().mockResolvedValue({
        baseCurrency: 'EUR',
        createdAt: '2026-08-21T08:00:00.000Z',
        date: '2026-08-21',
        rate: 1.16,
        source: 'api',
        targetCurrency: 'USD',
      }),
      resolveRate,
    })

    expect(resolveRate).not.toHaveBeenCalled()
    expect(quotes).toEqual([expect.objectContaining({
      rate: 1.16,
      source: 'cache',
      targetCurrency: 'USD',
    })])
  })

  it('actualiza una cotización antigua cuando la red está permitida', async () => {
    const resolveRate = vi.fn().mockResolvedValue({ rate: 1.17, source: 'api' })
    const quotes = await loadCurrencyQuotes({
      allowNetwork: true,
      baseCurrency: 'EUR',
      date: '2026-08-21',
      targetCurrencies: ['USD'],
    }, {
      getLatestRate: vi.fn().mockResolvedValue({
        baseCurrency: 'EUR',
        createdAt: '2026-08-20T08:00:00.000Z',
        date: '2026-08-20',
        rate: 1.15,
        source: 'api',
        targetCurrency: 'USD',
      }),
      resolveRate,
    })

    expect(resolveRate).toHaveBeenCalledWith('EUR', 'USD', {
      date: '2026-08-21',
      useApi: true,
    })
    expect(quotes[0]).toEqual(expect.objectContaining({ rate: 1.17, source: 'api' }))
  })

  it('mantiene la resolución sin red en modo manual', async () => {
    const resolveRate = vi.fn().mockResolvedValue({ rate: 1.15, source: 'offline' })
    const quotes = await loadCurrencyQuotes({
      allowNetwork: false,
      baseCurrency: 'EUR',
      date: '2026-08-21',
      targetCurrencies: ['USD'],
    }, {
      getLatestRate: vi.fn().mockResolvedValue(undefined),
      resolveRate,
    })

    expect(resolveRate).toHaveBeenCalledWith('EUR', 'USD', {
      date: '2026-08-21',
      useApi: false,
    })
    expect(quotes[0]).toEqual(expect.objectContaining({ source: 'cache' }))
  })

  it('conserva la fecha real de una tasa manual guardada', async () => {
    const quotes = await loadCurrencyQuotes({
      allowNetwork: false,
      baseCurrency: 'EUR',
      date: '2026-08-21',
      targetCurrencies: ['USD'],
    }, {
      getLatestRate: vi.fn().mockResolvedValue({
        baseCurrency: 'EUR',
        createdAt: '2026-08-18T08:00:00.000Z',
        date: '2026-08-18',
        rate: 1.14,
        source: 'manual',
        targetCurrency: 'USD',
      }),
      resolveRate: vi.fn().mockResolvedValue({ rate: 1.14, source: 'offline' }),
    })

    expect(quotes[0]).toEqual(expect.objectContaining({
      date: '2026-08-18',
      source: 'manual',
      updatedAt: '2026-08-18T08:00:00.000Z',
    }))
  })

  it('marca un par sin respaldo como no disponible sin inventar una tasa', async () => {
    const quotes = await loadCurrencyQuotes({
      allowNetwork: false,
      baseCurrency: 'BGN',
      date: '2026-08-21',
      targetCurrencies: ['MXN', 'EUR'],
    }, {
      getLatestRate: vi.fn().mockResolvedValue(undefined),
      resolveRate: vi.fn()
        .mockRejectedValueOnce(new Error('No exchange rate available'))
        .mockResolvedValueOnce({ rate: 0.5113, source: 'reference' }),
    })

    expect(quotes).toEqual([
      expect.objectContaining({ rate: null, source: 'unavailable', targetCurrency: 'MXN' }),
      expect.objectContaining({ rate: 0.5113, source: 'reference', targetCurrency: 'EUR' }),
    ])
  })
})