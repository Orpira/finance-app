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
})