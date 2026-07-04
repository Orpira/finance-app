import type { Expense } from '../types/expense'
import type { Appointment } from '../types/appointment'
import type { ServiceIncome } from '../types/service'
import {
  getReportStatusLabel,
  isReported,
  markAsPending,
  markAsReported,
  normalizeReportStatus,
  type ReportStatusFields,
} from '../catalogs/reportStatuses'

export type ReportableRecord = (ServiceIncome | Expense | Appointment) & ReportStatusFields

export function toggleReportStatus(record: ReportableRecord) {
  return isReported(record) ? markAsPending(record) : markAsReported(record)
}

export function formatReportStatusMeta(record: Partial<ReportStatusFields>) {
  const normalized = normalizeReportStatus(record)

  if (!normalized.reportedAt) {
    return null
  }

  const date = new Date(normalized.reportedAt)

  if (Number.isNaN(date.getTime())) {
    return null
  }

  return `Reportado el ${date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`
}

export function getRecordReportBadge(record: Partial<ReportStatusFields>) {
  const normalized = normalizeReportStatus(record)

  return {
    isReported: normalized.reportStatusCode === 'reported',
    label: getReportStatusLabel(normalized.reportStatusCode),
    reportStatusCode: normalized.reportStatusCode,
    reportStatusLabel: normalized.reportStatusLabel,
    reportedAt: normalized.reportedAt,
  }
}
