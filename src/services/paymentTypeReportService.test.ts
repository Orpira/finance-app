import { describe, expect, it } from 'vitest'

import type { ServiceIncome } from '../types/service'
import { groupReportableIncomesByPaymentType } from './paymentTypeReportService'

function income(overrides: Partial<ServiceIncome>): ServiceIncome {
  return {
    id: 1,
    date: '2026-08-22',
    duration: 120,
    totalAmount: 40,
    currency: 'EUR',
    percentage: 100,
    realGain: 40,
    eurValue: 40,
    copValue: 0,
    exchangeRateUsed: 1,
    type: 'ingreso',
    ...overrides,
  }
}

describe('groupReportableIncomesByPaymentType', () => {
  it('agrupa una Jornada con su tipo de pago real, igual que un Servicio', () => {
    const grouped = groupReportableIncomesByPaymentType([
      income({ incomeCalculationMethod: 'hourly_workday', paymentType: 'transfer' }),
    ])

    expect(grouped.get('Transferencia')).toHaveLength(1)
    expect(grouped.has('No aplica')).toBe(false)
  })

  it('mantiene un Servicio con transferencia bajo Transferencia', () => {
    const grouped = groupReportableIncomesByPaymentType([
      income({ incomeCalculationMethod: 'service_duration', paymentType: 'transfer' }),
    ])

    expect(grouped.get('Transferencia')).toHaveLength(1)
  })
})
