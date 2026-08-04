import { describe, expect, it } from 'vitest'

import {
  applyMovementFilters,
  readMovementFilters,
  scopeRecordsByUsageMode,
} from '../src/pages/Movements/movementFilters'

const movements = [
  { key: 'income-1', kind: 'income' as const, date: '2026-08-02', category: 'Servicio', amount: 120, currency: 'EUR', reported: false, searchText: 'servicio efectivo' },
  { key: 'expense-1', kind: 'expense' as const, date: '2026-08-01', category: 'Transporte', amount: 30, currency: 'EUR', searchText: 'transporte' },
  { key: 'expense-2', kind: 'expense' as const, date: '2026-07-15', category: 'Material', amount: 80, currency: 'COP', searchText: 'material' },
]

describe('movement filters', () => {
  it('lee filtros de un deep link del Copiloto', () => {
    const filters = readMovementFilters(new URLSearchParams('type=expense&category=Transporte&period=current_month&reported=unreported&order=amount_desc'))
    expect(filters).toEqual(expect.objectContaining({ type: 'expense', category: 'Transporte', period: 'current_month', reported: 'unreported', order: 'amount_desc' }))
  })

  it('combina tipo, categoría, moneda, periodo, reporte, búsqueda y orden', () => {
    const result = applyMovementFilters(movements, {
      type: 'expense', category: 'Transporte', currency: 'EUR', period: 'current_month',
      reported: 'all', query: 'trans', order: 'amount_desc',
    }, new Date('2026-08-02T10:00:00.000Z'))
    expect(result.map((item) => item.key)).toEqual(['expense-1'])
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
})
