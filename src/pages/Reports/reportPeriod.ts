export type ReportPeriod = 'week' | 'month' | 'year'

export interface ReportPeriodRange {
  readonly from: string
  readonly to: string
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
    ? date
    : null
}

function shiftDays(date: Date, amount: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + amount)
  return shifted
}

export function getReportPeriodRange(
  period: ReportPeriod,
  anchor = new Date(),
): ReportPeriodRange {
  if (period === 'week') {
    const mondayOffset = anchor.getDay() === 0 ? -6 : 1 - anchor.getDay()
    const monday = shiftDays(anchor, mondayOffset)
    return {
      from: formatLocalDate(monday),
      to: formatLocalDate(shiftDays(monday, 6)),
    }
  }

  if (period === 'year') {
    return {
      from: `${anchor.getFullYear()}-01-01`,
      to: `${anchor.getFullYear()}-12-31`,
    }
  }

  return {
    from: formatLocalDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    to: formatLocalDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  }
}

export function shiftReportPeriod(
  period: ReportPeriod,
  currentFrom: string,
  direction: -1 | 1,
): ReportPeriodRange {
  const current = parseLocalDate(currentFrom) ?? new Date()
  const anchor = period === 'week'
    ? shiftDays(current, direction * 7)
    : period === 'year'
      ? new Date(current.getFullYear() + direction, 0, 1)
      : new Date(current.getFullYear(), current.getMonth() + direction, 1)

  return getReportPeriodRange(period, anchor)
}

function formatNumericDate(value: string): string {
  const date = parseLocalDate(value)
  if (!date) return value
  return [
    String(date.getDate()).padStart(2, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    date.getFullYear(),
  ].join('/')
}

export function getReportPeriodLabel(
  period: ReportPeriod,
  range: ReportPeriodRange,
): string {
  const from = parseLocalDate(range.from)
  const to = parseLocalDate(range.to)
  if (!from || !to) return `${range.from} - ${range.to}`

  const canonicalRange = getReportPeriodRange(period, from)
  if (range.from !== canonicalRange.from || range.to !== canonicalRange.to) {
    return `${formatNumericDate(range.from)} - ${formatNumericDate(range.to)}`
  }

  if (period === 'year') return String(from.getFullYear())
  if (period === 'week') {
    return `${formatNumericDate(range.from)} - ${formatNumericDate(range.to)}`
  }

  const month = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(from)
  return `${month.charAt(0).toLocaleUpperCase('es')}${month.slice(1)} ${from.getFullYear()}`
}