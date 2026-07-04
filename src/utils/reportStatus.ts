import type { Expense } from '../types/expense'
import type { Appointment } from '../types/appointment'
import type { ServiceIncome } from '../types/service'
import type { UsageMode } from '../types/settings'
import {
  getReportStatusLabel,
  isReported,
  markAsPending,
  markAsReported,
  normalizeReportStatus,
  type ReportStatusFields,
} from '../catalogs/reportStatuses'
import { isServiceIncome } from './incomeTypes'
import { recordBelongsToUsageMode } from './usageMode'

export type ReportableRecord = (ServiceIncome | Expense | Appointment) & ReportStatusFields
export type RecordTypeCode = 'income' | 'expense' | 'appointment'
export type IncomeTypeCode = 'service' | 'adjustment' | 'other'
export type ExpenseTypeCode = 'expense' | 'adjustment'

export const REPORT_STATUS_NOT_ALLOWED_MESSAGE =
  'Este tipo de registro no se puede marcar como reportado en el modo de uso activo.'

export function getRecordTypeCode(record: ReportableRecord): RecordTypeCode {
  if ('dateTime' in record) return 'appointment'
  if ('totalAmount' in record) return 'income'
  return 'expense'
}

export function getIncomeTypeCode(record: ServiceIncome): IncomeTypeCode {
  if (isServiceIncome(record)) return 'service'
  return record.type === 'ajuste' ? 'adjustment' : 'other'
}

export function getExpenseTypeCode(record: Expense): ExpenseTypeCode {
  return record.type === 'ajuste' ? 'adjustment' : 'expense'
}

export function isExpenseRecord(record: ReportableRecord): record is Expense {
  return getRecordTypeCode(record) === 'expense'
}

export function canMarkAsReported(record: ReportableRecord, usageMode: UsageMode) {
  if (!recordBelongsToUsageMode(record, usageMode)) return false

  if (usageMode === 'professional') {
    return (
      getRecordTypeCode(record) === 'income' &&
      getIncomeTypeCode(record as ServiceIncome) === 'service'
    )
  }

  return isExpenseRecord(record) && getExpenseTypeCode(record) === 'expense'
}

export function assertCanMarkAsReported(
  record: ReportableRecord,
  usageMode: UsageMode,
) {
  if (!canMarkAsReported(record, usageMode)) {
    throw new Error(REPORT_STATUS_NOT_ALLOWED_MESSAGE)
  }
}

export function hasReportStatusUpdates(updates: object) {
  return ['reportStatusCode', 'reportStatusLabel', 'reportedAt'].some((field) =>
    Object.prototype.hasOwnProperty.call(updates, field),
  )
}

export function assertReportStatusUpdateIsAllowed(
  record: ReportableRecord,
  usageMode: UsageMode,
  updates: object,
) {
  if (hasReportStatusUpdates(updates)) {
    assertCanMarkAsReported(record, usageMode)
  }
}

export function getReportedCountByUsageMode(
  records: ReportableRecord[],
  usageMode: UsageMode,
) {
  return records.filter(
    (record) => canMarkAsReported(record, usageMode) && isReported(record),
  ).length
}

export function toggleReportStatus(record: ReportableRecord, usageMode: UsageMode) {
  assertCanMarkAsReported(record, usageMode)
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
