import { UnsupportedProviderCapabilityError } from './errors.js'
import type { WhatsAppProvider, WhatsAppProviderCapabilities } from './WhatsAppProvider.js'

/**
 * Guard reutilizable para exigir una capacidad antes de ejecutar una
 * operación específica de proveedor (p. ej. QR o pairing code). Hoy no tiene
 * llamadas en producción porque el único proveedor implementado (Evolution)
 * admite todas las capacidades relevantes; queda listo para cuando
 * MetaCloudWhatsAppProvider se conecte a rutas que sí necesiten distinguir
 * capacidades en tiempo de ejecución.
 */
export function assertProviderCapability(
  provider: WhatsAppProvider,
  capability: keyof WhatsAppProviderCapabilities,
  message?: string,
): void {
  if (!provider.getCapabilities()[capability]) {
    throw new UnsupportedProviderCapabilityError(
      message ?? `El proveedor "${provider.name}" no admite la capacidad "${capability}".`,
    )
  }
}
