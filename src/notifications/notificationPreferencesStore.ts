import { getSettings } from '../services/settingsService'
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationDefaults'
import type { NotificationPreferences } from './types'

/**
 * Punto único de lectura de NotificationPreferences desde Settings, compartido por
 * NotificationService y NotificationDeliveryService sin crear un import circular entre ambos.
 */
export async function getStoredNotificationPreferences(): Promise<NotificationPreferences> {
  return (await getSettings()).notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES
}
