import { recordBelongsToUsageMode, type UsageModeRecord } from '../../utils/usageMode'
import type { UsageMode } from '../../types/settings'

export type MovementFilterType = 'all' | 'income' | 'expense'
export type MovementReportFilter = 'all' | 'reported' | 'unreported'
export type MovementOrder = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
export type MovementPeriod = 'all' | 'today' | 'week' | 'month' | 'custom'

export interface MovementFilters {
  readonly period: MovementPeriod
  readonly anchorDate: string
  readonly dateFrom: string
  readonly dateTo: string
  readonly type: MovementFilterType
  readonly category: string
  readonly currency: string
  readonly reported: MovementReportFilter
  readonly query: string
  readonly order: MovementOrder
}

export interface FilterableMovement {
  readonly key: string
  readonly kind: 'income' | 'expense'
  readonly date: string
  readonly category: string
  readonly amount: number
  readonly currency: string
  readonly reported?: boolean
  readonly searchText: string
}

const MOVEMENT_FILTER_PARAM_KEYS = [
  'period',
  'date',
  'from',
  'to',
  'type',
  'category',
  'currency',
  'reported',
  'q',
  'order',
] as const

const valid = <T extends string>(value: string | null, values: readonly T[], fallback: T): T =>
  value !== null && values.includes(value as T) ? value as T : fallback

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

function normalizePeriod(value: string | null): MovementPeriod {
  if (value === 'current_month' || value === 'previous_month') return 'month'
  if (value === 'current_week' || value === 'previous_week') return 'week'
  if (value === 'yesterday') return 'today'
  return valid(value, ['all', 'today', 'week', 'month', 'custom'], 'all')
}

function shiftDate(date: Date, days: number): Date {
  const shifted = new Date(date)
  shifted.setDate(shifted.getDate() + days)
  return shifted
}

function shiftMonth(date: Date, amount: number): Date {
  const day = date.getDate()
  const shifted = new Date(date.getFullYear(), date.getMonth() + amount, 1)
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, lastDay))
  return shifted
}

function getWeekRange(anchor: Date) {
  const mondayOffset = anchor.getDay() === 0 ? -6 : 1 - anchor.getDay()
  const from = shiftDate(anchor, mondayOffset)
  return { from: formatLocalDate(from), to: formatLocalDate(shiftDate(from, 6)) }
}

function getMovementPeriodRange(filters: MovementFilters): { from?: string; to?: string } {
  const anchor = parseLocalDate(filters.anchorDate)
  if (filters.period === 'all' || !anchor) return {}
  if (filters.period === 'custom') {
    return {
      from: parseLocalDate(filters.dateFrom) ? filters.dateFrom : undefined,
      to: parseLocalDate(filters.dateTo) ? filters.dateTo : undefined,
    }
  }
  if (filters.period === 'today') {
    return { from: filters.anchorDate, to: filters.anchorDate }
  }
  if (filters.period === 'week') return getWeekRange(anchor)

  return {
    from: formatLocalDate(new Date(anchor.getFullYear(), anchor.getMonth(), 1)),
    to: formatLocalDate(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0)),
  }
}

/**
 * "Movimientos → Todos" debe mostrar exactamente la unión de lo que ya
 * muestran las pestañas Ingresos y Egresos por separado, y ambas filtran por
 * `recordBelongsToUsageMode` (ver IncomeListPage/ExpenseListPage). Sin este
 * filtro, ingresos y gastos creados bajo un modo de uso distinto al actual
 * (p. ej. registros de Básico visibles estando en Profesional) aparecían
 * mezclados en Todos aunque nunca aparecen en Ingresos/Egresos.
 */
export function scopeRecordsByUsageMode<T extends UsageModeRecord>(
  records: readonly T[],
  usageMode: UsageMode,
): T[] {
  return records.filter((record) => recordBelongsToUsageMode(record, usageMode))
}

export function readMovementFilters(params: URLSearchParams, now = new Date()): MovementFilters {
  const rawType = params.get('type')
  const period = normalizePeriod(params.get('period'))
  const requestedAnchor = params.get('date') ?? ''
  let anchor = parseLocalDate(requestedAnchor) ?? new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  )

  if (!params.has('date')) {
    if (params.get('period') === 'previous_month') anchor = shiftMonth(anchor, -1)
    if (params.get('period') === 'previous_week') anchor = shiftDate(anchor, -7)
    if (params.get('period') === 'yesterday') anchor = shiftDate(anchor, -1)
  }

  return {
    period,
    anchorDate: formatLocalDate(anchor),
    dateFrom: parseLocalDate(params.get('from') ?? '') ? params.get('from') as string : '',
    dateTo: parseLocalDate(params.get('to') ?? '') ? params.get('to') as string : '',
    type: valid(rawType === 'gasto' ? 'expense' : rawType === 'ingreso' ? 'income' : rawType, ['all', 'income', 'expense'], 'all'),
    category: params.get('category') ?? '',
    currency: params.get('currency') ?? '',
    reported: valid(params.get('reported'), ['all', 'reported', 'unreported'], 'all'),
    query: params.get('q') ?? '',
    order: valid(params.get('order'), ['newest', 'oldest', 'amount_desc', 'amount_asc'], 'newest'),
  }
}

export function hasMovementFilterParams(params: URLSearchParams): boolean {
  return MOVEMENT_FILTER_PARAM_KEYS.some((key) => params.has(key))
}

export function writeMovementFilters(
  filters: MovementFilters,
  currentParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(currentParams)
  MOVEMENT_FILTER_PARAM_KEYS.forEach((key) => next.delete(key))

  if (filters.period !== 'all') {
    next.set('period', filters.period)
    if (filters.period === 'custom') {
      if (filters.dateFrom) next.set('from', filters.dateFrom)
      if (filters.dateTo) next.set('to', filters.dateTo)
    } else {
      next.set('date', filters.anchorDate)
    }
  }
  if (filters.type !== 'all') next.set('type', filters.type)
  if (filters.category) next.set('category', filters.category)
  if (filters.currency) next.set('currency', filters.currency)
  if (filters.reported !== 'all') next.set('reported', filters.reported)
  if (filters.query.trim()) next.set('q', filters.query.trim())
  if (filters.order !== 'newest') next.set('order', filters.order)

  return next
}

export function countActiveMovementFilters(filters: MovementFilters): number {
  return Number(filters.period !== 'all') +
    Number(filters.type !== 'all') +
    Number(filters.category !== '') +
    Number(filters.currency !== '') +
    Number(filters.reported !== 'all') +
    Number(filters.query.trim() !== '') +
    Number(filters.order !== 'newest')
}

export function hasActiveMovementFilters(filters: MovementFilters): boolean {
  return countActiveMovementFilters(filters) > 0
}

export function shiftMovementPeriod(
  filters: MovementFilters,
  direction: -1 | 1,
): MovementFilters {
  const anchor = parseLocalDate(filters.anchorDate)
  if (!anchor || filters.period === 'all' || filters.period === 'custom') return filters

  const shifted = filters.period === 'month'
    ? shiftMonth(anchor, direction)
    : shiftDate(anchor, direction * (filters.period === 'week' ? 7 : 1))

  return { ...filters, anchorDate: formatLocalDate(shifted) }
}

function formatLongDate(value: string): string {
  const date = parseLocalDate(value)
  return date
    ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(date)
    : value
}

function formatNumericDate(value: string): string {
  const date = parseLocalDate(value)
  return date
    ? new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    : value
}

export function getMovementPeriodLabel(filters: MovementFilters): string {
  if (filters.period === 'all') return 'Todos los movimientos'
  if (filters.period === 'custom') {
    if (filters.dateFrom && filters.dateTo) {
      return `${formatNumericDate(filters.dateFrom)} - ${formatNumericDate(filters.dateTo)}`
    }
    if (filters.dateFrom) return `Desde ${formatNumericDate(filters.dateFrom)}`
    if (filters.dateTo) return `Hasta ${formatNumericDate(filters.dateTo)}`
    return 'Período personalizado'
  }

  const anchor = parseLocalDate(filters.anchorDate)
  if (!anchor) return 'Período seleccionado'
  if (filters.period === 'week') {
    return `Semana del ${formatLongDate(getWeekRange(anchor).from)}`
  }
  if (filters.period === 'today') {
    const label = formatLongDate(filters.anchorDate)
    return `${label.charAt(0).toLocaleUpperCase('es')}${label.slice(1)}`
  }

  const month = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(anchor)
  return `${month.charAt(0).toLocaleUpperCase('es')}${month.slice(1)} ${anchor.getFullYear()}`
}

export function applyMovementFilters<T extends FilterableMovement>(
  movements: readonly T[],
  filters: MovementFilters,
): T[] {
  const periodRange = getMovementPeriodRange(filters)
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('es')
  return movements
    .filter((movement) => !periodRange.from || movement.date >= periodRange.from)
    .filter((movement) => !periodRange.to || movement.date <= periodRange.to)
    .filter((movement) => filters.type === 'all' || movement.kind === filters.type)
    .filter((movement) => !filters.category || movement.category === filters.category)
    .filter((movement) => !filters.currency || movement.currency === filters.currency)
    .filter((movement) => filters.reported === 'all' || (movement.kind === 'income' && movement.reported === (filters.reported === 'reported')))
    .filter((movement) => !normalizedQuery || movement.searchText.toLocaleLowerCase('es').includes(normalizedQuery))
    .sort((left, right) => {
      if (filters.order === 'amount_desc') return right.amount - left.amount
      if (filters.order === 'amount_asc') return left.amount - right.amount
      if (filters.order === 'oldest') return left.date.localeCompare(right.date)
      return right.date.localeCompare(left.date)
    })
}
