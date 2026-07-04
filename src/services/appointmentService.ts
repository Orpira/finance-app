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
  normalizeReportStatus,
} from '../catalogs/reportStatuses'

export interface AppointmentListOptions extends DateRangeListOptions {
  completed?: boolean
  earningPeriodId?: number
}

export type CreateAppointmentInput = Omit<Appointment, 'id'>
export type UpdateAppointmentInput = Partial<CreateAppointmentInput>

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
  return db.transaction('rw', db.appointments, async () => {
    const currentAppointment = await db.appointments.get(id)
    await assertRecordIsMutable(currentAppointment)
    assertReportedRecordUpdateIsAllowed(currentAppointment, updates)
    if (!currentAppointment) throw new Error('La cita que intentas modificar no existe.')

    const updatedAppointment = normalizeReportStatus({
      ...currentAppointment,
      ...updates,
    }) as Appointment
    await db.appointments.put(updatedAppointment)
    return updatedAppointment
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
