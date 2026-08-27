import { describe, expect, it } from 'vitest'

import {
  applyMovementFilters,
  countActiveMovementFilters,
  getMovementPeriodLabel,
  hasActiveMovementFilters,
  hasMovementFilterParams,
  readMovementFilters,
  shiftMovementPeriod,
  scopeRecordsByUsageMode,
  writeMovementFilters,
} from '../src/pages/Movements/movementFilters'
import { hasRecordsForUsageMode } from '../src/utils/usageMode'

const movements = [
  { key: 'income-1', kind: 'income' as const, date: '2026-08-02', category: 'Servicio', amount: 120, currency: 'EUR', reported: false, searchText: 'servicio efectivo' },
  { key: 'expense-1', kind: 'expense' as const, date: '2026-08-01', category: 'Transporte', amount: 30, currency: 'EUR', searchText: 'transporte' },
  { key: 'expense-2', kind: 'expense' as const, date: '2026-07-15', category: 'Material', amount: 80, currency: 'COP', searchText: 'material' },
]

describe('movement filters', () => {
  const now = new Date('2026-08-02T10:00:00')

  it('lee filtros de un deep link del Copiloto y conserva el alias de mes actual', () => {
    const filters = readMovementFilters(
      new URLSearchParams('type=expense&category=Transporte&period=current_month&reported=unreported&order=amount_desc'),
      now,
    )
    expect(filters).toEqual(expect.objectContaining({
      type: 'expense',
      category: 'Transporte',
      period: 'month',
      anchorDate: '2026-08-02',
      reported: 'unreported',
      order: 'amount_desc',
    }))
  })

  it('conserva la granularidad y desplaza los alias de períodos anteriores', () => {
    expect(readMovementFilters(
      new URLSearchParams('period=previous_month'),
      now,
    )).toEqual(expect.objectContaining({
      period: 'month',
      anchorDate: '2026-07-02',
    }))
    expect(readMovementFilters(
      new URLSearchParams('period=previous_week'),
      now,
    )).toEqual(expect.objectContaining({
      period: 'week',
      anchorDate: '2026-07-26',
    }))
  })

  it('combina tipo, categoría, moneda, periodo, reporte, búsqueda y orden', () => {
    const defaults = readMovementFilters(new URLSearchParams(), now)
    const result = applyMovementFilters(movements, {
      ...defaults,
      type: 'expense', category: 'Transporte', currency: 'EUR', period: 'month',
      reported: 'all', query: 'trans', order: 'amount_desc',
    }, now)
    expect(result.map((item) => item.key)).toEqual(['expense-1'])
  })

  it('filtra hoy, semana, mes y un rango personalizado con límites inclusivos', () => {
    const defaults = readMovementFilters(new URLSearchParams(), now)

    expect(applyMovementFilters(movements, {
      ...defaults,
      period: 'today',
    }, now).map((item) => item.key)).toEqual(['income-1'])
    expect(applyMovementFilters(movements, {
      ...defaults,
      period: 'week',
    }, now).map((item) => item.key)).toEqual(['income-1', 'expense-1'])
    expect(applyMovementFilters(movements, {
      ...defaults,
      period: 'month',
    }, now).map((item) => item.key)).toEqual(['income-1', 'expense-1'])
    expect(applyMovementFilters(movements, {
      ...defaults,
      period: 'custom',
      dateFrom: '2026-07-15',
      dateTo: '2026-08-01',
    }, now).map((item) => item.key)).toEqual(['expense-1', 'expense-2'])
  })

  it('desplaza períodos equivalentes sin modificar los demás filtros', () => {
    const defaults = readMovementFilters(new URLSearchParams('type=expense&period=month&date=2026-08-15'), now)

    expect(shiftMovementPeriod(defaults, -1)).toEqual({
      ...defaults,
      anchorDate: '2026-07-15',
    })
    expect(shiftMovementPeriod({ ...defaults, period: 'week' }, 1).anchorDate).toBe('2026-08-22')
    expect(shiftMovementPeriod({ ...defaults, period: 'today' }, -1).anchorDate).toBe('2026-08-14')
    expect(shiftMovementPeriod({ ...defaults, period: 'custom' }, 1)).toEqual({
      ...defaults,
      period: 'custom',
    })
  })

  it('genera una etiqueta central comprensible para la navegación temporal', () => {
    const defaults = readMovementFilters(new URLSearchParams('period=month&date=2026-08-15'), now)

    expect(getMovementPeriodLabel(defaults)).toBe('Agosto 2026')
    expect(getMovementPeriodLabel({ ...defaults, period: 'week' })).toBe('Semana del 10 de agosto de 2026')
    expect(getMovementPeriodLabel({ ...defaults, period: 'custom', dateFrom: '2026-07-15', dateTo: '2026-08-01' })).toBe('15/07/2026 - 01/08/2026')
    expect(getMovementPeriodLabel({ ...defaults, period: 'all' })).toBe('Todos los movimientos')
  })

  it('excluye registros de un tipo de uso distinto al actual (SA-008)', () => {
    const records = [
      { id: 1, usageMode: 'professional' as const },
      { id: 2, usageMode: 'basic' as const },
      { id: 3, earningPeriodId: 7 }, // legado sin usageMode explícito, ligado a temporada -> profesional
      { id: 4 }, // legado sin usageMode explícito ni temporada -> básico
    ]
    expect(scopeRecordsByUsageMode(records, 'professional').map((r) => r.id)).toEqual([1, 3])
    expect(scopeRecordsByUsageMode(records, 'basic').map((r) => r.id)).toEqual([2, 4])
  })

  it('detecta historial existente únicamente dentro del modo activo', () => {
    const historicalRecords = [
      { id: 1, usageMode: 'basic' as const },
      { id: 2, usageMode: 'professional' as const },
    ]

    expect(hasRecordsForUsageMode(historicalRecords, 'professional')).toBe(true)
    expect(hasRecordsForUsageMode(historicalRecords.slice(0, 1), 'professional')).toBe(false)
  })

  it('distingue el estado inicial de un resultado vacío por filtros', () => {
    expect(hasActiveMovementFilters(readMovementFilters(new URLSearchParams(), now))).toBe(false)
    expect(hasActiveMovementFilters(readMovementFilters(new URLSearchParams('q=material'), now))).toBe(true)
    expect(hasActiveMovementFilters(readMovementFilters(new URLSearchParams('order=oldest'), now))).toBe(true)
  })

  it('cuenta cada criterio activo sin contar las fechas auxiliares por separado', () => {
    expect(countActiveMovementFilters(readMovementFilters(new URLSearchParams(), now))).toBe(0)
    expect(countActiveMovementFilters(readMovementFilters(
      new URLSearchParams('period=custom&from=2026-07-15&to=2026-08-01&type=expense&q=material&order=oldest'),
      now,
    ))).toBe(4)
  })

  it('serializa solo filtros activos y preserva la pestaña actual', () => {
    const filters = readMovementFilters(
      new URLSearchParams('period=custom&from=2026-07-15&to=2026-08-01&type=expense&q=material'),
      now,
    )
    const params = writeMovementFilters(filters, new URLSearchParams('tab=todos&currency=USD'))

    expect(params.toString()).toBe('tab=todos&period=custom&from=2026-07-15&to=2026-08-01&type=expense&q=material')
    expect(hasMovementFilterParams(params)).toBe(true)
  })

  it('elimina filtros al restablecer sin borrar parámetros ajenos', () => {
    const defaults = readMovementFilters(new URLSearchParams(), now)
    const params = writeMovementFilters(
      defaults,
      new URLSearchParams('tab=ingresos&period=month&date=2026-08-02&type=income'),
    )

    expect(params.toString()).toBe('tab=ingresos')
    expect(hasMovementFilterParams(params)).toBe(false)
  })

  it('conserva movimientos distintos aunque compartan todos los datos visibles', () => {
    const duplicatedData = [
      { ...movements[0], key: 'income-10' },
      { ...movements[0], key: 'income-11' },
    ]
    const defaults = readMovementFilters(new URLSearchParams())

    expect(applyMovementFilters(duplicatedData, defaults).map((item) => item.key)).toEqual([
      'income-10',
      'income-11',
    ])
    expect(applyMovementFilters(duplicatedData, { ...defaults, query: 'servicio' }).map((item) => item.key)).toEqual([
      'income-10',
      'income-11',
    ])
  })
})
