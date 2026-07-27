export type ReportStatusCode = 'unreviewed' | 'pending' | 'reported'
export type ReportStatusLabel = 'Sin revisar' | 'Pendiente' | 'Reportado'

export interface ReportStatusFields {
  reportStatusCode?: ReportStatusCode
  reportStatusLabel?: ReportStatusLabel
  reportedAt?: string
  reportReference?: string
  reportNotes?: string
}

export const REPORTED_RECORD_IMMUTABLE_MESSAGE =
  'Este registro ya fue reportado y no se puede modificar ni eliminar.'

export const REPORT_STATUSES = [
  {
    code: 'unreviewed' as const,
    label: 'Sin revisar' as const,
  },
  {
    code: 'pending' as const,
    label: 'Pendiente' as const,
  },
  {
    code: 'reported' as const,
    label: 'Reportado' as const,
  },
] as const

export function getReportStatusLabel(code?: ReportStatusCode | null): ReportStatusLabel {
  if (code === 'reported') return 'Reportado'
  if (code === 'unreviewed') return 'Sin revisar'
  return 'Pendiente'
}

export function normalizeReportStatus<T extends Partial<ReportStatusFields>>(record: T) {
  const reportStatusCode: ReportStatusCode =
    record.reportStatusCode === 'reported' || record.reportStatusCode === 'unreviewed'
      ? record.reportStatusCode
      : 'pending'
  const reportStatusLabel = getReportStatusLabel(reportStatusCode)
  const isReportedRecord = reportStatusCode === 'reported'

  return {
    ...record,
    reportStatusCode,
    reportStatusLabel,
    reportedAt: isReportedRecord ? record.reportedAt : undefined,
    reportReference: isReportedRecord ? record.reportReference : undefined,
    reportNotes: isReportedRecord ? record.reportNotes : undefined,
  } as T & ReportStatusFields
}

export function isReported(record: Partial<ReportStatusFields>) {
  return normalizeReportStatus(record).reportStatusCode === 'reported'
}

export function isUnreviewed(record: Partial<ReportStatusFields>) {
  return normalizeReportStatus(record).reportStatusCode === 'unreviewed'
}

/** Todo lo que aún no fue reportado, sin distinguir si ya fue revisado o no. */
export function isPendingReport(record: Partial<ReportStatusFields>) {
  return !isReported(record)
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
    'reportReference',
    'reportNotes',
  ])
  const onlyUpdatesReportStatus = Object.keys(updates).every((field) =>
    reportStatusFields.has(field),
  )
  const reportStatusUpdates = updates as Partial<ReportStatusFields>
  const removesReportedMark =
    reportStatusUpdates.reportStatusCode === 'pending' &&
    reportStatusUpdates.reportStatusLabel === 'Pendiente' &&
    reportStatusUpdates.reportedAt === undefined &&
    reportStatusUpdates.reportReference === undefined &&
    reportStatusUpdates.reportNotes === undefined

  if (!onlyUpdatesReportStatus || !removesReportedMark) {
    throw new Error(REPORTED_RECORD_IMMUTABLE_MESSAGE)
  }
}

export interface MarkAsReportedOptions {
  reportedAt?: string
  reportReference?: string
  reportNotes?: string
}

export function markAsReported<T extends Partial<ReportStatusFields>>(
  record: T,
  options: MarkAsReportedOptions = {},
) {
  return {
    ...record,
    reportStatusCode: 'reported' as const,
    reportStatusLabel: 'Reportado' as const,
    reportedAt: options.reportedAt ?? new Date().toISOString(),
    reportReference: options.reportReference || undefined,
    reportNotes: options.reportNotes || undefined,
  } as T & ReportStatusFields
}

export function markAsPending<T extends Partial<ReportStatusFields>>(record: T) {
  return {
    ...record,
    reportStatusCode: 'pending' as const,
    reportStatusLabel: 'Pendiente' as const,
    reportedAt: undefined,
    reportReference: undefined,
    reportNotes: undefined,
  } as T & ReportStatusFields
}
