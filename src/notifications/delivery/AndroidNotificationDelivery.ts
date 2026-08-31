import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import type { CopilotNotification, NotificationPreferences } from '../types'
import { ensureAndroidNotificationChannel } from './androidNotificationChannels'
import { checkAndroidNotificationPermission } from './androidPermissions'
import { toAndroidNotificationId } from './androidNotificationId'
import { buildAndroidNotificationContent } from './notificationPrivacy'
import type { AndroidDeliveryOutcome, NotificationDeliveryAdapter } from './types'

/**
 * ADR-034 Fase 1.5 §16 — canal de entrega Android. Nunca decide si notificar (eso ya lo resolvió
 * el Policy Engine); nunca solicita permisos (eso solo ocurre desde una interacción del usuario
 * en Configuración); nunca vuelve a calcular lógica financiera.
 */
export function createAndroidNotificationDelivery(
  deps: { now?: () => Date } = {},
): NotificationDeliveryAdapter<AndroidDeliveryOutcome> {
  const now = deps.now ?? (() => new Date())

  return {
    channel: 'android',
    async deliver(notification: CopilotNotification, preferences: NotificationPreferences) {
      if (Capacitor.getPlatform() !== 'android') {
        return { status: 'not_requested' }
      }

      const permission = await checkAndroidNotificationPermission()
      if (permission !== 'granted') {
        return { status: 'permission_denied' }
      }

      try {
        const nativeId = toAndroidNotificationId(notification.id)
        const channelId = await ensureAndroidNotificationChannel(notification.priority)
        const { title, body } = buildAndroidNotificationContent(notification, preferences)

        await LocalNotifications.schedule({
          notifications: [
            {
              id: nativeId,
              title,
              body,
              channelId,
              extra: {
                copilotNotificationId: notification.id,
                destination: notification.action?.destination ?? null,
              },
            },
          ],
        })

        return { status: 'delivered', nativeId, deliveredAt: now().toISOString() }
      } catch (error) {
        console.warn('[copilot-notifications] fallo al entregar notificación Android.', error)
        return { status: 'failed' }
      }
    },
  }
}
