/// <reference types="node" />

import { WhatsAppProviderConfigurationError } from './errors.js'
import { WHATSAPP_PROVIDER_NAMES, type WhatsAppProviderName } from './WhatsAppProvider.js'

const DEFAULT_WHATSAPP_PROVIDER: WhatsAppProviderName = 'evolution'

/**
 * `WHATSAPP_PROVIDER` ausente (despliegues existentes que aún no la definen)
 * usa Evolution por compatibilidad. Un valor presente pero no reconocido es
 * un error de configuración explícito: nunca cae en Evolution en silencio.
 */
export function getConfiguredWhatsAppProviderName(): WhatsAppProviderName {
  const raw = process.env.WHATSAPP_PROVIDER?.trim()
  if (!raw) return DEFAULT_WHATSAPP_PROVIDER

  if (!(WHATSAPP_PROVIDER_NAMES as readonly string[]).includes(raw)) {
    throw new WhatsAppProviderConfigurationError(
      `WHATSAPP_PROVIDER="${raw}" no es válido. Usa uno de: ${WHATSAPP_PROVIDER_NAMES.join(', ')}.`,
    )
  }

  return raw as WhatsAppProviderName
}
