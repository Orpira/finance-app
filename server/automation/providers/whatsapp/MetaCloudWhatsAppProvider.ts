import { getMetaCloudConfig, type MetaCloudEnabledConfig } from '../../../communication/config/metaCloudConfig.js'
import {
  getMetaChannel,
  upsertMetaChannel,
  type MetaChannelRecord,
} from '../../../communication/repositories/metaChannelRepository.js'
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

function firstString(...values: unknown[]): string | undefined {
  const match = values.find((value) => typeof value === 'string' && value.trim())
  return typeof match === 'string' ? match.trim() : undefined
}

function extractConnectPhoneNumber(payload: unknown): string | undefined {
  const record = asRecord(payload)
  return firstString(record?.phoneNumber, asRecord(record?.data)?.phoneNumber)
}

function extractTestRecipient(payload: unknown): string | undefined {
  const record = asRecord(payload)
  return firstString(record?.testRecipient, asRecord(record?.data)?.testRecipient)
}

function jsonResult(status: number, body: Record<string, unknown>): WhatsAppChannelEventResult {
  return { status, body, empty: false, successful: true }
}

function channelMode(config: MetaCloudEnabledConfig): 'simulation' | 'production' {
  return config.allowRealSend ? 'production' : 'simulation'
}

function capabilitiesBody() {
  return { ...META_CLOUD_CAPABILITIES }
}

/**
 * Implementa las operaciones de canal de WhatsAppProvider (Fase 2) para
 * meta-cloud, ahora persistiendo el estado por usuario/dispositivo en Neon
 * (server/communication/repositories/metaChannelRepository.ts, Fase 4) en
 * vez de derivarlo únicamente de la configuración global. El envío real de
 * mensajes de negocio sigue viviendo en
 * server/communication/services/outboundMessageService.ts, consumido
 * directamente por n8n — no a través de esta interfaz.
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
        return this.handleConnect(input.userCode, input.deviceCode, input.payload)
      case 'communication.whatsapp.status.requested':
        return this.handleStatus(input.userCode, input.deviceCode)
      case 'communication.whatsapp.disconnect.requested':
        return this.handleDisconnect(input.userCode, input.deviceCode)
      case 'communication.whatsapp.test.requested':
        return this.handleTest(input.payload)
      case 'communication.whatsapp.preferences.updated':
        return this.handlePreferences(input.userCode, input.deviceCode, input.payload)
    }
  }

  private async handleConnect(
    userCode: string | undefined,
    deviceCode: string,
    payload: unknown,
  ): Promise<WhatsAppChannelEventResult> {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      return jsonResult(200, {
        success: true,
        provider: this.name,
        status: 'not_configured',
        message: 'WhatsApp Cloud API no está habilitado todavía.',
        capabilities: capabilitiesBody(),
      })
    }

    if (!userCode) {
      return jsonResult(200, {
        success: false,
        provider: this.name,
        status: 'error',
        message: 'No se pudo resolver el usuario para persistir el canal meta-cloud.',
      })
    }

    const mode = channelMode(config)
    const record = await upsertMetaChannel({
      userCode,
      deviceCode,
      status: 'connected',
      mode,
      enabled: true,
      phoneNumber: extractConnectPhoneNumber(payload) ?? null,
      phoneNumberId: config.phoneNumberId,
      wabaId: config.wabaId ?? null,
      webhookEnabled: config.webhookEnabled,
      automationEnabled: true,
      inboundForwardingEnabled: config.forwardInboundToN8n,
      connectedAt: new Date().toISOString(),
    })

    return jsonResult(200, {
      success: true,
      provider: this.name,
      status: record.status,
      mode: record.mode,
      capabilities: capabilitiesBody(),
      message: 'WhatsApp Cloud API está configurado y listo.',
    })
  }

  private async handleDisconnect(
    userCode: string | undefined,
    deviceCode: string,
  ): Promise<WhatsAppChannelEventResult> {
    if (!userCode) {
      return jsonResult(200, {
        success: false,
        provider: this.name,
        status: 'error',
        message: 'No se pudo resolver el usuario para desactivar el canal meta-cloud.',
      })
    }

    const existing = await getMetaChannel(userCode, deviceCode)
    await upsertMetaChannel({
      userCode,
      deviceCode,
      status: 'disabled',
      mode: existing?.mode ?? null,
      enabled: false,
      phoneNumber: existing?.phoneNumber ?? null,
      phoneNumberId: existing?.phoneNumberId ?? null,
      wabaId: existing?.wabaId ?? null,
      webhookEnabled: existing?.webhookEnabled ?? false,
      automationEnabled: false,
      inboundForwardingEnabled: false,
      lastDisconnectedAt: new Date().toISOString(),
    })

    return jsonResult(200, {
      success: true,
      provider: this.name,
      status: 'disabled',
      message: 'El canal se desactivó lógicamente. Las credenciales de Meta no se revocan desde aquí.',
    })
  }

  private async handleStatus(
    userCode: string | undefined,
    deviceCode: string,
  ): Promise<WhatsAppChannelEventResult> {
    const config = getMetaCloudConfig()
    const persisted: MetaChannelRecord | null = userCode
      ? await getMetaChannel(userCode, deviceCode)
      : null

    return jsonResult(200, {
      success: true,
      provider: this.name,
      status: persisted?.status ?? (config.enabled ? 'not_configured' : 'not_configured'),
      enabled: persisted?.enabled ?? false,
      mode: persisted?.mode ?? null,
      configured: config.enabled,
      realSendEnabled: config.enabled ? config.allowRealSend : false,
      webhookEnabled: config.enabled ? config.webhookEnabled : false,
      inboundForwardingEnabled: persisted?.inboundForwardingEnabled ?? false,
      automationEnabled: persisted?.automationEnabled ?? false,
      lastInboundAt: persisted?.lastInboundAt ?? null,
      lastOutboundAt: persisted?.lastOutboundAt ?? null,
      lastError: persisted?.lastErrorCode
        ? { code: persisted.lastErrorCode, at: persisted.lastErrorAt }
        : null,
    })
  }

  private async handleTest(payload: unknown): Promise<WhatsAppChannelEventResult> {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      return jsonResult(200, {
        success: true,
        provider: this.name,
        status: 'not_configured',
        message: 'WhatsApp Cloud API no está habilitado todavía.',
      })
    }

    const testRecipient = extractTestRecipient(payload)
    if (!config.allowRealSend || !testRecipient) {
      return jsonResult(200, {
        success: true,
        provider: this.name,
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
      provider: this.name,
      status: 'connected',
      simulation: false,
      providerMessageId: result.providerMessageId,
    })
  }

  private async handlePreferences(
    userCode: string | undefined,
    deviceCode: string,
    payload: unknown,
  ): Promise<WhatsAppChannelEventResult> {
    if (!userCode) {
      return jsonResult(200, {
        success: true,
        provider: this.name,
        persisted: false,
        message: 'No se pudo resolver el usuario; las preferencias no se persistieron.',
      })
    }

    const existing = await getMetaChannel(userCode, deviceCode)
    if (!existing) {
      return jsonResult(200, {
        success: true,
        provider: this.name,
        persisted: false,
        message: 'El canal meta-cloud aún no está conectado para este usuario.',
      })
    }

    const preferences = asRecord(payload)?.preferences ?? asRecord(asRecord(payload)?.data)?.preferences
    await upsertMetaChannel({
      userCode,
      deviceCode,
      status: existing.status,
      mode: existing.mode,
      enabled: existing.enabled,
      phoneNumber: existing.phoneNumber,
      phoneNumberId: existing.phoneNumberId,
      wabaId: existing.wabaId,
      webhookEnabled: existing.webhookEnabled,
      automationEnabled: existing.automationEnabled,
      inboundForwardingEnabled: existing.inboundForwardingEnabled,
      providerMetadata: { ...(existing.providerMetadata ?? {}), preferences: preferences ?? null },
    })

    return jsonResult(200, {
      success: true,
      provider: this.name,
      persisted: true,
      message: 'Preferencias actualizadas para el canal meta-cloud.',
    })
  }
}
