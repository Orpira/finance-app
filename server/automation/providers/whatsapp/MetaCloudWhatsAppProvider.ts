import { getMetaCloudConfig } from '../../../communication/config/metaCloudConfig.js'
import { createMetaCloudClient } from '../../../communication/services/metaCloudClient.js'
import { UnsupportedProviderCapabilityError } from './errors.js'
import type {
  WhatsAppChannelEventInput,
  WhatsAppChannelEventResult,
  WhatsAppProvider,
  WhatsAppProviderCapabilities,
} from './WhatsAppProvider.js'

const META_CLOUD_CAPABILITIES: WhatsAppProviderCapabilities = {
  supportsQr: false,
  supportsPairingCode: false,
  supportsTemplates: true,
  supportsMessageStatus: true,
  supportsInboundWebhooks: true,
  // No se asume coexistencia con la app oficial de WhatsApp Business sin
  // validarla contra una configuración real de Meta.
  supportsCoexistence: false,
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function extractTestRecipient(payload: unknown): string | undefined {
  const record = asRecord(payload)
  const nestedData = asRecord(record?.data)
  const recipient = record?.testRecipient ?? nestedData?.testRecipient
  return typeof recipient === 'string' && recipient.trim() ? recipient.trim() : undefined
}

function jsonResult(status: number, body: Record<string, unknown>): WhatsAppChannelEventResult {
  return { status, body, empty: false, successful: true }
}

/**
 * Implementa únicamente las operaciones de canal ya definidas por
 * WhatsAppProvider en la Fase 2 (conectar/desconectar/estado/prueba/
 * preferencias) — no envía mensajes de negocio: eso es responsabilidad del
 * backend de comunicaciones (server/communication/*), consumido por n8n vía
 * /api/communication/whatsapp/*.
 *
 * Deliberadamente NO persiste el estado del canal en `communication_channels`
 * (Neon) en esta fase: hacerlo bien requiere resolver userCode/deviceCode a
 * partir del payload del evento, igual que ya hace
 * server/automation/eventDispatcher.ts, y merece su propio análisis cuando
 * este proveedor se conecte a un flujo de migración real. Ver
 * docs/whatsapp/meta-cloud-backend.md, sección "Alcance de esta fase".
 */
export class MetaCloudWhatsAppProvider implements WhatsAppProvider {
  readonly name = 'meta-cloud' as const

  getCapabilities(): WhatsAppProviderCapabilities {
    return META_CLOUD_CAPABILITIES
  }

  async dispatchChannelEvent(input: WhatsAppChannelEventInput): Promise<WhatsAppChannelEventResult> {
    switch (input.event) {
      case 'communication.whatsapp.qr.requested':
        throw new UnsupportedProviderCapabilityError(
          `El proveedor "${this.name}" no admite la capacidad "supportsQr".`,
        )
      case 'device.whatsapp.connect.requested':
        return this.handleConnect()
      case 'communication.whatsapp.status.requested':
        return this.handleStatus()
      case 'communication.whatsapp.disconnect.requested':
        return this.handleDisconnect()
      case 'communication.whatsapp.test.requested':
        return this.handleTest(input.payload)
      case 'communication.whatsapp.preferences.updated':
        return this.handlePreferences()
    }
  }

  private handleConnect(): WhatsAppChannelEventResult {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      return jsonResult(200, {
        success: true,
        status: 'not_configured',
        persisted: false,
        message: 'WhatsApp Cloud API no está habilitado todavía.',
      })
    }
    return jsonResult(200, {
      success: true,
      status: 'connected',
      persisted: false,
      instanceName: config.phoneNumberId,
      message: 'WhatsApp Cloud API está configurado y listo.',
    })
  }

  private handleStatus(): WhatsAppChannelEventResult {
    const config = getMetaCloudConfig()
    return jsonResult(200, {
      success: true,
      status: config.enabled ? 'connected' : 'not_configured',
      enabled: config.enabled,
      realSendEnabled: config.enabled ? config.allowRealSend : false,
    })
  }

  private handleDisconnect(): WhatsAppChannelEventResult {
    return jsonResult(200, {
      success: true,
      status: 'disconnected',
      persisted: false,
      message: 'El canal se desactivó lógicamente. Las credenciales de Meta no se revocan desde aquí.',
    })
  }

  private async handleTest(payload: unknown): Promise<WhatsAppChannelEventResult> {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      return jsonResult(200, {
        success: true,
        status: 'not_configured',
        message: 'WhatsApp Cloud API no está habilitado todavía.',
      })
    }

    const testRecipient = extractTestRecipient(payload)
    if (!config.allowRealSend || !testRecipient) {
      return jsonResult(200, {
        success: true,
        status: 'connected',
        simulation: true,
        message: 'Configuración verificada sin envío real.',
      })
    }

    const client = createMetaCloudClient(config)
    const result = await client.sendText({
      recipient: testRecipient,
      text: 'Prueba de conexión de Private Balance (WhatsApp Cloud API).',
    })
    return jsonResult(200, {
      success: true,
      status: 'connected',
      simulation: false,
      providerMessageId: result.providerMessageId,
    })
  }

  private handlePreferences(): WhatsAppChannelEventResult {
    return jsonResult(200, {
      success: true,
      persisted: false,
      message: 'Las preferencias no se persisten todavía para el proveedor meta-cloud.',
    })
  }
}
