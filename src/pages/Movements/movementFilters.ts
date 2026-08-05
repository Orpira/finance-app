import { recordBelongsToUsageMode, type UsageModeRecord } from '../../utils/usageMode'
import type { UsageMode } from '../../types/settings'

export type MovementFilterType = 'all' | 'income' | 'expense'
export type MovementReportFilter = 'all' | 'reported' | 'unreported'
export type MovementOrder = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc'

export interface MovementFilters {
  readonly period: 'all' | 'current_month'
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

const valid = <T extends string>(value: string | null, values: readonly T[], fallback: T): T =>
  value !== null && values.includes(value as T) ? value as T : fallback

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

export function readMovementFilters(params: URLSearchParams): MovementFilters {
  const rawType = params.get('type')
  return {
    period: valid(params.get('period'), ['all', 'current_month'], 'all'),
    type: valid(rawType === 'gasto' ? 'expense' : rawType === 'ingreso' ? 'income' : rawType, ['all', 'income', 'expense'], 'all'),
    category: params.get('category') ?? '',
    currency: params.get('currency') ?? '',
    reported: valid(params.get('reported'), ['all', 'reported', 'unreported'], 'all'),
    query: params.get('q') ?? '',
    order: valid(params.get('order'), ['newest', 'oldest', 'amount_desc', 'amount_asc'], 'newest'),
  }
}

export function hasActiveMovementFilters(filters: MovementFilters): boolean {
  return (
    filters.period !== 'all' ||
    filters.type !== 'all' ||
    filters.category !== '' ||
    filters.currency !== '' ||
    filters.reported !== 'all' ||
    filters.query.trim() !== '' ||
    filters.order !== 'newest'
  )
}

export function applyMovementFilters<T extends FilterableMovement>(
  movements: readonly T[],
  filters: MovementFilters,
  now = new Date(),
): T[] {
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const normalizedQuery = filters.query.trim().toLocaleLowerCase('es')
  return movements
    .filter((movement) => filters.period === 'all' || movement.date >= monthStart)
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
