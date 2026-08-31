import { Capacitor } from '@capacitor/core'
import { LocalNotifications, type PermissionStatus } from '@capacitor/local-notifications'

/**
 * ADR-034 Fase 1.5 §10-12 — comprobar nunca debe solicitar. Solicitar solo ocurre desde una
 * interacción explícita del usuario en Configuración (nunca automáticamente en background).
 */
export async function checkAndroidNotificationPermission(): Promise<PermissionStatus['display']> {
  if (Capacitor.getPlatform() !== 'android') return 'denied'
  const permission = await LocalNotifications.checkPermissions()
  return permission.display
}

export async function requestAndroidNotificationPermission(): Promise<PermissionStatus['display']> {
  if (Capacitor.getPlatform() !== 'android') return 'denied'
  const permission = await LocalNotifications.requestPermissions()
  return permission.display
}
