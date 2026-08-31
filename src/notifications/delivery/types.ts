import type { CopilotNotification, NotificationChannel, NotificationDeliveryState, NotificationPreferences } from '../types'

export interface AndroidDeliveryOutcome {
  status: 'delivered' | 'permission_denied' | 'failed' | 'not_requested'
  nativeId?: number
  deliveredAt?: string
}

export interface InAppDeliveryOutcome {
  deliveredAt: string
}

/** Un canal de entrega concreto (in-app, Android, ...). Nunca decide si notificar — solo entrega. */
export interface NotificationDeliveryAdapter<Outcome> {
  channel: NotificationChannel
  deliver(notification: CopilotNotification, preferences: NotificationPreferences): Promise<Outcome>
}

export interface NotificationDeliveryResult {
  channels: NotificationChannel[]
  delivery: NotificationDeliveryState
}
