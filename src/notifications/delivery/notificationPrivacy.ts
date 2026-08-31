import type { CopilotNotification, NotificationPreferences } from '../types'

const APP_TITLE = 'Private Balance'

const GENERIC_BODY_BY_PRIORITY: Record<'P0' | 'default', string> = {
  P0: 'Una situación requiere tu atención. Toca para revisar.',
  default: 'Tienes una actualización importante. Toca para revisar.',
}

export interface AndroidNotificationContent {
  title: string
  body: string
}

/**
 * ADR-034 Fase 1.5 §22-24 — la pantalla bloqueada de Android nunca debe filtrar información
 * financiera salvo que el usuario haya activado explícitamente `showFinancialDetailsExternally`
 * Y la notificación en sí permita mostrar detalle (`privacy !== 'private'`). Minimización por defecto.
 */
export function buildAndroidNotificationContent(
  notification: CopilotNotification,
  preferences: NotificationPreferences,
): AndroidNotificationContent {
  const canShowDetails = preferences.showFinancialDetailsExternally && notification.privacy !== 'private'

  if (canShowDetails) {
    return { title: APP_TITLE, body: notification.message }
  }

  const body = notification.priority === 'P0' ? GENERIC_BODY_BY_PRIORITY.P0 : GENERIC_BODY_BY_PRIORITY.default
  return { title: APP_TITLE, body }
}
