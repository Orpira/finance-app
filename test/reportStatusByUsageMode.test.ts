import { describe, expect, it } from 'vitest'

import type { Appointment } from '../src/types/appointment'
import type { Expense } from '../src/types/expense'
import type { ServiceIncome } from '../src/types/service'
import {
  canMarkAsReported,
  getReportedCountByUsageMode,
  toggleReportStatus,
} from '../src/utils/reportStatus'

const professionalService = {
  type: 'ingreso',
  usageMode: 'professional',
  totalAmount: 100,
  date: '2026-07-04',
  reportStatusCode: 'reported',
} as ServiceIncome

const professionalAdjustment = {
  ...professionalService,
  type: 'ajuste',
} as ServiceIncome

const basicExpense = {
  type: 'gasto',
  usageMode: 'basic',
  amount: 25,
  category: 'Transporte',
  date: '2026-07-04',
  reportStatusCode: 'reported',
} as Expense

const basicAdjustment = {
  ...basicExpense,
  type: 'ajuste',
} as Expense

const appointment = {
  dateTime: '2026-07-04T10:00',
  earningPeriodId: 3,
  reportStatusCode: 'reported',
} as Appointment

describe('report status rules by usage mode', () => {
  it('allows only professional services in professional mode', () => {
    expect(canMarkAsReported(professionalService, 'professional')).toBe(true)
    expect(canMarkAsReported(professionalAdjustment, 'professional')).toBe(false)
    expect(canMarkAsReported(basicExpense, 'professional')).toBe(false)
    expect(canMarkAsReported(appointment, 'professional')).toBe(false)
  })

  it('allows only regular expenses in basic mode', () => {
    expect(canMarkAsReported(basicExpense, 'basic')).toBe(true)
    expect(canMarkAsReported(basicAdjustment, 'basic')).toBe(false)
    expect(canMarkAsReported(professionalService, 'basic')).toBe(false)
    expect(canMarkAsReported(appointment, 'basic')).toBe(false)
  })

  it('counts reported records independently for each mode', () => {
    const records = [
      professionalService,
      professionalAdjustment,
      basicExpense,
      basicAdjustment,
      appointment,
    ]

    expect(getReportedCountByUsageMode(records, 'professional')).toBe(1)
    expect(getReportedCountByUsageMode(records, 'basic')).toBe(1)
  })

  it('blocks toggling an ineligible record even when called outside the UI', () => {
    expect(() => toggleReportStatus(basicExpense, 'professional')).toThrow(
      'Este tipo de registro no se puede marcar como reportado en el modo de uso activo.',
    )
  })
})
