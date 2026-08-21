import { describe, expect, it } from 'vitest'

import type { ServiceIncome } from '../types/service'
import {
  buildIncomeDateTableHtml,
  buildIncomeDateText,
} from './incomeReportPresentation'

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    createdAt: '2026-08-09T10:30:00.000Z',
    date: '2026-08-09',
    duration: 60,
    totalAmount: 100,
    currency: 'EUR',
    percentage: 50,
    realGain: 50,
    eurValue: 50,
    copValue: 215000,
    exchangeRateUsed: 4300,
    type: 'ingreso',
    usageMode: 'professional',
    paymentType: 'cash',
    country: 'ES',
    city: 'Madrid',
    baseCurrency: 'EUR',
    baseCurrencyValue: 50,
    reportStatusCode: 'reported',
    reportedAt: '2026-08-10T09:00:00.000Z',
    reportReference: 'REF-001',
    reportNotes: 'Nota individual extensa',
    ...overrides,
  }
}

describe('income report presentation', () => {
  it('renders basic records independently and omits professional-only duration', () => {
    const records = [
      income({ id: 1, usageMode: 'basic', baseCurrencyValue: 25 }),
      income({ id: 2, usageMode: 'basic', type: 'ajuste', baseCurrencyValue: 10 }),
    ]
    const html = buildIncomeDateTableHtml({
      incomes: records,
      primaryCurrency: 'EUR',
      usageMode: 'basic',
      dateTotal: 35,
    })
    const text = buildIncomeDateText({
      incomes: records,
      primaryCurrency: 'EUR',
      usageMode: 'basic',
      dateTotal: 35,
      totalLabel: 'Subtotal fecha',
    })

    expect(html.match(/data-income-id=/g)).toHaveLength(2)
    expect(html).toContain('Servicio #1')
    expect(html).toContain('Ajuste #2')
    expect(html).not.toContain('<th>Duración</th>')
    expect(html).toContain('35,00 €')
    expect(text).not.toContain('Total duración')
    expect(text).toContain('Subtotal fecha: 35,00 €')
  })

  it('uses the same normalized professional duration in HTML and text', () => {
    const records = [
      income({ id: 1, duration: 45 }),
      income({
        id: 2,
        duration: 0,
        incomeCalculationMethod: 'hourly_workday',
        workedTime: 2,
        workedTimeUnit: 'hours',
      }),
    ]
    const options = {
      incomes: records,
      primaryCurrency: 'EUR' as const,
      usageMode: 'professional' as const,
      dateTotal: 100,
      totalDurationMinutes: 165,
    }

    const html = buildIncomeDateTableHtml(options)
    const text = buildIncomeDateText(options)

    expect(html).toContain('2 horas')
    expect(html).toContain('Subtotal fecha · 2 h 45 min')
    expect(text).toContain('Duración: 2 horas')
    expect(text).toContain('Total duración: 2 h 45 min')
    expect(text).not.toContain('0 min')
  })

  it('preserves mixed record identity, type, geography, currencies and metadata', () => {
    const records = [
      income({ id: 1 }),
      income({
        id: 2,
        type: 'ajuste',
        totalAmount: 20000,
        currency: 'COP',
        baseCurrencyValue: 5,
        paymentType: undefined,
        country: 'CO',
        city: 'Bogotá',
      }),
      income({ id: 3, type: 'otro', reportReference: 'HIST-003' }),
    ]
    const adjustmentCounts = new Map([[1, 1]])
    const options = {
      incomes: records,
      primaryCurrency: 'EUR' as const,
      usageMode: 'professional' as const,
      adjustmentCounts,
      dateTotal: 105,
      totalDurationMinutes: 60,
    }

    const html = buildIncomeDateTableHtml(options)
    const text = buildIncomeDateText(options)

    for (const id of [1, 2, 3]) {
      expect(html).toContain(`data-income-id="${id}"`)
    }
    expect(html).toContain('Ajuste')
    expect(html).toContain('Otro ingreso histórico')
    expect(html).toContain('Colombia')
    expect(html).toContain('Bogotá')
    expect(html).toContain('20.000 COP')
    expect(html).toContain('Nota individual extensa')
    expect(html).toContain('Referencia: REF-001')
    expect(html).toContain('Afectado por ajuste (1)')
    expect(text).toContain('Importe original: 20.000 COP')
    expect(text).toContain('Importe convertido: 5,00 €')
    expect(text).toContain('Notas: Nota individual extensa')
  })
})
