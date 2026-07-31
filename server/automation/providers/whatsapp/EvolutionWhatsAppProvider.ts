import { dispatchWebhook, WebhookDispatchError } from '../../webhookDispatcher.js'
import { WhatsAppProviderUnavailableError } from './errors.js'
import type {
  WhatsAppChannelEventInput,
  WhatsAppChannelEventResult,
  WhatsAppProvider,
  WhatsAppProviderCapabilities,
} from './WhatsAppProvider.js'

const EVOLUTION_CAPABILITIES: WhatsAppProviderCapabilities = {
  supportsQr: true,
  supportsPairingCode: true,
  supportsTemplates: false,
  // No confirmado en el código actual: el workflow "03 WhatsApp Status" solo
  // documenta callbacks de estado de sesión (open/close/qr), no acuses de
  // recibo/lectura por mensaje.
  supportsMessageStatus: false,
  supportsInboundWebhooks: true,
  supportsCoexistence: false,
}

/**
 * Encapsula el comportamiento actual sin reescribirlo: Private Balance nunca
 * llama a Evolution API directamente, siempre reenvía el evento al webhook de
 * WhatsApp de n8n (N8N_WHATSAPP_WEBHOOK_URL) y es n8n quien orquesta
 * Evolution. Este proveedor conserva ese comportamiento exacto detrás de la
 * interfaz común `WhatsAppProvider`.
 */
export class EvolutionWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'evolution' as const

  getCapabilities(): WhatsAppProviderCapabilities {
    return EVOLUTION_CAPABILITIES
  }

  async dispatchChannelEvent(input: WhatsAppChannelEventInput): Promise<WhatsAppChannelEventResult> {
    try {
      return await dispatchWebhook(input)
    } catch (error) {
      if (error instanceof WebhookDispatchError) throw error
      throw new WhatsAppProviderUnavailableError(
        error instanceof Error
          ? error.message
          : 'No se pudo contactar con el proveedor de WhatsApp.',
      )
    }
  }
}
