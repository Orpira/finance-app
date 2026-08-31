import type { InAppDeliveryOutcome, NotificationDeliveryAdapter } from './types'

/**
 * ADR-034 Fase 1.5 §15 — la persistencia in-app real ya ocurrió en NotificationService al
 * llamar a `repository.create()`. Este adapter solo confirma la entrega, no reescribe el Centro
 * de notificaciones ni toca Dexie directamente.
 */
export function createInAppNotificationDelivery(
  deps: { now?: () => Date } = {},
): NotificationDeliveryAdapter<InAppDeliveryOutcome> {
  const now = deps.now ?? (() => new Date())

  return {
    channel: 'in_app',
    async deliver() {
      return { deliveredAt: now().toISOString() }
    },
  }
}
