import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../types/appointment'
import type { AppSettings } from '../types/settings'

const getAppointmentByIdMock = vi.fn()
const claimAppointmentCompletionMock = vi.fn()
vi.mock('./appointmentService', () => ({
  getAppointmentById: (...args: unknown[]) => getAppointmentByIdMock(...args),
  claimAppointmentCompletion: (...args: unknown[]) => claimAppointmentCompletionMock(...args),
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
    timerStartedAt: '2026-01-01T10:00:00.000Z',
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
  getAppointmentByIdMock.mockResolvedValue(appointment())
  claimAppointmentCompletionMock.mockImplementation(async (_id: number, fields: unknown) => ({
    ...appointment(),
    completed: true,
    ...(fields as object),
  }))
})

describe('completeAppointmentAsIncome', () => {
  it('siempre persiste incomeCalculationMethod="service_duration" y additionalsTotal=0, sin importar la configuración de método del usuario', async () => {
    await completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(createServiceIncomeMock).toHaveBeenCalledTimes(1)
    const persisted = createServiceIncomeMock.mock.calls[0][0]
    expect(persisted.incomeCalculationMethod).toBe('service_duration')
    expect(persisted.additionalsTotal).toBe(0)
  })

  it('crea el ingreso de la cita como finalizado y sin iniciar otro cronómetro', async () => {
    await completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(createServiceIncomeMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'FINALIZADO',
      timerUsed: false,
      timerStartedAt: '2026-01-01T10:00:00.000Z',
      timerStoppedAt: '2026-01-01T11:00:00.000Z',
      actualDuration: 60,
    }))
  })

  it('conserva en el ingreso el tipo de pago elegido al agendar la cita', async () => {
    getAppointmentByIdMock.mockResolvedValue(appointment({ paymentType: 'bizum' }))

    await completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(createServiceIncomeMock).toHaveBeenCalledWith(expect.objectContaining({
      paymentType: 'bizum',
    }))
  })

  it('nunca crea un servicio si la cita nunca fue iniciada (sin timerStartedAt)', async () => {
    getAppointmentByIdMock.mockResolvedValue(appointment({ timerStartedAt: undefined }))

    const result = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(result).toBeNull()
    expect(createServiceIncomeMock).not.toHaveBeenCalled()
    expect(claimAppointmentCompletionMock).not.toHaveBeenCalled()
  })

  it('es idempotente: una cita ya finalizada no genera un ingreso nuevo (TEST F)', async () => {
    getAppointmentByIdMock.mockResolvedValue(appointment({ completed: true }))

    const result = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(result).toBeNull()
    expect(createServiceIncomeMock).not.toHaveBeenCalled()
    expect(claimAppointmentCompletionMock).not.toHaveBeenCalled()
  })

  it('si la reclamación atómica detecta que otra pulsación ya finalizó la cita, no crea un ingreso duplicado', async () => {
    claimAppointmentCompletionMock.mockResolvedValue(null)

    const result = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z'))

    expect(result).toBeNull()
    expect(createServiceIncomeMock).not.toHaveBeenCalled()
  })

  it('múltiples pulsaciones concurrentes producen como máximo un ingreso (TEST D/E)', async () => {
    let claimed = false
    claimAppointmentCompletionMock.mockImplementation(async (_id: number, fields: unknown) => {
      if (claimed) return null
      claimed = true
      return { ...appointment(), completed: true, ...(fields as object) }
    })

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        completeAppointmentAsIncome(1, settings(), new Date('2026-01-01T11:00:00.000Z')),
      ),
    )

    expect(createServiceIncomeMock).toHaveBeenCalledTimes(1)
    expect(results.filter((result) => result !== null)).toHaveLength(1)
  })
})
