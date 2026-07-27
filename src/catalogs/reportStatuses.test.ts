import { describe, expect, it } from 'vitest'

import {
  assertRecordIsNotReported,
  assertReportedRecordUpdateIsAllowed,
  getReportStatusLabel,
  isPendingReport,
  isReported,
  isUnreviewed,
  markAsPending,
  markAsReported,
  normalizeReportStatus,
  REPORTED_RECORD_IMMUTABLE_MESSAGE,
} from './reportStatuses'

describe('normalizeReportStatus', () => {
  it('defaults a record without reportStatusCode to pending', () => {
    const normalized = normalizeReportStatus({})

    expect(normalized.reportStatusCode).toBe('pending')
    expect(normalized.reportStatusLabel).toBe('Pendiente')
  })

  it('preserves an explicit unreviewed status', () => {
    const normalized = normalizeReportStatus({ reportStatusCode: 'unreviewed' })

    expect(normalized.reportStatusCode).toBe('unreviewed')
    expect(normalized.reportStatusLabel).toBe('Sin revisar')
  })

  it('clears reportedAt/reference/notes for anything other than reported', () => {
    const normalized = normalizeReportStatus({
      reportStatusCode: 'pending',
      reportedAt: '2026-01-01T00:00:00.000Z',
      reportReference: 'REF-1',
      reportNotes: 'nota',
    })

    expect(normalized.reportedAt).toBeUndefined()
    expect(normalized.reportReference).toBeUndefined()
    expect(normalized.reportNotes).toBeUndefined()
  })

  it('keeps reportedAt/reference/notes when reported', () => {
    const normalized = normalizeReportStatus({
      reportStatusCode: 'reported',
      reportedAt: '2026-01-01T00:00:00.000Z',
      reportReference: 'REF-1',
      reportNotes: 'nota',
    })

    expect(normalized.reportedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(normalized.reportReference).toBe('REF-1')
    expect(normalized.reportNotes).toBe('nota')
  })

  it('falls back an invalid code to pending', () => {
    const normalized = normalizeReportStatus({ reportStatusCode: 'bogus' as never })

    expect(normalized.reportStatusCode).toBe('pending')
  })
})

describe('getReportStatusLabel', () => {
  it('maps every status code to its Spanish label', () => {
    expect(getReportStatusLabel('unreviewed')).toBe('Sin revisar')
    expect(getReportStatusLabel('pending')).toBe('Pendiente')
    expect(getReportStatusLabel('reported')).toBe('Reportado')
    expect(getReportStatusLabel(undefined)).toBe('Pendiente')
  })
})

describe('isReported / isUnreviewed / isPendingReport', () => {
  it('classifies each of the three states correctly', () => {
    const reported = { reportStatusCode: 'reported' as const }
    const pending = { reportStatusCode: 'pending' as const }
    const unreviewed = { reportStatusCode: 'unreviewed' as const }

    expect(isReported(reported)).toBe(true)
    expect(isReported(pending)).toBe(false)
    expect(isReported(unreviewed)).toBe(false)

    expect(isUnreviewed(unreviewed)).toBe(true)
    expect(isUnreviewed(pending)).toBe(false)

    expect(isPendingReport(reported)).toBe(false)
    expect(isPendingReport(pending)).toBe(true)
    expect(isPendingReport(unreviewed)).toBe(true)
  })
})

describe('markAsReported', () => {
  it('marks a record as reported with the current timestamp by default', () => {
    const before = Date.now()
    const result = markAsReported({ reportStatusCode: 'pending' as const })
    const after = Date.now()

    expect(result.reportStatusCode).toBe('reported')
    expect(result.reportStatusLabel).toBe('Reportado')
    expect(result.reportedAt).toBeDefined()
    const reportedAtMs = new Date(result.reportedAt as string).getTime()
    expect(reportedAtMs).toBeGreaterThanOrEqual(before)
    expect(reportedAtMs).toBeLessThanOrEqual(after)
    expect(result.reportReference).toBeUndefined()
    expect(result.reportNotes).toBeUndefined()
  })

  it('honors an explicit reportedAt, reportReference and reportNotes', () => {
    const result = markAsReported(
      { reportStatusCode: 'unreviewed' as const },
      {
        reportedAt: '2026-03-01T10:00:00.000Z',
        reportReference: 'REF-2026-03',
        reportNotes: 'Declarado en marzo',
      },
    )

    expect(result.reportStatusCode).toBe('reported')
    expect(result.reportedAt).toBe('2026-03-01T10:00:00.000Z')
    expect(result.reportReference).toBe('REF-2026-03')
    expect(result.reportNotes).toBe('Declarado en marzo')
  })
})

describe('markAsPending', () => {
  it('returns a reported record to pending and clears report metadata', () => {
    const result = markAsPending({
      reportStatusCode: 'reported' as const,
      reportedAt: '2026-03-01T10:00:00.000Z',
      reportReference: 'REF-1',
      reportNotes: 'nota',
    })

    expect(result.reportStatusCode).toBe('pending')
    expect(result.reportStatusLabel).toBe('Pendiente')
    expect(result.reportedAt).toBeUndefined()
    expect(result.reportReference).toBeUndefined()
    expect(result.reportNotes).toBeUndefined()
  })
})

describe('assertRecordIsNotReported', () => {
  it('throws for a reported record', () => {
    expect(() =>
      assertRecordIsNotReported({ reportStatusCode: 'reported' }),
    ).toThrow(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  })

  it('does not throw for pending or unreviewed records', () => {
    expect(() => assertRecordIsNotReported({ reportStatusCode: 'pending' })).not.toThrow()
    expect(() => assertRecordIsNotReported({ reportStatusCode: 'unreviewed' })).not.toThrow()
    expect(() => assertRecordIsNotReported(undefined)).not.toThrow()
  })
})

describe('assertReportedRecordUpdateIsAllowed', () => {
  const reportedRecord = { reportStatusCode: 'reported' as const, reportedAt: '2026-01-01T00:00:00.000Z' }

  it('allows updates on a non-reported record regardless of the fields touched', () => {
    expect(() =>
      assertReportedRecordUpdateIsAllowed({ reportStatusCode: 'pending' }, { totalAmount: 500 }),
    ).not.toThrow()
  })

  it('blocks business-field updates on a reported record', () => {
    expect(() =>
      assertReportedRecordUpdateIsAllowed(reportedRecord, { totalAmount: 500 }),
    ).toThrow(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  })

  it('blocks editing report metadata (reference/notes) while staying reported', () => {
    expect(() =>
      assertReportedRecordUpdateIsAllowed(reportedRecord, {
        reportReference: 'REF-2',
        reportNotes: 'nota actualizada',
      }),
    ).toThrow(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  })

  it('allows reverting a reported record back to pending, clearing reference and notes', () => {
    expect(() =>
      assertReportedRecordUpdateIsAllowed(reportedRecord, {
        reportStatusCode: 'pending',
        reportStatusLabel: 'Pendiente',
        reportedAt: undefined,
        reportReference: undefined,
        reportNotes: undefined,
      }),
    ).not.toThrow()
  })

  it('blocks a partial revert that leaves reportReference or reportNotes set', () => {
    expect(() =>
      assertReportedRecordUpdateIsAllowed(reportedRecord, {
        reportStatusCode: 'pending',
        reportStatusLabel: 'Pendiente',
        reportedAt: undefined,
        reportReference: 'REF-still-there',
      }),
    ).toThrow(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  })

  it('blocks a mixed update that touches both metadata and business fields', () => {
    expect(() =>
      assertReportedRecordUpdateIsAllowed(reportedRecord, {
        reportReference: 'REF-2',
        totalAmount: 500,
      }),
    ).toThrow(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  })
})

