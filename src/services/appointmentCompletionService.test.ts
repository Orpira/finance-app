import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../types/appointment'
import type { EarningPeriod } from '../types/earningPeriod'
import type { SeasonStay } from '../types/seasonStay'
import type { ServiceIncome } from '../types/service'
import type { AppSettings } from '../types/settings'

const appointments = new Map<number, Appointment>()
const services = new Map<number, ServiceIncome>()
const outbox = new Map<string, unknown>()
const periods = new Map<number, EarningPeriod>()
const stays = new Map<number, SeasonStay>()
let storedSettings: AppSettings
let nextIncomeId = 1
let failAt: 'income' | 'outbox' | 'appointment' | undefined
let transactionQueue: Promise<unknown> = Promise.resolve()

function cloneMap<T>(source: Map<number, T>) {
  return new Map([...source].map(([key, value]) => [key, structuredClone(value)]))
}

const appointmentsTable = {
  get: vi.fn(async (id: number) => appointments.get(id)),
  put: vi.fn(async (value: Appointment) => {
    if (failAt === 'appointment') throw new Error('appointment write failed')
    appointments.set(value.id!, structuredClone(value))
    return value.id
  }),
}
const servicesTable = {
  get: vi.fn(async (id: number) => services.get(id)),
  add: vi.fn(async (value: ServiceIncome) => {
    if (failAt === 'income') throw new Error('income write failed')
    const id = nextIncomeId++
    services.set(id, { ...structuredClone(value), id })
    return id
  }),
}
const earningPeriodsTable = {
  get: vi.fn(async (id: number) => periods.get(id)),
  where: vi.fn(() => ({
    equals: vi.fn(() => ({
      toArray: vi.fn(async () => [...periods.values()].filter((period) => period.status === 'active')),
    })),
  })),
}
const seasonStaysTable = { get: vi.fn(async (id: number) => stays.get(id)) }
const automationOutboxTable = {
  add: vi.fn(async (value: { eventId: string }) => {
    if (failAt === 'outbox') throw new Error('outbox write failed')
    outbox.set(value.eventId, structuredClone(value))
    return value.eventId
  }),
}
const settingsTable = { get: vi.fn(async () => storedSettings) }

vi.mock('../database/db', () => ({
  DEFAULT_SETTINGS_ID: 'app',
  db: {
    appointments: appointmentsTable,
    services: servicesTable,
    earningPeriods: earningPeriodsTable,
    seasonStays: seasonStaysTable,
    automationOutbox: automationOutboxTable,
    settings: settingsTable,
    transaction: (_mode: string, _tables: unknown[], callback: () => unknown) => {
      const run = transactionQueue.then(async () => {
        const appointmentsBefore = cloneMap(appointments)
        const servicesBefore = cloneMap(services)
        const outboxBefore = new Map(outbox)
        const nextIncomeIdBefore = nextIncomeId
        try {
          return await callback()
        } catch (error) {
          appointments.clear(); appointmentsBefore.forEach((value, key) => appointments.set(key, value))
          services.clear(); servicesBefore.forEach((value, key) => services.set(key, value))
          outbox.clear(); outboxBefore.forEach((value, key) => outbox.set(key, value))
          nextIncomeId = nextIncomeIdBefore
          throw error
        }
      })
      transactionQueue = run.then(() => undefined, () => undefined)
      return run
    },
  },
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

const scheduleFlushMock = vi.fn()
vi.mock('./automationOutboxService', async (importOriginal) => {
  const original = await importOriginal<typeof import('./automationOutboxService')>()
  return { ...original, scheduleAutomationOutboxFlush: scheduleFlushMock }
})

const cancelRemindersMock = vi.fn()
vi.mock('./reminderService', () => ({
  cancelAppointmentReminders: (...args: unknown[]) => cancelRemindersMock(...args),
}))

const { completeAppointmentAsIncome } = await import('./appointmentCompletionService')

function settings(): AppSettings {
  return {
    id: 'app', usageMode: 'professional', country: 'ES', city: 'Madrid',
    secondaryCurrency: 'COP', defaultCurrency: 'EUR', rateMode: 'manual',
  } as AppSettings
}

function period(overrides: Partial<EarningPeriod> = {}): EarningPeriod {
  return {
    id: 7, name: 'Temporada', percentage: 50,
    startDate: '2026-01-01T00:00:00.000Z', status: 'active', countryCode: 'ES',
    baseCurrency: 'EUR', createdAt: '2026-01-01T00:00:00.000Z', ...overrides,
  }
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1, dateTime: '2026-01-02T10:00:00.000Z', duration: 60,
    durationLabel: '60', expectedAmount: 100, currency: 'EUR', paymentType: 'bizum',
    earningPeriodId: 7, seasonPeriodId: 7, country: 'ES', city: 'Madrid',
    reminders: [], completed: false, timerStartedAt: '2026-01-02T10:00:00.000Z',
    incomeCalculationMethod: 'service_duration', ...overrides,
  }
}

function stay(overrides: Partial<SeasonStay> = {}): SeasonStay {
  return {
    id: 3, earningPeriodId: 7, position: 0, city: 'Madrid', cityNormalized: 'madrid',
    countryCode: 'ES', status: 'active', actualStartAt: '2026-01-01T00:00:00.000Z',
    timeZone: 'Europe/Madrid', locationSource: 'manual', createdAt: '', updatedAt: '',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  appointments.clear(); services.clear(); outbox.clear(); periods.clear(); stays.clear()
  nextIncomeId = 1; failAt = undefined; transactionQueue = Promise.resolve()
  storedSettings = settings()
  periods.set(7, period())
  appointments.set(1, appointment())
  convertCurrencyPairMock.mockResolvedValue({ primaryValue: 50, secondaryValue: 200, rate: 4, source: 'manual' })
  convertCurrencyToEurCopMock.mockResolvedValue({ eurValue: 50, copValue: 200, source: 'manual' })
  resolveEurCopExchangeRateMock.mockResolvedValue({ rate: 4, source: 'manual' })
  saveExchangeRateMock.mockResolvedValue(undefined)
  cancelRemindersMock.mockResolvedValue(undefined)
})

describe('finalización atómica de citas', () => {
  it('persiste cita, ingreso, completedIncomeId y outbox en un único commit', async () => {
    const result = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    expect(result.status).toBe('completed')
    expect(appointments.get(1)).toMatchObject({ completed: true, completedIncomeId: 1 })
    expect(services.get(1)).toMatchObject({ realGain: 50, paymentType: 'bizum', timerUsed: false })
    expect([...outbox.values()][0]).toMatchObject({ event: 'income.created', data: { income: { id: 1 } } })
    expect(scheduleFlushMock).toHaveBeenCalledTimes(1)
    expect(cancelRemindersMock).toHaveBeenCalledWith(1)
  })

  it.each(['income', 'outbox', 'appointment'] as const)(
    'revierte todo si falla la escritura de %s',
    async (step) => {
      failAt = step
      await expect(completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))).rejects.toThrow()
      expect(appointments.get(1)?.completed).toBe(false)
      expect(appointments.get(1)?.completedIncomeId).toBeUndefined()
      expect(services.size).toBe(0)
      expect(outbox.size).toBe(0)
      expect(scheduleFlushMock).not.toHaveBeenCalled()
      expect(cancelRemindersMock).not.toHaveBeenCalled()
    },
  )

  it('es idempotente ante respuesta perdida, reintentos y doble clic concurrente', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () =>
      completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z')),
    ))
    expect(results.filter((result) => result.status === 'completed')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'already_completed')).toHaveLength(4)
    expect(services.size).toBe(1)
    expect(outbox.size).toBe(1)

    const retry = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:05:00.000Z'))
    expect(retry.status).toBe('already_completed')
    expect(retry.income?.id).toBe(1)
  })

  it('rechaza cambios de cita, cierre de temporada o cambio de estancia durante la preparación', async () => {
    let release!: () => void
    convertCurrencyPairMock.mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ primaryValue: 50, secondaryValue: 200, rate: 4, source: 'manual' })
    }))
    const pending = completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    appointments.set(1, appointment({ expectedAmount: 200 }))
    release()
    await expect(pending).rejects.toMatchObject({ code: 'APPOINTMENT_PRECONDITION_CHANGED' })
    expect(services.size).toBe(0)

    appointments.set(1, appointment())
    convertCurrencyPairMock.mockResolvedValue({ primaryValue: 50, secondaryValue: 200, rate: 4, source: 'manual' })
    let releaseSecond!: () => void
    convertCurrencyToEurCopMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseSecond = () => resolve({ eurValue: 50, copValue: 200, source: 'manual' })
    }))
    const closing = completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    await vi.waitFor(() => expect(releaseSecond).toBeTypeOf('function'))
    periods.set(7, period({ status: 'closed' }))
    releaseSecond()
    await expect(closing).rejects.toMatchObject({ code: 'APPOINTMENT_SEASON_INVALID' })

    periods.set(7, period())
    stays.set(3, stay())
    appointments.set(1, appointment({ seasonStayId: 3 }))
    let releaseThird!: () => void
    convertCurrencyPairMock.mockImplementationOnce(() => new Promise((resolve) => {
      releaseThird = () => resolve({ primaryValue: 50, secondaryValue: 200, rate: 4, source: 'manual' })
    }))
    const moving = completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    await vi.waitFor(() => expect(releaseThird).toBeTypeOf('function'))
    stays.set(3, stay({ city: 'Valencia', cityNormalized: 'valencia', updatedAt: '2026-01-02T10:30:00.000Z' }))
    releaseThird()
    await expect(moving).rejects.toMatchObject({ code: 'APPOINTMENT_PRECONDITION_CHANGED' })
  })

  it('hereda estancia y destino, pero bloquea estancia planificada o cancelada', async () => {
    stays.set(3, stay())
    appointments.set(1, appointment({
      seasonStayId: 3,
      travelDestination: { kind: 'city', label: 'Toledo', city: 'Toledo', source: 'manual' },
    }))
    await completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    expect(services.get(1)).toMatchObject({ seasonStayId: 3, travelDestination: { label: 'Toledo' } })

    appointments.set(1, appointment({ seasonStayId: 3 }))
    services.clear(); outbox.clear(); nextIncomeId = 1
    stays.set(3, stay({ status: 'planned', actualStartAt: undefined, plannedStartDate: '2026-01-01' }))
    await expect(completeAppointmentAsIncome(1, settings())).rejects.toMatchObject({ code: 'STAY_NOT_STARTED' })
    stays.set(3, stay({ status: 'cancelled', actualStartAt: undefined, cancelledAt: '', cancellationReasonCode: 'user_cancelled' }))
    await expect(completeAppointmentAsIncome(1, settings())).rejects.toMatchObject({ code: 'STAY_STATUS_INVALID' })
  })

  it('desvincula explícitamente un plan con motivo y conserva instantáneas', async () => {
    stays.set(3, stay({ status: 'planned', actualStartAt: undefined, plannedStartDate: '2026-01-01' }))
    appointments.set(1, appointment({ seasonStayId: 3, city: 'Madrid', country: 'ES' }))
    const result = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'), {
      plannedStayResolution: { action: 'detach', reason: 'El viaje se canceló' },
    })
    expect(result.status).toBe('completed')
    expect(appointments.get(1)).toMatchObject({
      seasonStayId: undefined, city: 'Madrid', country: 'ES', seasonStayDetachedFromId: 3,
      seasonStayDetachmentReason: 'El viaje se canceló',
    })
    expect(services.get(1)).toMatchObject({ seasonStayId: undefined, city: 'Madrid', country: 'ES' })
  })

  it('admite una estancia completada cuyo intervalo contiene la fecha del ingreso', async () => {
    stays.set(3, stay({
      status: 'completed',
      actualEndAt: '2026-01-03T00:00:00.000Z',
      completedAt: '2026-01-03T00:00:00.000Z',
    }))
    appointments.set(1, appointment({ seasonStayId: 3 }))

    await expect(completeAppointmentAsIncome(
      1, settings(), new Date('2026-01-02T11:00:00.000Z'),
    )).resolves.toMatchObject({ status: 'completed' })
    expect(services.get(1)?.seasonStayId).toBe(3)
  })

  it('preserva la protección de citas reportadas', async () => {
    appointments.set(1, appointment({
      reportStatusCode: 'reported', reportStatusLabel: 'Reportado',
      reportedAt: '2026-01-02T10:30:00.000Z',
    }))

    await expect(completeAppointmentAsIncome(1, settings())).rejects.toThrow(/reportado/i)
    expect(services.size).toBe(0)
    expect(outbox.size).toBe(0)
    expect(appointments.get(1)?.completed).toBe(false)
  })

  it('mantiene citas legacy sin temporada y completa jornadas D-011/D-015/D-016 sin porcentaje', async () => {
    appointments.set(1, appointment({
      earningPeriodId: undefined, seasonPeriodId: undefined,
      incomeCalculationMethod: 'hourly_workday', timerStartedAt: undefined,
      workedTime: 2, workedTimeUnit: 'hours', hourlyRateApplied: 20,
    }))
    convertCurrencyPairMock.mockResolvedValue({ primaryValue: 40, secondaryValue: 160, rate: 4, source: 'manual' })
    convertCurrencyToEurCopMock.mockResolvedValue({ eurValue: 40, copValue: 160, source: 'manual' })
    await completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    expect(services.get(1)).toMatchObject({
      totalAmount: 40, realGain: 40, percentage: 0, earningPercentage: 0,
      incomeCalculationMethod: 'hourly_workday', actualDuration: 0,
    })
  })

  it('tolera fallo de caché con cotización válida y fallo posterior de recordatorios', async () => {
    saveExchangeRateMock.mockRejectedValue(new Error('cache unavailable'))
    cancelRemindersMock.mockRejectedValue(new Error('native unavailable'))
    const result = await completeAppointmentAsIncome(1, settings(), new Date('2026-01-02T11:00:00.000Z'))
    expect(result.status).toBe('completed')
    expect(result.postCommitWarnings).toEqual(['REMINDER_CANCELLATION_FAILED'])
    expect(services.size).toBe(1)
    expect(outbox.size).toBe(1)
  })
})
