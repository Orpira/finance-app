import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import type { ServiceIncome } from '../types/service'

const CHANNEL_ID = 'service-completion-alarms-v1'
let initialized = false

async function ensureNotificationChannel() {
  if (!Capacitor.isNativePlatform() || initialized) return

  initialized = true
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: 'Servicios finalizados',
    description: 'Alertas de finalizacion de servicios',
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
    sound: 'appointment_alarm.ogg',
  })
}

function buildNotificationBody(income: ServiceIncome) {
  const amount = Number.isFinite(income.totalAmount)
    ? `${income.totalAmount.toLocaleString('es-ES')} ${income.currency}`
    : undefined

  const details = [income.city, income.paymentType, amount].filter(Boolean)
  return details.length > 0
    ? `Servicio finalizado. ${details.join(' · ')}`
    : 'Servicio finalizado.'
}

export async function notifyServiceCompleted(income: ServiceIncome) {
  try {
    if (!income.id) return

    if (Capacitor.isNativePlatform()) {
      await ensureNotificationChannel()

      const permission = await LocalNotifications.checkPermissions()
      const displayPermission = permission.display === 'prompt'
        ? (await LocalNotifications.requestPermissions()).display
        : permission.display

      if (displayPermission !== 'granted') return

      await LocalNotifications.schedule({
        notifications: [{
          id: 9_000_000 + income.id,
          title: '✅ Servicio Finalizado',
          body: buildNotificationBody(income),
          channelId: CHANNEL_ID,
          sound: 'appointment_alarm.ogg',
          schedule: {
            at: new Date(Date.now() + 500),
            allowWhileIdle: true,
          },
          extra: {
            incomeId: income.id,
          },
        }],
      })
      return
    }

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('✅ Servicio Finalizado', {
        body: buildNotificationBody(income),
        icon: '/icons/icon-192.png',
        tag: `service-completed-${income.id}`,
      })
    }
  } catch (error) {
    console.warn('[Private Balance] No se pudo mostrar la notificacion de servicio finalizado.', error)
  }
}