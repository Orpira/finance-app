import { describe, expect, it } from 'vitest'

import type { Appointment } from '../src/types/appointment'
import type { EarningPeriod } from '../src/types/earningPeriod'
import type { AppSettings } from '../src/types/settings'
import { calculateFinancialTotals, calculateSeasonFinancialResult } from '../src/utils/financeStats'
import { runIncomeCalculation } from '../src/utils/incomeCalculation/incomeCalculatorRegistry'
import { buildAppointmentCompletionIncome } from '../src/services/appointmentCompletionService'

const appointment: Appointment = {
  id: 21,
  dateTime: '2026-08-20T10:00:00.000Z',
  duration: 60,
  durationLabel: '1 hora',
  expectedAmount: 100,
  currency: 'EUR',
  earningPeriodId: 7,
  reminders: [],
  completed: false,
  timerStartedAt: '2026-08-20T10:00:00.000Z',
  incomeCalculationMethod: 'service_duration',
}

const settings = {
  usageMode: 'professional', defaultCurrency: 'EUR', secondaryCurrency: 'COP',
  country: 'ES', city: 'Madrid',
} as AppSettings

describe('completeAppointmentAsIncome financial consistency', () => {
  it.each([[0, 0], [30, 30]] as const)(
    'produce el mismo neto que un ingreso manual con %s %% y alimenta Inicio y Meta una sola vez',
    (percentage, expectedNet) => {
      const period: EarningPeriod = {
        id: 7, name: 'Temporada', percentage, startDate: '2026-08-01T00:00:00.000Z',
        status: 'active', createdAt: '2026-08-01T00:00:00.000Z',
      }
      const manualNet = runIncomeCalculation('service_duration', {
        totalAmount: 100, percentage, usageMode: 'professional', incomeType: 'ingreso',
      }).realGain
      const createdIncome = buildAppointmentCompletionIncome({
        appointment,
        period,
        settings,
        effectiveAt: '2026-08-20T11:00:00.000Z',
        serviceDate: '2026-08-20',
        actualDuration: 60,
        converted: {
          eurValue: expectedNet,
          copValue: expectedNet * 4_300,
          exchangeRateUsed: 4_300,
          baseCurrency: 'EUR',
          secondaryCurrency: 'COP',
          baseCurrencyValue: expectedNet,
          secondaryCurrencyValue: expectedNet * 4_300,
          exchangeRateBaseToSecondary: 4_300,
        },
      })

      expect(manualNet).toBe(expectedNet)
      expect(createdIncome).toMatchObject({
        totalAmount: 100, percentage, earningPercentage: percentage,
        realGain: expectedNet, baseCurrencyValue: expectedNet,
        status: 'FINALIZADO', earningPeriodId: 7,
      })
      expect(calculateFinancialTotals([createdIncome], [], 'EUR', 'COP').primaryIncome).toBe(expectedNet)
      expect(calculateSeasonFinancialResult({
        incomes: [createdIncome], expenses: [], currency: 'EUR',
        usageMode: 'professional', earningPeriodId: 7,
      })).toEqual({ netIncome: expectedNet, expenses: 0, result: expectedNet })
    },
  )
})
