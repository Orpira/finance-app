import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../types/appointment'
import type { AppSettings } from '../types/settings'

const updateAppointmentMock = vi.fn()
vi.mock('./appointmentService', () => ({
  updateAppointment: (...args: unknown[]) => updateAppointmentMock(...args),
}))

const convertCurrencyPairMock = vi.fn()
const convertCurrencyToEurCopMock = vi.fn()
const resolveEurCopExchangeRateMock = vi.fn()
vi.mock('./currencyConversionService', () => ({
  convertCurrencyPair: (...args: unknown[]) => convertCurrencyPairMock(...args),
  convertCurrencyToEurCop: (...args: unknown[]) => convertCurrencyToEurCopMock(...args),
  resolveEurCopExchangeRate: (...args: unknown[]) => resolveEurCopExchangeRateMock(...args),
}))

const saveExchangeRateMock = vi.fn()
vi.mock('./exchangeRateService', () => ({
  saveExchangeRate: (...args: unknown[]) => saveExchangeRateMock(...args),
}))

const createServiceIncomeMock = vi.fn()
vi.mock('./incomeService', () => ({
  createServiceIncome: (...args: unknown[]) => createServiceIncomeMock(...args),
}))

const assertRecordIsMutableMock = vi.fn()
const ensureActiveEarningPeriodMock = vi.fn()
vi.mock('./earningPeriodService', () => ({
  assertRecordIsMutable: (...args: unknown[]) => assertRecordIsMutableMock(...args),
  ensureActiveEarningPeriod: (...args: unknown[]) => ensureActiveEarningPeriodMock(...args),
}))

const { completeAppointmentAsIncome } = await import('./appointmentCompletionService')

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    dateTime: '2026-01-01T10:00:00.000Z',
    duration: 60,
    durationLabel: '60',
    expectedAmount: 100,
    currency: 'EUR',
    completed: false,
    ...overrides,
  } as Appointment
}

function settings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    id: 'app',
    secondaryCurrency: 'COP',
    rateMode: 'manual',
    incomeCalculationMethod: 'hourly_workday', // configuración actual irrelevante para citas
    hourlyRate: 20,
    workedTimeUnit: 'minutes',
    ...overrides,
  } as AppSettings
}

beforeEach(() => {
  vi.clearAllMocks()
  assertRecordIsMutableMock.mockResolvedValue(undefined)
  ensureActiveEarningPeriodMock.mockResolvedValue({ id: 1, percentage: 50 })
  convertCurrencyPairMock.mockResolvedValue({ primaryValue: 50, secondaryValue: 0, rate: 1, source: 'manual' })
  convertCurrencyToEurCopMock.mockResolvedValue({ eurValue: 50, copValue: 0 })
  resolveEurCopExchangeRateMock.mockResolvedValue({ rate: 1 })
  createServiceIncomeMock.mockResolvedValue(1)
  updateAppointmentMock.mockResolvedValue(undefined)
})

describe('completeAppointmentAsIncome', () => {
  it('siempre persiste incomeCalculationMethod="service_duration" y additionalsTotal=0, sin importar la configuración de método del usuario', async () => {
    await completeAppointmentAsIncome(appointment(), settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(createServiceIncomeMock).toHaveBeenCalledTimes(1)
    const persisted = createServiceIncomeMock.mock.calls[0][0]
    expect(persisted.incomeCalculationMethod).toBe('service_duration')
    expect(persisted.additionalsTotal).toBe(0)
  })
})
