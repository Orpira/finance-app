import type { NotificationRepository } from '../notificationRepository'
import { getStoredNotificationPreferences } from '../notificationPreferencesStore'
import type { CopilotNotification, NotificationDeliveryState, NotificationPreferences } from '../types'
import { createAndroidNotificationDelivery } from './AndroidNotificationDelivery'
import { createInAppNotificationDelivery } from './InAppNotificationDelivery'
import { resolveNotificationChannels } from './notificationChannelPolicy'
import type { AndroidDeliveryOutcome, InAppDeliveryOutcome, NotificationDeliveryAdapter, NotificationDeliveryResult } from './types'

export interface NotificationDeliveryServiceDeps {
  repository: NotificationRepository
  getPreferences?: () => Promise<NotificationPreferences>
  inAppAdapter?: NotificationDeliveryAdapter<InAppDeliveryOutcome>
  androidAdapter?: NotificationDeliveryAdapter<AndroidDeliveryOutcome>
}

/**
 * ADR-034 Fase 1.5 §13-14 — determina los canales autorizados (vía notificationChannelPolicy,
 * que lee las preferencias ya resueltas) y entrega por cada uno. NUNCA vuelve a evaluar dedup,
 * cooldown, frecuencia ni ninguna regla financiera: todo eso ya lo decidió el Policy Engine antes
 * de que exista la CopilotNotification que llega aquí.
 */
export function createNotificationDeliveryService(deps: NotificationDeliveryServiceDeps) {
  const { repository } = deps
  const getPreferences = deps.getPreferences ?? getStoredNotificationPreferences
  const inAppAdapter = deps.inAppAdapter ?? createInAppNotificationDelivery()
  const androidAdapter = deps.androidAdapter ?? createAndroidNotificationDelivery()

  async function deliver(notification: CopilotNotification): Promise<NotificationDeliveryResult> {
    const preferences = await getPreferences()
    const channels = resolveNotificationChannels(notification.priority, preferences)
    const delivery: NotificationDeliveryState = {}

    if (channels.includes('in_app')) {
      delivery.inApp = await inAppAdapter.deliver(notification, preferences)
    }

    if (channels.includes('android')) {
      delivery.android = await androidAdapter.deliver(notification, preferences)
    }

    await repository.updateDelivery(notification.id, delivery)

    return { channels, delivery }
  }

  return { deliver }
}

export type NotificationDeliveryService = ReturnType<typeof createNotificationDeliveryService>
