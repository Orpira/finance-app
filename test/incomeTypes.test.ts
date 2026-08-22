import { describe, expect, it } from 'vitest'

import {
  getIncomeCompactLabel,
  getIncomePaymentTypeLabel,
  getIncomeRegistrationTypeLabel,
  getIncomeTypeLabel,
} from '../src/utils/incomeTypes'

describe('getIncomeTypeLabel', () => {
  it('distingue servicio por tiempo, jornada por horas y ajuste', () => {
    expect(getIncomeTypeLabel({
      type: 'ingreso',
      incomeCalculationMethod: 'service_duration',
    })).toBe('Servicio')
    expect(getIncomeTypeLabel({
      type: 'ingreso',
      incomeCalculationMethod: 'hourly_workday',
    })).toBe('Jornada por horas')
    expect(getIncomeTypeLabel({
      type: 'ajuste',
      incomeCalculationMethod: 'hourly_workday',
    })).toBe('Ajuste')
  })

  it('mantiene la etiqueta corta del método aunque el formulario alterne a Ajuste', () => {
    expect(getIncomeRegistrationTypeLabel('hourly_workday')).toBe('Jornada')
    expect(getIncomeRegistrationTypeLabel('service_duration')).toBe('Servicio')
  })

  it('presenta el tipo de pago como no aplicable para una jornada', () => {
    const workday = {
      type: 'ingreso' as const,
      incomeCalculationMethod: 'hourly_workday' as const,
      paymentType: 'cash',
    }

    expect(getIncomePaymentTypeLabel(workday)).toBe('No aplica')
    expect(getIncomeCompactLabel(workday)).toBe('Jornada por horas')
  })
})