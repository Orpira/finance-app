import { describe, expect, it } from 'vitest'

import type { Appointment, AppointmentReminder } from '../types/appointment'
import {
  createDefaultAppointmentReminders,
  getReminderTriggerTime,
} from './appointmentReminders'

describe('recordatorios de citas', () => {
  it('crea una alarma predeterminada 5 minutos antes para cada cita nueva', () => {
    const reminders = createDefaultAppointmentReminders()

    expect(reminders).toHaveLength(1)
    expect(reminders[0]).toMatchObject({
      amount: 5,
      unit: 'minutes',
      type: 'local',
    })
  })

  it.each([
    [{ amount: 5, unit: 'minutes' }, '2026-08-25T14:55:00.000Z'],
    [{ amount: 2, unit: 'hours' }, '2026-08-25T13:00:00.000Z'],
  ] as const)(
    'programa cada alarma configurable antes del inicio: %o',
    (configuration, expectedTrigger) => {
      const appointment = {
        dateTime: '2026-08-25T15:00:00.000Z',
      } as Appointment
      const reminder = {
        id: 'reminder',
        type: 'local',
        ...configuration,
      } as AppointmentReminder

      const triggerTime = getReminderTriggerTime(appointment, reminder)

      expect(new Date(triggerTime).toISOString()).toBe(expectedTrigger)
      expect(triggerTime).toBeLessThan(new Date(appointment.dateTime).getTime())
    },
  )
})
