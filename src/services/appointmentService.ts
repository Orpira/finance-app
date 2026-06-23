import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { Appointment } from '../types/appointment'
import { cancelAppointmentReminders } from './reminderService'
import { assertRecordIsMutable, requireActiveEarningPeriod } from './earningPeriodService'

export interface AppointmentListOptions extends DateRangeListOptions {
  completed?: boolean
  earningPeriodId?: number
}

export type CreateAppointmentInput = Omit<Appointment, 'id'>
export type UpdateAppointmentInput = Partial<CreateAppointmentInput>

export async function createAppointment(input: CreateAppointmentInput) {
  const period = await requireActiveEarningPeriod()
  return db.appointments.add({
    ...input,
    earningPeriodId: period.id,
    seasonPeriodId: period.id,
  })
}

export async function getAppointmentById(id: number) {
  return db.appointments.get(id)
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
  )
}

export async function updateAppointment(
  id: number,
  updates: UpdateAppointmentInput,
) {
  await assertRecordIsMutable(await db.appointments.get(id))
  await db.appointments.update(id, updates)
  return db.appointments.get(id)
}

export async function markAppointmentCompleted(id: number, completed = true) {
  await assertRecordIsMutable(await db.appointments.get(id))
  await db.appointments.update(id, { completed })
  if (completed) await cancelAppointmentReminders(id)
  return db.appointments.get(id)
}

export async function deleteAppointment(id: number) {
  await assertRecordIsMutable(await db.appointments.get(id))
  await cancelAppointmentReminders(id)
  return db.appointments.delete(id)
}
