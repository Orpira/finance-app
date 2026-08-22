import { describe, expect, it } from 'vitest'

import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import {
  assertCanMarkAsReported,
  assertReportStatusUpdateIsAllowed,
  canMarkAsReported,
  formatReportStatusMeta,
  getRecordReportBadge,
  getReportedCountByUsageMode,
  hasReportStatusUpdates,
  REPORT_STATUS_NOT_ALLOWED_MESSAGE,
  toggleReportStatus,
} from './reportStatus'

function serviceIncome(overrides: Partial<ServiceIncome> = {}): ServiceIncome {
  return {
    date: '2026-01-01',
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
    ...overrides,
  }
}

function expenseRecord(overrides: Partial<Expense> = {}): Expense {
  return {
    type: 'gasto',
    date: '2026-01-01',
    category: 'General',
    amount: 20,
    currency: 'EUR',
    eurValue: 20,
    copValue: 86000,
    createdAt: '2026-01-01T00:00:00.000Z',
    usageMode: 'basic',
    ...overrides,
  }
}

describe('hasReportStatusUpdates', () => {
  it('detects reportStatusCode, reportedAt, reportReference and reportNotes as report-status updates', () => {
    expect(hasReportStatusUpdates({ reportStatusCode: 'reported' })).toBe(true)
    expect(hasReportStatusUpdates({ reportedAt: '2026-01-01' })).toBe(true)
    expect(hasReportStatusUpdates({ reportReference: 'REF-1' })).toBe(true)
    expect(hasReportStatusUpdates({ reportNotes: 'nota' })).toBe(true)
    expect(hasReportStatusUpdates({ totalAmount: 10 })).toBe(false)
  })
})

describe('canMarkAsReported', () => {
  it('allows a professional-mode service income', () => {
    expect(canMarkAsReported(serviceIncome(), 'professional')).toBe(true)
  })

  it('rejects a professional hourly workday income', () => {
    expect(
      canMarkAsReported(
        serviceIncome({ incomeCalculationMethod: 'hourly_workday' }),
        'professional',
      ),
    ).toBe(false)
  })

  it('rejects an adjustment or other-income record in professional mode', () => {
    expect(canMarkAsReported(serviceIncome({ type: 'ajuste' }), 'professional')).toBe(false)
    expect(canMarkAsReported(serviceIncome({ type: 'otro' }), 'professional')).toBe(false)
  })

  it('rejects a service income when the current usage mode is basic', () => {
    expect(canMarkAsReported(serviceIncome({ usageMode: 'basic' }), 'basic')).toBe(false)
  })

  it('allows a basic-mode expense but rejects an expense adjustment', () => {
    expect(canMarkAsReported(expenseRecord(), 'basic')).toBe(true)
    expect(canMarkAsReported(expenseRecord({ type: 'ajuste' }), 'basic')).toBe(false)
  })
})

describe('assertCanMarkAsReported', () => {
  it('throws the expected message when the record cannot be marked as reported', () => {
    expect(() => assertCanMarkAsReported(serviceIncome({ type: 'ajuste' }), 'professional')).toThrow(
      REPORT_STATUS_NOT_ALLOWED_MESSAGE,
    )
  })
})

describe('assertReportStatusUpdateIsAllowed', () => {
  it('does not throw when the update does not touch report-status fields', () => {
    expect(() =>
      assertReportStatusUpdateIsAllowed(serviceIncome({ type: 'ajuste' }), 'professional', {
        totalAmount: 10,
      }),
    ).not.toThrow()
  })

  it('throws when a disallowed record type tries to update reportReference/reportNotes', () => {
    expect(() =>
      assertReportStatusUpdateIsAllowed(serviceIncome({ type: 'ajuste' }), 'professional', {
        reportReference: 'REF-1',
      }),
    ).toThrow(REPORT_STATUS_NOT_ALLOWED_MESSAGE)
  })
})

describe('getReportedCountByUsageMode', () => {
  it('counts only reported records that belong to the active usage mode', () => {
    const records = [
      serviceIncome({ reportStatusCode: 'reported' }),
      serviceIncome({ reportStatusCode: 'unreviewed' }),
      serviceIncome({ type: 'ajuste', reportStatusCode: 'reported' }),
    ]

    expect(getReportedCountByUsageMode(records, 'professional')).toBe(1)
  })
})

describe('toggleReportStatus', () => {
  it('flips a pending record to reported and back to pending', () => {
    const pending = serviceIncome({ reportStatusCode: 'pending' })
    const reported = toggleReportStatus(pending, 'professional')

    expect(reported.reportStatusCode).toBe('reported')

    const backToPending = toggleReportStatus(reported, 'professional')

    expect(backToPending.reportStatusCode).toBe('pending')
  })

  it('throws for a record that is not eligible for reporting', () => {
    expect(() => toggleReportStatus(serviceIncome({ type: 'otro' }), 'professional')).toThrow(
      REPORT_STATUS_NOT_ALLOWED_MESSAGE,
    )
  })
})

describe('formatReportStatusMeta', () => {
  it('returns null when there is no reportedAt', () => {
    expect(formatReportStatusMeta({ reportStatusCode: 'pending' })).toBeNull()
  })

  it('formats a valid reportedAt into a readable Spanish string', () => {
    const meta = formatReportStatusMeta({
      reportStatusCode: 'reported',
      reportedAt: '2026-03-01T10:00:00.000Z',
    })

    expect(meta).toMatch(/^Reportado el /)
  })
})

describe('getRecordReportBadge', () => {
  it('exposes normalized flags and metadata for the UI', () => {
    const badge = getRecordReportBadge({
      reportStatusCode: 'reported',
      reportedAt: '2026-03-01T10:00:00.000Z',
      reportReference: 'REF-1',
      reportNotes: 'nota',
    })

    expect(badge.isReported).toBe(true)
    expect(badge.isUnreviewed).toBe(false)
    expect(badge.label).toBe('Reportado')
    expect(badge.reportReference).toBe('REF-1')
    expect(badge.reportNotes).toBe('nota')
  })

  it('flags unreviewed records distinctly from pending ones', () => {
    expect(getRecordReportBadge({ reportStatusCode: 'unreviewed' }).isUnreviewed).toBe(true)
    expect(getRecordReportBadge({ reportStatusCode: 'pending' }).isUnreviewed).toBe(false)
  })
})
