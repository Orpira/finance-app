import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../src/types/appointment'
import type { ServiceIncome } from '../src/types/service'
import type { AppSettings } from '../src/types/settings'
import { calculateFinancialTotals, calculateSeasonFinancialResult } from '../src/utils/financeStats'
import { runIncomeCalculation } from '../src/utils/incomeCalculation/incomeCalculatorRegistry'

const mocks = vi.hoisted(() => ({
  assertRecordIsMutable: vi.fn(),
  claimAppointmentCompletion: vi.fn(),
  convertCurrencyPair: vi.fn(),
  convertCurrencyToEurCop: vi.fn(),
  createServiceIncome: vi.fn(),
  ensureActiveEarningPeriod: vi.fn(),
  getAppointmentById: vi.fn(),
  resolveEurCopExchangeRate: vi.fn(),
  saveExchangeRate: vi.fn(),
}))

vi.mock('../src/services/appointmentService', () => ({
  claimAppointmentCompletion: mocks.claimAppointmentCompletion,
  getAppointmentById: mocks.getAppointmentById,
}))

vi.mock('../src/services/currencyConversionService', () => ({
  convertCurrencyPair: mocks.convertCurrencyPair,
  convertCurrencyToEurCop: mocks.convertCurrencyToEurCop,
  resolveEurCopExchangeRate: mocks.resolveEurCopExchangeRate,
}))

vi.mock('../src/services/exchangeRateService', () => ({
  saveExchangeRate: mocks.saveExchangeRate,
}))

vi.mock('../src/services/incomeService', () => ({
  createServiceIncome: mocks.createServiceIncome,
}))

vi.mock('../src/services/earningPeriodService', () => ({
  assertRecordIsMutable: mocks.assertRecordIsMutable,
  ensureActiveEarningPeriod: mocks.ensureActiveEarningPeriod,
}))

import { completeAppointmentAsIncome } from '../src/services/appointmentCompletionService'

const appointment: Appointment = {
  id: 21,
  dateTime: '2026-08-20T10:00',
  duration: 60,
  durationLabel: '1 hora',
  expectedAmount: 100,
  currency: 'EUR',
  earningPeriodId: 7,
  reminders: [],
  completed: false,
  timerStartedAt: '2026-08-20T10:00:00.000Z',
}

const settings = {
  usageMode: 'professional',
  rateMode: 'manual',
  defaultCurrency: 'EUR',
  secondaryCurrency: 'COP',
  country: 'ES',
  city: 'Madrid',
} as AppSettings

describe('completeAppointmentAsIncome financial consistency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getAppointmentById.mockResolvedValue(appointment)
    mocks.claimAppointmentCompletion.mockResolvedValue({
      ...appointment,
      completed: true,
    })
    mocks.resolveEurCopExchangeRate.mockResolvedValue({ rate: 4_300, source: 'manual' })
    mocks.saveExchangeRate.mockResolvedValue(undefined)
    mocks.createServiceIncome.mockResolvedValue(31)
  })

  it.each([[0, 0], [30, 30]] as const)(
    'produce el mismo neto que un ingreso manual con %s %% y alimenta Inicio y Meta una sola vez',
    async (percentage, expectedNet) => {
      const manualNet = runIncomeCalculation('service_duration', {
        totalAmount: 100,
        percentage,
        usageMode: 'professional',
        incomeType: 'ingreso',
      }).realGain
      expect(manualNet).toBe(expectedNet)
      mocks.ensureActiveEarningPeriod.mockResolvedValue({ id: 7, percentage })
      mocks.convertCurrencyPair.mockResolvedValue({
        primaryValue: expectedNet,
        secondaryValue: expectedNet * 4_300,
        rate: 4_300,
        source: 'manual',
      })
      mocks.convertCurrencyToEurCop.mockResolvedValue({
        eurValue: expectedNet,
        copValue: expectedNet * 4_300,
        eurCopRate: 4_300,
        source: 'manual',
      })

      await completeAppointmentAsIncome(21, settings, new Date('2026-08-20T11:00:00.000Z'))

      expect(mocks.createServiceIncome).toHaveBeenCalledTimes(1)
      const createdIncome = mocks.createServiceIncome.mock.calls[0][0] as ServiceIncome
      expect(createdIncome).toMatchObject({
        totalAmount: 100,
        percentage,
        earningPercentage: percentage,
        realGain: expectedNet,
        baseCurrencyValue: expectedNet,
        status: 'FINALIZADO',
        earningPeriodId: 7,
      })

      const homeTotals = calculateFinancialTotals(
        [createdIncome],
        [],
        'EUR',
        'COP',
      )
      const seasonResult = calculateSeasonFinancialResult({
        incomes: [createdIncome],
        expenses: [],
        currency: 'EUR',
        usageMode: 'professional',
        earningPeriodId: 7,
      })

      expect(homeTotals.primaryIncome).toBe(expectedNet)
      expect(seasonResult).toEqual({
        netIncome: expectedNet,
        expenses: 0,
        result: expectedNet,
      })
    },
  )
})