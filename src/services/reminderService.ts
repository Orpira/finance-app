import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import { db } from '../database/db'
import type { Appointment } from '../types/appointment'
import { getReminderTriggerTime } from '../utils/appointmentReminders'

const CHANNEL_ID = 'appointment-alarms-v2'
const ACTION_TYPE_ID = 'appointment-alarm-actions'
let notificationsInitialized = false

function notificationId(appointmentId: number, reminderId: string) {
  let hash = appointmentId
  for (const character of reminderId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash) || appointmentId
}

async function prepareNativeNotifications() {
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Alarmas de agenda',
    description: 'Avisos prioritarios para citas programadas',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    sound: 'appointment_alarm.ogg',
  })
  await LocalNotifications.registerActionTypes({
    types: [{
      id: ACTION_TYPE_ID,
      actions: [
        { id: 'stop', title: 'Detener' },
        { id: 'snooze', title: 'Posponer 5 min' },
      ],
    }],
  })
}

export async function initializeReminderNotifications() {
  if (!Capacitor.isNativePlatform() || notificationsInitialized) return
  notificationsInitialized = true
  await prepareNativeNotifications()
  await LocalNotifications.addListener('localNotificationActionPerformed', async ({ actionId, notification }) => {
    if (actionId !== 'snooze') return
    await LocalNotifications.schedule({ notifications: [{
      id: notification.id,
      title: notification.title,
      body: notification.body,
      channelId: CHANNEL_ID,
      actionTypeId: ACTION_TYPE_ID,
      sound: 'appointment_alarm.ogg',
      schedule: { at: new Date(Date.now() + 5 * 60 * 1000), allowWhileIdle: true },
      extra: notification.extra,
    }] })
  })

  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return
  if (Capacitor.getPlatform() === 'android') {
    const exactAlarm = await LocalNotifications.checkExactNotificationSetting()
    if (exactAlarm.exact_alarm !== 'granted') return
  }

  const upcomingAppointments = await db.appointments.toArray()
  for (const appointment of upcomingAppointments) {
    if (
      !appointment.completed &&
      new Date(appointment.dateTime).getTime() > Date.now() &&
      appointment.reminders.length > 0
    ) {
      await scheduleAppointmentReminders(appointment)
    }
  }
}

export async function scheduleAppointmentReminders(appointment: Appointment): Promise<void> {
  const localReminders = appointment.reminders ?? []

  if (!Capacitor.isNativePlatform()) {
    if (localReminders.length > 0 && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    return
  }

  if (!appointment.id) return
  await prepareNativeNotifications()

  const permission = await LocalNotifications.checkPermissions()
  const displayPermission = permission.display === 'prompt'
    ? (await LocalNotifications.requestPermissions()).display
    : permission.display
  if (displayPermission !== 'granted') throw new Error('Permiso de notificaciones denegado.')
  if (Capacitor.getPlatform() === 'android') {
    const exactAlarm = await LocalNotifications.checkExactNotificationSetting()
    if (exactAlarm.exact_alarm !== 'granted') {
      await LocalNotifications.changeExactNotificationSetting()
    }
  }

  const pending = await LocalNotifications.getPending()
  const previous = pending.notifications.filter((notification) =>
    notification.extra?.appointmentId === appointment.id,
  )
  if (previous.length > 0) await LocalNotifications.cancel({ notifications: previous.map(({ id }) => ({ id })) })
  if (appointment.completed || localReminders.length === 0) return

  const notifications = localReminders
    .map((reminder) => ({ reminder, at: new Date(getReminderTriggerTime(appointment, reminder)) }))
    .filter(({ at }) => at.getTime() > Date.now())
    .map(({ reminder, at }) => ({
      id: notificationId(appointment.id!, reminder.id),
      title: 'Cita próxima',
      body: `Tienes una cita a las ${appointment.dateTime.slice(11, 16)}.`,
      largeBody: appointment.notes || 'Abre Finanzas para consultar la cita.',
      channelId: CHANNEL_ID,
      actionTypeId: ACTION_TYPE_ID,
      sound: 'appointment_alarm.ogg',
      schedule: { at, allowWhileIdle: true },
      extra: { appointmentId: appointment.id },
    }))

  if (notifications.length > 0) await LocalNotifications.schedule({ notifications })
}

export async function cancelAppointmentReminders(appointmentId: number) {
  if (!Capacitor.isNativePlatform()) return
  const pending = await LocalNotifications.getPending()
  const notifications = pending.notifications.filter((notification) =>
    notification.extra?.appointmentId === appointmentId,
  )
  if (notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) })
  }
}
