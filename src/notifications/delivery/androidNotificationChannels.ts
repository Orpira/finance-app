import { LocalNotifications } from '@capacitor/local-notifications'

import type { NotificationPriority } from '../types'

/**
 * ADR-034 Fase 1.5 §49-51 — canales propios del Copiloto, independientes de `appointment-alarms-v2`
 * (Agenda). P0 usa importancia alta (situación crítica); P1 usa importancia por defecto, sin
 * vibración agresiva ni lenguaje alarmista.
 */
const CRITICAL_CHANNEL_ID = 'copilot-critical'
const IMPORTANT_CHANNEL_ID = 'copilot-important'

export function androidChannelIdForPriority(priority: NotificationPriority): string {
  return priority === 'P0' ? CRITICAL_CHANNEL_ID : IMPORTANT_CHANNEL_ID
}

export async function ensureAndroidNotificationChannel(priority: NotificationPriority): Promise<string> {
  const channelId = androidChannelIdForPriority(priority)

  if (channelId === CRITICAL_CHANNEL_ID) {
    await LocalNotifications.createChannel({
      id: CRITICAL_CHANNEL_ID,
      name: 'Avisos críticos de Private Balance',
      description: 'Situaciones críticas del Copiloto que requieren tu atención inmediata.',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } else {
    await LocalNotifications.createChannel({
      id: IMPORTANT_CHANNEL_ID,
      name: 'Avisos importantes de Private Balance',
      description: 'Alertas del Copiloto que pueden requerir tu atención.',
      importance: 4,
      visibility: 1,
      vibration: false,
    })
  }

  return channelId
}
