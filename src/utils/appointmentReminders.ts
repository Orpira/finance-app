import type {
  Appointment,
  AppointmentReminder,
  AppointmentReminderType,
  AppointmentReminderUnit,
} from '../types/appointment'

export const reminderUnitLabels: Record<AppointmentReminderUnit, string> = {
  minutes: 'minutos',
  hours: 'horas',
  days: 'días',
}

const singularReminderUnitLabels: Record<AppointmentReminderUnit, string> = {
  minutes: 'minuto',
  hours: 'hora',
  days: 'día',
}

export const reminderTypeLabels: Record<AppointmentReminderType, string> = {
  local: 'Alarma sonora prioritaria',
  inApp: 'Alarma sonora prioritaria',
}

export function createReminderId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function createEmptyReminder(): AppointmentReminder {
  return {
    id: createReminderId(),
    amount: 30,
    unit: 'minutes',
    type: 'local',
  }
}

export function formatReminderTime(reminder: AppointmentReminder) {
  const unitLabel =
    reminder.amount === 1
      ? singularReminderUnitLabels[reminder.unit]
      : reminderUnitLabels[reminder.unit]

  return `${reminder.amount} ${unitLabel} antes`
}

export function hasInvalidReminders(reminders: AppointmentReminder[]) {
  return (
    reminders.length > 2 ||
    reminders.some((reminder) => reminder.amount <= 0) ||
    new Set(
      reminders.map(
        (reminder) => `${reminder.amount}-${reminder.unit}`,
      ),
    ).size !== reminders.length
  )
}

export function getReminderOffsetMs(reminder: AppointmentReminder) {
  const minute = 60 * 1000

  if (reminder.unit === 'hours') {
    return reminder.amount * 60 * minute
  }

  if (reminder.unit === 'days') {
    return reminder.amount * 24 * 60 * minute
  }

  return reminder.amount * minute
}

export function getReminderTriggerTime(
  appointment: Appointment,
  reminder: AppointmentReminder,
) {
  return new Date(appointment.dateTime).getTime() - getReminderOffsetMs(reminder)
}
