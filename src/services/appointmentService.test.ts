import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../types/appointment'

const appointments = new Map<number, Appointment>()
const appointmentsTable = {
  add: vi.fn(async (appointment: Appointment) => {
    const id = appointments.size + 1
    appointments.set(id, { ...appointment, id })
    return id
  }),
  get: vi.fn(async (id: number) => appointments.get(id)),
  put: vi.fn(async (appointment: Appointment) => {
    appointments.set(appointment.id as number, appointment)
    return appointment.id
  }),
}

vi.mock('../database/db', () => ({
  db: {
    appointments: appointmentsTable,
    automationOutbox: {},
    transaction: async (_mode: string, _tables: unknown, callback: () => unknown) => callback(),
  },
}))

vi.mock('./settingsService', () => ({
  getSettings: vi.fn(async () => ({ usageMode: 'professional' })),
}))

vi.mock('./earningPeriodService', () => ({
  assertRecordIsMutable: vi.fn(),
  requireActiveEarningPeriod: vi.fn(async () => ({ id: 7 })),
}))

vi.mock('./automationOutboxService', () => ({
  createAutomationOutboxRecord: vi.fn((event: string, payload: unknown) => ({ event, payload })),
  enqueueAutomationEvent: vi.fn(),
  scheduleAutomationOutboxFlush: vi.fn(),
}))

vi.mock('./reminderService', () => ({
  cancelAppointmentReminders: vi.fn(),
}))

const { createAppointment, getAppointmentById, updateAppointment } = await import('./appointmentService')

function appointment(overrides: Partial<Appointment> = {}): Omit<Appointment, 'id'> {
  return {
    dateTime: '2026-08-22T10:00',
    duration: 60,
    expectedAmount: 40,
    currency: 'EUR',
    country: 'ES',
    city: 'Madrid',
    notes: 'original',
    reminders: [],
    completed: false,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  appointments.clear()
})

describe('updateAppointment', () => {
  it('persiste la edición de una cita activa en la base local', async () => {
    const id = await createAppointment(appointment())

    await updateAppointment(id, {
      dateTime: '2026-08-22T11:30',
      duration: 90,
      expectedAmount: 55,
      notes: 'editada',
    })

    await expect(getAppointmentById(id)).resolves.toEqual(
      expect.objectContaining({
        dateTime: '2026-08-22T11:30',
        duration: 90,
        expectedAmount: 55,
        notes: 'editada',
        earningPeriodId: 7,
        seasonPeriodId: 7,
      }),
    )
  })
})
