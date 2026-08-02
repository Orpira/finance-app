import { describe, expect, it } from 'vitest'

import {
  filterConfigurableReportRecords,
  validateReportConfiguration,
  type ReportConfiguration,
} from '../src/services/reportConfiguration'

const baseConfiguration: ReportConfiguration = {
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  type: 'all',
  category: 'ALL',
  currency: 'EUR',
  status: 'ALL',
  format: 'pdf',
}

describe('configurable reports', () => {
  it('applies period, type, category, currency and report status without changing records', () => {
    const incomes = [
      { id: 1, date: '2026-08-03', currency: 'EUR', reportStatus: 'reported' },
      { id: 2, date: '2026-08-04', currency: 'USD', reportStatus: 'pending' },
    ]
    const expenses = [
      { id: 3, date: '2026-08-05', currency: 'EUR', category: 'Material' },
      { id: 4, date: '2026-07-31', currency: 'EUR', category: 'Material' },
    ]

    const result = filterConfigurableReportRecords({ incomes, expenses }, {
      ...baseConfiguration,
      type: 'expense',
      category: 'Material',
    })

    expect(result).toEqual({ incomes: [], expenses: [expenses[0]] })
    expect(expenses).toHaveLength(2)
  })

  it('fails closed for an inverted period or unsupported format', () => {
    expect(validateReportConfiguration({
      ...baseConfiguration,
      dateFrom: '2026-09-01',
      dateTo: '2026-08-01',
    })).toEqual({ valid: false, reason: 'INVALID_PERIOD' })
    expect(validateReportConfiguration({
      ...baseConfiguration,
      format: 'zip' as ReportConfiguration['format'],
    })).toEqual({ valid: false, reason: 'UNSUPPORTED_FORMAT' })
  })
})
