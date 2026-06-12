import { db } from '../database/db'
import type { DateRangeListOptions } from '../types/dataAccess'
import type { Appointment } from '../types/appointment'

export interface AppointmentListOptions extends DateRangeListOptions {
  completed?: boolean
}

export type CreateAppointmentInput = Omit<Appointment, 'id'>
export type UpdateAppointmentInput = Partial<CreateAppointmentInput>

export async function createAppointment(input: CreateAppointmentInput) {
  return db.appointments.add(input)
}

export async function getAppointmentById(id: number) {
  return db.appointments.get(id)
}

export async function listAppointments(options: AppointmentListOptions = {}) {
  const { from, to, completed, newestFirst = false } = options
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

  if (completed === undefined) {
    return appointments
  }

  return appointments.filter((appointment) => appointment.completed === completed)
}

export async function updateAppointment(
  id: number,
  updates: UpdateAppointmentInput,
) {
  await db.appointments.update(id, updates)
  return db.appointments.get(id)
}

export async function markAppointmentCompleted(id: number, completed = true) {
  await db.appointments.update(id, { completed })
  return db.appointments.get(id)
}

export function deleteAppointment(id: number) {
  return db.appointments.delete(id)
}
