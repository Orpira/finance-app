/**
 * CopilotNotification.id (string) -> id numérico estable compatible con Capacitor Local Notifications.
 * Nunca Date.now(): debe ser reproducible para poder cancelar/actualizar la misma notificación nativa.
 *
 * Usa el mismo esquema de hash que `reminderService.notificationId()` pero con un namespace propio,
 * porque ambos sistemas comparten el espacio de IDs de notificación del SO — el namespace reduce la
 * probabilidad de colisión entre un recordatorio de Agenda y una notificación del Copiloto.
 */
const ANDROID_ID_NAMESPACE = 'copilot-notification:'

export function toAndroidNotificationId(copilotNotificationId: string): number {
  const input = `${ANDROID_ID_NAMESPACE}${copilotNotificationId}`
  let hash = 0
  for (const character of input) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0
  return Math.abs(hash) || 1
}
