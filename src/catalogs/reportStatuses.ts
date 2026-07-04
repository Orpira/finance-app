export type ReportStatusCode = 'pending' | 'reported'
export type ReportStatusLabel = 'Pendiente' | 'Reportado'

export interface ReportStatusFields {
  reportStatusCode?: ReportStatusCode
  reportStatusLabel?: ReportStatusLabel
  reportedAt?: string
}

export const REPORTED_RECORD_IMMUTABLE_MESSAGE =
  'Este registro ya fue reportado y no se puede modificar ni eliminar.'

export const REPORT_STATUSES = [
  {
    code: 'pending' as const,
    label: 'Pendiente' as const,
  },
  {
    code: 'reported' as const,
    label: 'Reportado' as const,
  },
] as const

export function normalizeReportStatus<T extends Partial<ReportStatusFields>>(record: T) {
  const reportStatusCode = record.reportStatusCode === 'reported' ? 'reported' : 'pending'
  const reportStatusLabel = reportStatusCode === 'reported' ? 'Reportado' : 'Pendiente'

  return {
    ...record,
    reportStatusCode,
    reportStatusLabel,
    reportedAt: reportStatusCode === 'reported' ? record.reportedAt : undefined,
  } as T & ReportStatusFields
}

export function getReportStatusLabel(code?: ReportStatusCode | null) {
  return code === 'reported' ? 'Reportado' : 'Pendiente'
}

export function isReported(record: Partial<ReportStatusFields>) {
  return normalizeReportStatus(record).reportStatusCode === 'reported'
}

export function assertRecordIsNotReported(record?: Partial<ReportStatusFields>) {
  if (record && isReported(record)) {
    throw new Error(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  }
}

export function assertReportedRecordUpdateIsAllowed(
  record: Partial<ReportStatusFields> | undefined,
  updates: object,
) {
  if (!record || !isReported(record)) {
    return
  }

  const reportStatusFields = new Set([
    'reportStatusCode',
    'reportStatusLabel',
    'reportedAt',
  ])
  const onlyUpdatesReportStatus = Object.keys(updates).every((field) =>
    reportStatusFields.has(field),
  )
  const reportStatusUpdates = updates as Partial<ReportStatusFields>
  const removesReportedMark =
    reportStatusUpdates.reportStatusCode === 'pending' &&
    reportStatusUpdates.reportStatusLabel === 'Pendiente' &&
    reportStatusUpdates.reportedAt === undefined

  if (!onlyUpdatesReportStatus || !removesReportedMark) {
    throw new Error(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  }
}

export function markAsReported<T extends Partial<ReportStatusFields>>(record: T) {
  return {
    ...normalizeReportStatus(record),
    reportStatusCode: 'reported' as const,
    reportStatusLabel: 'Reportado' as const,
    reportedAt: new Date().toISOString(),
  } as T & ReportStatusFields
}

export function markAsPending<T extends Partial<ReportStatusFields>>(record: T) {
  return {
    ...normalizeReportStatus(record),
    reportStatusCode: 'pending' as const,
    reportStatusLabel: 'Pendiente' as const,
    reportedAt: undefined,
  } as T & ReportStatusFields
}
