import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '../types/appointment'

const appointments = new Map<number, Appointment>()

// Simula la serialización real de transacciones 'rw' de IndexedDB: solo una
// transacción corre a la vez y cada una termina (incluidos sus awaits
// internos) antes de que empiece la siguiente. Sin esto, un mock ingenuo
// dejaría "correr" varias pulsaciones concurrentes en paralelo y no
// detectaría duplicados.
let transactionQueue: Promise<unknown> = Promise.resolve()

const appointmentsTable = {
  add: vi.fn(async (appointment: Appointment) => {
    const id = appointments.size + 1
    appointments.set(id, { ...appointment, id })
    return id
  }),
  get: vi.fn(async (id: number) => appointments.get(id)),
  toArray: vi.fn(async () => Array.from(appointments.values())),
  put: vi.fn(async (appointment: Appointment) => {
    appointments.set(appointment.id as number, appointment)
    return appointment.id
  }),
}

vi.mock('../database/db', () => ({
  db: {
    appointments: appointmentsTable,
    automationOutbox: {},
    transaction: (_mode: string, _tables: unknown, callback: () => unknown) => {
      const run = transactionQueue.then(callback)
      transactionQueue = run.then(
        () => undefined,
        () => undefined,
      )
      return run
    },
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

const {
  claimAppointmentCompletion,
  createAppointment,
  getAppointmentById,
  startAppointmentService,
  updateAppointment,
} = await import('./appointmentService')

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
  transactionQueue = Promise.resolve()
})

describe('disponibilidad de agenda', () => {
  it('rechaza otra cita con el mismo inicio', async () => {
    await createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 60 }))

    await expect(
      createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 15 })),
    ).rejects.toThrow(/horario está ocupado/i)
  })

  it('rechaza cualquier cruce con la duración de una cita existente', async () => {
    await createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 60 }))

    await expect(
      createAppointment(appointment({ dateTime: '2026-08-24T14:45', duration: 30 })),
    ).rejects.toThrow(/horario está ocupado/i)
    await expect(
      createAppointment(appointment({ dateTime: '2026-08-24T15:45', duration: 30 })),
    ).rejects.toThrow(/horario está ocupado/i)
  })

  it('permite citas consecutivas cuando una comienza exactamente al terminar la anterior', async () => {
    await createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 60 }))

    await expect(
      createAppointment(appointment({ dateTime: '2026-08-24T16:00', duration: 30 })),
    ).resolves.toBe(2)
  })

  it('rechaza editar una cita hacia un intervalo ocupado, excluyendo su propio intervalo', async () => {
    const firstId = await createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 60 }))
    const secondId = await createAppointment(appointment({ dateTime: '2026-08-24T16:00', duration: 30 }))

    await expect(
      updateAppointment(secondId, { dateTime: '2026-08-24T15:30' }),
    ).rejects.toThrow(/horario está ocupado/i)
    await expect(
      updateAppointment(firstId, { notes: 'sin cambiar el horario' }),
    ).resolves.toEqual(expect.objectContaining({ notes: 'sin cambiar el horario' }))
  })

  it('permite editar campos no temporales de citas legacy que ya estaban solapadas', async () => {
    appointments.set(1, { ...appointment({ dateTime: '2026-08-24T15:00', duration: 60 }), id: 1 })
    appointments.set(2, { ...appointment({ dateTime: '2026-08-24T15:30', duration: 30 }), id: 2 })

    await expect(
      updateAppointment(2, { notes: 'dato corregido' }),
    ).resolves.toEqual(expect.objectContaining({ notes: 'dato corregido' }))
  })

  it('acepta como máximo una de dos creaciones concurrentes para el mismo intervalo', async () => {
    const results = await Promise.allSettled([
      createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 60 })),
      createAppointment(appointment({ dateTime: '2026-08-24T15:00', duration: 60 })),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
  })
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

describe('startAppointmentService', () => {
  it('rechaza iniciar antes de la fecha/hora programada (TEST A)', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-24T15:00' }))

    await expect(
      startAppointmentService(id, new Date('2026-08-24T14:59:59')),
    ).rejects.toThrow(/antes de la hora programada/)

    const persisted = await getAppointmentById(id)
    expect(persisted?.timerStartedAt).toBeUndefined()
  })

  it('rechaza iniciar un día antes, aunque la hora del reloj coincida (TEST C, compara fecha + hora)', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-25T15:00' }))

    await expect(
      startAppointmentService(id, new Date('2026-08-24T16:00')),
    ).rejects.toThrow(/antes de la hora programada/)
  })

  it('permite iniciar exactamente a la hora programada (TEST B)', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-24T15:00' }))

    const started = await startAppointmentService(id, new Date('2026-08-24T15:00:00'))

    expect(started.timerStartedAt).toBe(new Date('2026-08-24T15:00:00').toISOString())
  })

  it('es idempotente: múltiples pulsaciones producen un único actualStart (TEST D)', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-24T15:00' }))

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        startAppointmentService(id, new Date('2026-08-24T15:00:05')),
      ),
    )

    const startedTimestamps = new Set(results.map((result) => result.timerStartedAt))
    expect(startedTimestamps.size).toBe(1)

    const persisted = await getAppointmentById(id)
    expect(persisted?.timerStartedAt).toBe(results[0].timerStartedAt)
  })
})

describe('claimAppointmentCompletion', () => {
  it('no crea nada si la cita nunca tuvo un servicio activo', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-24T15:00' }))

    const result = await claimAppointmentCompletion(id, {
      timerStoppedAt: '2026-08-24T15:45:00.000Z',
      actualDuration: 45,
    })

    expect(result).toBeNull()
    await expect(getAppointmentById(id)).resolves.toEqual(
      expect.objectContaining({ completed: false }),
    )
  })

  it('es idempotente: solo la primera reclamación concurrente gana, el resto recibe null (TEST E)', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-24T15:00' }))
    await startAppointmentService(id, new Date('2026-08-24T15:00:00'))

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimAppointmentCompletion(id, {
          timerStoppedAt: '2026-08-24T15:45:00.000Z',
          actualDuration: 45,
        }),
      ),
    )

    expect(results.filter((result) => result !== null)).toHaveLength(1)

    const persisted = await getAppointmentById(id)
    expect(persisted?.completed).toBe(true)
    expect(persisted?.actualDuration).toBe(45)
  })

  it('una llamada posterior a una cita ya finalizada no cambia nada (TEST F)', async () => {
    const id = await createAppointment(appointment({ dateTime: '2026-08-24T15:00' }))
    await startAppointmentService(id, new Date('2026-08-24T15:00:00'))
    await claimAppointmentCompletion(id, {
      timerStoppedAt: '2026-08-24T15:45:00.000Z',
      actualDuration: 45,
    })

    const secondAttempt = await claimAppointmentCompletion(id, {
      timerStoppedAt: '2026-08-24T16:00:00.000Z',
      actualDuration: 60,
    })

    expect(secondAttempt).toBeNull()
    const persisted = await getAppointmentById(id)
    expect(persisted?.actualDuration).toBe(45)
    expect(persisted?.timerStoppedAt).toBe('2026-08-24T15:45:00.000Z')
  })
})
