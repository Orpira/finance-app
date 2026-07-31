import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMetaCloudConfig, createMetaCloudClient, sendText } = vi.hoisted(() => ({
  getMetaCloudConfig: vi.fn(),
  createMetaCloudClient: vi.fn(),
  sendText: vi.fn(),
}))

vi.mock('../server/communication/config/metaCloudConfig', () => ({ getMetaCloudConfig }))
vi.mock('../server/communication/services/metaCloudClient', () => ({ createMetaCloudClient }))

import { MetaCloudWhatsAppProvider } from '../server/automation/providers/whatsapp/MetaCloudWhatsAppProvider'
import { UnsupportedProviderCapabilityError } from '../server/automation/providers/whatsapp/errors'

const DISABLED_CONFIG = {
  enabled: false, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
}

const ENABLED_CONFIG = {
  enabled: true, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: 'secret', accessToken: 'token', verifyToken: 'verify',
  phoneNumberId: '1234567890', graphApiVersion: 'v21.0', n8nCommunicationApiKey: 'n8n-key',
}

beforeEach(() => {
  getMetaCloudConfig.mockReset()
  createMetaCloudClient.mockReset()
  sendText.mockReset()
  createMetaCloudClient.mockReturnValue({ sendText })
})

describe('MetaCloudWhatsAppProvider — capacidades', () => {
  it('declara las capacidades reales de Cloud API (sin QR ni pairing code)', () => {
    const provider = new MetaCloudWhatsAppProvider()
    expect(provider.getCapabilities()).toEqual({
      supportsQr: false,
      supportsPairingCode: false,
      supportsTemplates: true,
      supportsMessageStatus: true,
      supportsInboundWebhooks: true,
      supportsCoexistence: false,
    })
  })
})

describe('MetaCloudWhatsAppProvider — QR y pairing code no soportados', () => {
  it('communication.whatsapp.qr.requested lanza UnsupportedProviderCapabilityError', async () => {
    const provider = new MetaCloudWhatsAppProvider()
    await expect(provider.dispatchChannelEvent({
      event: 'communication.whatsapp.qr.requested', eventId: '1', payload: {},
    })).rejects.toBeInstanceOf(UnsupportedProviderCapabilityError)
  })

  it('no simula un QR ni un pairing code en ningún otro evento de conexión', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: {},
    })
    const body = result.body as Record<string, unknown>
    expect(body.qrCode).toBeUndefined()
    expect(body.pairingCode).toBeUndefined()
  })
})

describe('MetaCloudWhatsAppProvider — connect/status/disconnect/preferences', () => {
  it('connect reporta not_configured cuando Cloud está deshabilitado', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ success: true, status: 'not_configured' })
  })

  it('connect reporta connected cuando Cloud está habilitado y configurado', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ success: true, status: 'connected' })
  })

  it('status refleja enabled/realSendEnabled desde la configuración', async () => {
    getMetaCloudConfig.mockReturnValue({ ...ENABLED_CONFIG, allowRealSend: true })
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.status.requested', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ enabled: true, realSendEnabled: true })
  })

  it('disconnect desactiva lógicamente sin afirmar que revocó credenciales de Meta', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.disconnect.requested', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ success: true, status: 'disconnected' })
  })

  it('preferences.updated no afirma persistencia que todavía no implementa', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.preferences.updated', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ persisted: false })
  })
})

describe('MetaCloudWhatsAppProvider — test.requested', () => {
  it('sin ALLOW_REAL_SEND ni destinatario de prueba, solo verifica configuración (simulation:true)', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.test.requested', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ simulation: true })
    expect(sendText).not.toHaveBeenCalled()
  })

  it('con ALLOW_REAL_SEND=true pero sin destinatario explícito, sigue sin enviar de verdad', async () => {
    getMetaCloudConfig.mockReturnValue({ ...ENABLED_CONFIG, allowRealSend: true })
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.test.requested', eventId: '1', payload: {},
    })
    expect(result.body).toMatchObject({ simulation: true })
    expect(sendText).not.toHaveBeenCalled()
  })

  it('con ALLOW_REAL_SEND=true y destinatario de prueba explícito, envía un mensaje real vía metaCloudClient', async () => {
    getMetaCloudConfig.mockReturnValue({ ...ENABLED_CONFIG, allowRealSend: true })
    sendText.mockResolvedValue({ providerMessageId: 'wamid.test' })
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.test.requested', eventId: '1',
      payload: { testRecipient: '34600000000' },
    })
    expect(sendText).toHaveBeenCalledWith({ recipient: '34600000000', text: expect.any(String) })
    expect(result.body).toMatchObject({ simulation: false, providerMessageId: 'wamid.test' })
  })
})
