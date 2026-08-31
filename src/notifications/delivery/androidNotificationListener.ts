import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'

import { getNotificationService, notifyNotificationsChanged } from '../notificationService'
import { isValidInternalDestination } from './notificationDestination'

/**
 * ADR-034 Fase 1.5 §26-32 — al tocar una notificación Android: marca la CopilotNotification como
 * `acted` (nunca crea una segunda entrada) y navega solo si el destino es una ruta interna válida.
 * No-op seguro fuera de Android. Debe registrarse una única vez por ciclo de vida de la app —
 * el llamador es responsable de guardar y ejecutar la función de limpieza devuelta.
 */
export async function registerAndroidNotificationTapListener(
  onNavigate: (destination: string) => void,
): Promise<() => void> {
  if (Capacitor.getPlatform() !== 'android') return () => {}

  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', async (event) => {
    const copilotNotificationId = event.notification.extra?.copilotNotificationId
    if (typeof copilotNotificationId !== 'string') return

    await getNotificationService().markActed(copilotNotificationId)
    notifyNotificationsChanged()

    const destination = event.notification.extra?.destination
    if (isValidInternalDestination(destination)) onNavigate(destination)
  })

  return () => {
    handle.remove()
  }
}
