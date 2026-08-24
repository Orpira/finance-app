import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { Appointment } from '../types/appointment'
import { cancelAppointmentReminders } from './reminderService'
import { assertRecordIsMutable, requireActiveEarningPeriod } from './earningPeriodService'
import {
  createAutomationOutboxRecord,
  enqueueAutomationEvent,
  scheduleAutomationOutboxFlush,
} from './automationOutboxService'
import {
  assertRecordIsNotReported,
  assertReportedRecordUpdateIsAllowed,
  isReported,
  normalizeReportStatus,
} from '../catalogs/reportStatuses'
import { assertReportStatusUpdateIsAllowed } from '../utils/reportStatus'
import { getSettings } from './settingsService'

export interface AppointmentListOptions extends DateRangeListOptions {
  completed?: boolean
  earningPeriodId?: number
}

export type CreateAppointmentInput = Omit<Appointment, 'id'>
export type UpdateAppointmentInput = Partial<CreateAppointmentInput>

export const APPOINTMENT_TIME_CONFLICT_MESSAGE =
  'El horario está ocupado por otra cita. Elige una hora que no coincida con su duración prevista.'

function assertAppointmentIntervalIsAvailable(
  candidate: Pick<Appointment, 'dateTime' | 'duration'>,
  appointments: Appointment[],
  excludedAppointmentId?: number,
) {
  const candidateStart = new Date(candidate.dateTime).getTime()
  const candidateEnd = candidateStart + candidate.duration * 60_000
  const hasConflict = appointments.some((appointment) => {
    if (appointment.id === excludedAppointmentId) return false

    const appointmentStart = new Date(appointment.dateTime).getTime()
    const appointmentEnd = appointmentStart + appointment.duration * 60_000
    return candidateStart < appointmentEnd && appointmentStart < candidateEnd
  })

  if (hasConflict) {
    throw new Error(APPOINTMENT_TIME_CONFLICT_MESSAGE)
  }
}

export async function createAppointment(input: CreateAppointmentInput) {
  const period = await requireActiveEarningPeriod()
  const appointment = normalizeReportStatus({
    ...input,
    earningPeriodId: period.id,
    seasonPeriodId: period.id,
  })
  const appointmentId = await db.transaction('rw', [
    db.appointments,
    db.automationOutbox,
  ], async () => {
    assertAppointmentIntervalIsAvailable(
      appointment,
      await db.appointments.toArray(),
    )
    const nextAppointmentId = await db.appointments.add(appointment)
    await enqueueAutomationEvent(
      createAutomationOutboxRecord('calendar.created', {
        appointment: { ...appointment, id: nextAppointmentId },
      }),
    )
    return nextAppointmentId
  })
  scheduleAutomationOutboxFlush()

  return appointmentId
}

export async function getAppointmentById(id: number) {
  const appointment = await db.appointments.get(id)
  return appointment ? normalizeReportStatus(appointment) : appointment
}

export async function listAppointments(options: AppointmentListOptions = {}) {
  const { from, to, completed, earningPeriodId, newestFirst = false } = options
  const lowerBound = from ?? ''
  const upperBound = to ?? '\uffff'
  const collection =
    from || to
      ? db.appointments
          .where('dateTime')
          .between(lowerBound, upperBound, true, true)
      : db.appointments.orderBy('dateTime')

  if (newestFirst) {
    collection.reverse()
  }

  const appointments = await collection.toArray()

  return appointments.filter((appointment) =>
    (completed === undefined || appointment.completed === completed) &&
    (earningPeriodId === undefined || appointment.earningPeriodId === earningPeriodId),
  ).map((appointment) => normalizeReportStatus(appointment))
}

export async function updateAppointment(
  id: number,
  updates: UpdateAppointmentInput,
) {
  const settings = await getSettings()

  return db.transaction('rw', [db.appointments, db.earningPeriods], async () => {
    const currentAppointment = await db.appointments.get(id)
    if (!currentAppointment) throw new Error('La cita que intentas modificar no existe.')
    await assertRecordIsMutable(currentAppointment)
    assertReportStatusUpdateIsAllowed(currentAppointment, settings.usageMode, updates)
    assertReportedRecordUpdateIsAllowed(currentAppointment, updates)

    const updatedAppointment = normalizeReportStatus({
      ...currentAppointment,
      ...updates,
    }) as Appointment
    const scheduleChanged =
      updatedAppointment.dateTime !== currentAppointment.dateTime ||
      updatedAppointment.duration !== currentAppointment.duration
    if (scheduleChanged) {
      assertAppointmentIntervalIsAvailable(
        updatedAppointment,
        await db.appointments.toArray(),
        id,
      )
    }
    await db.appointments.put(updatedAppointment)
    return updatedAppointment
  })
}

/**
 * Inicia el servicio de una cita agendada. Idempotente: si ya tiene un
 * servicio activo (timerStartedAt) simplemente devuelve la cita sin
 * modificarla, en vez de reiniciar el cronómetro. Rechaza el inicio si aún
 * no se alcanzó la fecha/hora programada (fecha + hora, no solo la hora).
 */
export async function startAppointmentService(id: number, now = new Date()) {
  return db.transaction('rw', [db.appointments, db.earningPeriods], async () => {
    const currentAppointment = await db.appointments.get(id)
    if (!currentAppointment) {
      throw new Error('La cita que intentas iniciar no existe.')
    }

    if (currentAppointment.timerStartedAt) {
      // Idempotente: el servicio ya está en curso, no se reinicia.
      return currentAppointment
    }

    if (currentAppointment.completed || isReported(currentAppointment)) {
      throw new Error('La cita ya no admite iniciar un servicio.')
    }

    await assertRecordIsMutable(currentAppointment)

    if (now.getTime() < new Date(currentAppointment.dateTime).getTime()) {
      throw new Error('La cita no puede iniciarse antes de la hora programada.')
    }

    const updatedAppointment = normalizeReportStatus({
      ...currentAppointment,
      timerMode: 'manual',
      timerStartedAt: now.toISOString(),
    }) as Appointment
    await db.appointments.put(updatedAppointment)
    return updatedAppointment
  })
}

/**
 * Reclama atómicamente la finalización de una cita: marca completed=true y
 * fija la hora real de fin y la duración real en una única transacción sobre
 * `appointments`. Al ser una transacción `rw` sobre la misma tabla, el motor
 * de IndexedDB serializa pulsaciones concurrentes: solo la primera puede
 * "ganar" la reclamación (ve completed=false y escribe), cualquier otra ve
 * ya completed=true y recibe null. Esta es la protección real contra
 * servicios duplicados por múltiples pulsaciones en "Servicio realizado".
 * No crea servicios: si la cita no tiene un servicio activo (timerStartedAt)
 * devuelve null sin modificar nada.
 */
export async function claimAppointmentCompletion(
  id: number,
  fields: { timerStoppedAt: string; actualDuration: number },
) {
  return db.transaction('rw', [db.appointments, db.earningPeriods], async () => {
    const currentAppointment = await db.appointments.get(id)
    if (!currentAppointment) {
      throw new Error('La cita que intentas finalizar no existe.')
    }

    if (currentAppointment.completed) {
      // Idempotente: otra pulsación ya finalizó esta cita.
      return null
    }

    if (!currentAppointment.timerStartedAt) {
      // "Servicio realizado" nunca crea un servicio nuevo.
      return null
    }

    await assertRecordIsMutable(currentAppointment)

    const claimedAppointment = normalizeReportStatus({
      ...currentAppointment,
      completed: true,
      timerStoppedAt: fields.timerStoppedAt,
      actualDuration: fields.actualDuration,
    }) as Appointment
    await db.appointments.put(claimedAppointment)
    return claimedAppointment
  })
}

export async function markAppointmentCompleted(id: number, completed = true) {
  const currentAppointment = await db.appointments.get(id)
  await assertRecordIsMutable(currentAppointment)
  assertRecordIsNotReported(currentAppointment)
  await db.appointments.update(id, { completed })
  if (completed) await cancelAppointmentReminders(id)
  return db.appointments.get(id)
}

export async function deleteAppointment(id: number) {
  const currentAppointment = await db.appointments.get(id)
  await assertRecordIsMutable(currentAppointment)
  assertRecordIsNotReported(currentAppointment)
  await cancelAppointmentReminders(id)
  return db.transaction('rw', db.appointments, async () => {
    assertRecordIsNotReported(await db.appointments.get(id))
    return db.appointments.delete(id)
  })
}
