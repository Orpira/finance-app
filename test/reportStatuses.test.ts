import { describe, expect, it } from 'vitest'

import {
  assertRecordIsNotReported,
  assertReportedRecordUpdateIsAllowed,
  getReportStatusLabel,
  isReported,
  markAsPending,
  markAsReported,
  normalizeReportStatus,
} from '../src/catalogs/reportStatuses'

describe('report status helpers', () => {
  it('defaults missing values to pending', () => {
    expect(normalizeReportStatus({})).toEqual({
      reportStatusCode: 'pending',
      reportStatusLabel: 'Pendiente',
      reportedAt: undefined,
    })
  })

  it('marks records as reported and stores the timestamp', () => {
    const updated = markAsReported({ id: 7 })

    expect(updated.reportStatusCode).toBe('reported')
    expect(updated.reportStatusLabel).toBe('Reportado')
    expect(updated.reportedAt).toBeTruthy()
    expect(isReported(updated)).toBe(true)
  })

  it('reverts records to pending and clears the timestamp', () => {
    const updated = markAsPending(markAsReported({ id: 7 }))

    expect(updated.reportStatusCode).toBe('pending')
    expect(updated.reportStatusLabel).toBe('Pendiente')
    expect(updated.reportedAt).toBeUndefined()
    expect(isReported(updated)).toBe(false)
  })

  it('returns the correct label for known codes', () => {
    expect(getReportStatusLabel('pending')).toBe('Pendiente')
    expect(getReportStatusLabel('reported')).toBe('Reportado')
    expect(getReportStatusLabel(undefined)).toBe('Pendiente')
  })

  it('rejects mutations for reported records', () => {
    expect(() => assertRecordIsNotReported(markAsReported({ id: 7 }))).toThrow(
      'Este registro ya fue reportado y no se puede modificar ni eliminar.',
    )
    expect(() => assertRecordIsNotReported({ reportStatusCode: 'pending' })).not.toThrow()
  })

  it('allows only removing the reported mark from a reported record', () => {
    const reported = markAsReported({ id: 7 })

    expect(() =>
      assertReportedRecordUpdateIsAllowed(reported, {
        reportStatusCode: 'pending',
        reportStatusLabel: 'Pendiente',
        reportedAt: undefined,
      }),
    ).not.toThrow()
    expect(() =>
      assertReportedRecordUpdateIsAllowed(reported, {
        notes: 'Cambio no permitido',
      }),
    ).toThrow('Este registro ya fue reportado y no se puede modificar ni eliminar.')
  })
})
