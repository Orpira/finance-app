import type { Appointment } from '../types/appointment'

export async function scheduleAppointmentReminders(
  appointment: Appointment,
): Promise<void> {
  const reminders = appointment.reminders ?? []

  if (appointment.completed || reminders.length === 0) {
    return
  }

  const localReminders = reminders.filter(
    (reminder) => reminder.type === 'local',
  )

  if (localReminders.length === 0) {
    return
  }

  // TODO: Integrate Capacitor Local Notifications for native builds.
  // Keep this service as a web-safe no-op until notification permissions,
  // channel configuration, cancellation, and rescheduling are implemented.
}
