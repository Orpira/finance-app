import { describe, expect, it } from 'vitest'

import type { ServiceIncome } from '../types/service'
import {
  buildIncomeCsv,
  buildIncomeExportRows,
  buildIncomeSpreadsheetXml,
} from './incomeExportService'

function income(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    id: 1,
    date: '2026-01-05',
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
    baseCurrency: 'EUR',
    baseCurrencyValue: 50,
    createdAt: '2026-01-05T10:00:00.000Z',
    ...overrides,
  }
}

describe('buildIncomeExportRows', () => {
  it('maps a reported income including reference, notes and reported date', () => {
    const rows = buildIncomeExportRows(
      [
        income({
          reportStatusCode: 'reported',
          reportedAt: '2026-01-10T09:00:00.000Z',
          reportReference: 'REF-1',
          reportNotes: 'nota de prueba',
        }),
      ],
      'EUR',
      'professional',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('Reportado')
    expect(rows[0].reportReference).toBe('REF-1')
    expect(rows[0].reportNotes).toBe('nota de prueba')
    expect(rows[0].serviceDate).toBe('2026-01-05')
    expect(rows[0].reportedAt).not.toBe('')
    expect(rows[0].amount).toBe(50)
    expect(rows[0].currency).toBe('EUR')
  })

  it('marks records that are not eligible for reporting as "No aplica"', () => {
    const rows = buildIncomeExportRows([income({ type: 'ajuste' })], 'EUR', 'professional')

    expect(rows[0].status).toBe('No aplica')
    expect(rows[0].reportReference).toBe('')
    expect(rows[0].reportedAt).toBe('')
  })
})

describe('buildIncomeCsv', () => {
  it('includes a header row and escapes values containing commas or quotes', () => {
    const rows = buildIncomeExportRows(
      [income({ reportNotes: 'nota, con "comillas"' , reportStatusCode: 'reported', reportedAt: '2026-01-10T09:00:00.000Z' })],
      'EUR',
      'professional',
    )
    const csv = buildIncomeCsv(rows)

    expect(csv).toContain('Fecha de ingreso')
    expect(csv).toContain('Referencia')
    expect(csv).toContain('"nota, con ""comillas"""')
  })
})

describe('buildIncomeSpreadsheetXml', () => {
  it('produces a valid SpreadsheetML document with one row per income', () => {
    const rows = buildIncomeExportRows([income(), income({ id: 2, date: '2026-01-06' })], 'EUR', 'professional')
    const xml = buildIncomeSpreadsheetXml(rows)

    expect(xml).toContain('<?xml version="1.0"?>')
    expect(xml).toContain('urn:schemas-microsoft-com:office:spreadsheet')
    expect(xml.match(/<Row>/g)?.length).toBe(rows.length + 1)
  })
})
