import { describe, expect, it } from 'vitest'

import {
  shouldShowMovementReportBadge,
  toUnifiedMovements,
} from '../src/pages/Movements/movementPresentation'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'

describe('movement financial presentation', () => {
  it('muestra el neto almacenado del ingreso y el importe real del egreso', () => {
    const agendaIncome: ServiceIncome = {
      id: 1,
      date: '2026-08-20',
      duration: 60,
      totalAmount: 100,
      currency: 'EUR',
      percentage: 30,
      realGain: 30,
      eurValue: 30,
      copValue: 129_000,
      exchangeRateUsed: 4_300,
      baseCurrency: 'EUR',
      baseCurrencyValue: 30,
      type: 'ingreso',
      usageMode: 'professional',
      earningPeriodId: 7,
      additionalsTotal: 20,
    }
    const expense: Expense = {
      id: 2,
      type: 'gasto',
      date: '2026-08-20',
      category: 'Materiales',
      amount: 20,
      currency: 'EUR',
      eurValue: 20,
      copValue: 86_000,
      baseCurrency: 'EUR',
      baseCurrencyValue: 20,
      usageMode: 'professional',
      earningPeriodId: 7,
      createdAt: '2026-08-20T11:00:00.000Z',
    }

    expect(toUnifiedMovements([agendaIncome], [expense])).toMatchObject([
      { key: 'income-1', amount: 30, currency: 'EUR' },
      { key: 'expense-2', amount: 20, currency: 'EUR' },
    ])
  })

  it('oculta el badge pendiente pero conserva el badge reportado cuando la preferencia está desactivada', () => {
    expect(shouldShowMovementReportBadge(false, {
      label: 'Pendiente',
      isReported: false,
      isUnreviewed: false,
    })).toBe(false)
    expect(shouldShowMovementReportBadge(false, {
      label: 'Reportado',
      isReported: true,
      isUnreviewed: false,
    })).toBe(true)
  })

  it('mantiene el badge pendiente cuando la preferencia está activada', () => {
    expect(shouldShowMovementReportBadge(true, {
      label: 'Pendiente',
      isReported: false,
      isUnreviewed: false,
    })).toBe(true)
  })

  it('presenta y permite buscar el nombre Personal sin exponerlo en Profesional', () => {
    const base = {
      id: 9, date: '2026-09-05', duration: 0, totalAmount: 100, currency: 'EUR',
      percentage: 100, realGain: 100, eurValue: 100, copValue: 400_000,
      exchangeRateUsed: 4_000, type: 'ingreso' as const, personalName: 'Venta del portátil',
    }
    expect(toUnifiedMovements([{ ...base, usageMode: 'basic' }], [])[0])
      .toEqual(expect.objectContaining({ label: 'Venta del portátil', searchText: 'Venta del portátil' }))
    expect(toUnifiedMovements([{ ...base, usageMode: 'professional' }], [])[0].label)
      .toBe('Servicio #9')
  })

  it('presenta y permite buscar el nombre Personal de un egreso sin exponerlo en Profesional', () => {
    const base = {
      id: 11, type: 'gasto' as const, date: '2026-09-05', category: 'Otros',
      amount: 50, currency: 'EUR', eurValue: 50, copValue: 200_000,
      createdAt: '2026-09-05T10:00:00.000Z', personalName: 'Compra supermercado',
    }
    expect(toUnifiedMovements([], [{ ...base, usageMode: 'basic' }])[0])
      .toEqual(expect.objectContaining({ label: 'Compra supermercado', searchText: 'Compra supermercado' }))
    expect(toUnifiedMovements([], [{ ...base, usageMode: 'professional' }])[0].label)
      .toBe('Otros')
  })

  it('usa el fallback "Egreso #ID" en Personal cuando el egreso histórico no tiene nombre', () => {
    const expenseWithoutName = {
      id: 12, type: 'gasto' as const, date: '2026-09-05', category: 'Otros',
      amount: 50, currency: 'EUR', eurValue: 50, copValue: 200_000,
      createdAt: '2026-09-05T10:00:00.000Z', usageMode: 'basic' as const,
    }
    expect(toUnifiedMovements([], [expenseWithoutName])[0].label).toBe('Egreso #12')
  })
})
