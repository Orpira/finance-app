import type { NotificationChannel, NotificationPreferences, NotificationPriority } from '../types'

/**
 * ADR-034 Fase 1.5 §6 — única fuente de verdad sobre qué canales recibe cada prioridad.
 * El Policy Engine sigue decidiendo SI se notifica; esto solo decide POR DÓNDE, una vez que
 * ya se decidió que sí. No debe duplicarse en ningún otro componente.
 */
export function resolveNotificationChannels(
  priority: NotificationPriority,
  preferences: NotificationPreferences,
): NotificationChannel[] {
  const channels: NotificationChannel[] = ['in_app']

  if (!preferences.androidNotificationsEnabled) return channels

  const androidEnabledForPriority =
    priority === 'P0'
      ? true
      : priority === 'P1'
        ? preferences.androidActionRequiredEnabled
        : priority === 'P2'
          ? preferences.androidFinancialInsightsEnabled
          : preferences.androidSummaryEnabled

  if (androidEnabledForPriority) channels.push('android')

  return channels
}
