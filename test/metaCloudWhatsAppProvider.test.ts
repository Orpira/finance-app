import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMetaCloudConfig, createMetaCloudClient, sendText, getMetaChannel, upsertMetaChannel } = vi.hoisted(() => ({
  getMetaCloudConfig: vi.fn(),
  createMetaCloudClient: vi.fn(),
  sendText: vi.fn(),
  getMetaChannel: vi.fn(),
  upsertMetaChannel: vi.fn(),
}))

vi.mock('../server/communication/config/metaCloudConfig', () => ({ getMetaCloudConfig }))
vi.mock('../server/communication/services/metaCloudClient', () => ({ createMetaCloudClient }))
vi.mock('../server/communication/repositories/metaChannelRepository', () => ({ getMetaChannel, upsertMetaChannel }))

import { MetaCloudWhatsAppProvider } from '../server/automation/providers/whatsapp/MetaCloudWhatsAppProvider'
import { UnsupportedProviderCapabilityError } from '../server/automation/providers/whatsapp/errors'

const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'

const DISABLED_CONFIG = {
  enabled: false, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  forwardStatusToN8n: false, messageRetentionDays: 0, idempotencyRetentionDays: 30,
}

const ENABLED_CONFIG = {
  enabled: true, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  forwardStatusToN8n: false, messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: 'secret', accessToken: 'token', verifyToken: 'verify',
  phoneNumberId: '1234567890', graphApiVersion: 'v21.0', n8nCommunicationApiKey: 'n8n-key',
}

function persistedChannel(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '1', userCode: USER_CODE, deviceCode: DEVICE_CODE, status: 'connected', mode: 'simulation',
    enabled: true, phoneNumber: '34600000000', phoneNumberId: '1234567890', wabaId: null,
    maskedPhoneNumber: null, displayName: null, webhookEnabled: false, automationEnabled: true,
    inboundForwardingEnabled: false, connectedAt: '2026-07-31T10:00:00.000Z', lastDisconnectedAt: null,
    lastSeenAt: null, lastInboundAt: null, lastOutboundAt: null, lastErrorCode: null, lastErrorAt: null,
    providerMetadata: {}, createdAt: '2026-07-31T10:00:00.000Z', updatedAt: '2026-07-31T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  getMetaCloudConfig.mockReset()
  createMetaCloudClient.mockReset()
  sendText.mockReset()
  getMetaChannel.mockReset()
  upsertMetaChannel.mockReset()
  createMetaCloudClient.mockReturnValue({ sendText })
  upsertMetaChannel.mockImplementation(async (input: Record<string, unknown>) => persistedChannel(input))
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
      event: 'communication.whatsapp.qr.requested', eventId: '1', payload: {}, deviceCode: DEVICE_CODE,
    })).rejects.toBeInstanceOf(UnsupportedProviderCapabilityError)
  })

  it('no simula un QR ni un pairing code en ningún otro evento de conexión', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: {},
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    const body = result.body as Record<string, unknown>
    expect(body.qrCode).toBeUndefined()
    expect(body.pairingCode).toBeUndefined()
  })
})

describe('MetaCloudWhatsAppProvider — connect/status/disconnect/preferences', () => {
  it('connect reporta not_configured cuando Cloud está deshabilitado, sin persistir nada', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: {},
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ success: true, status: 'not_configured' })
    expect(upsertMetaChannel).not.toHaveBeenCalled()
  })

  it('connect sin userCode resuelto no persiste y reporta error explícito', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: {}, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ success: false, status: 'error' })
    expect(upsertMetaChannel).not.toHaveBeenCalled()
  })

  it('connect persiste el canal por usuario/dispositivo y reporta connected', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested', eventId: '1', payload: { phoneNumber: '34600000000' },
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })

    expect(upsertMetaChannel).toHaveBeenCalledWith(expect.objectContaining({
      userCode: USER_CODE, deviceCode: DEVICE_CODE, status: 'connected', enabled: true,
      phoneNumber: '34600000000', mode: 'simulation',
    }))
    expect(result.body).toMatchObject({ success: true, status: 'connected', mode: 'simulation' })
  })

  it('status combina el canal persistido con la configuración global', async () => {
    getMetaCloudConfig.mockReturnValue({ ...ENABLED_CONFIG, allowRealSend: true })
    getMetaChannel.mockResolvedValue(persistedChannel({ enabled: true, mode: 'production' }))
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.status.requested', eventId: '1', payload: {},
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ enabled: true, realSendEnabled: true, mode: 'production' })
  })

  it('status sin canal persistido reporta enabled:false sin fallar', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    getMetaChannel.mockResolvedValue(null)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.status.requested', eventId: '1', payload: {},
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ enabled: false, configured: true })
  })

  it('disconnect desactiva lógicamente (status=disabled) sin afirmar que revocó credenciales de Meta', async () => {
    getMetaChannel.mockResolvedValue(persistedChannel())
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.disconnect.requested', eventId: '1', payload: {},
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    expect(upsertMetaChannel).toHaveBeenCalledWith(expect.objectContaining({
      status: 'disabled', enabled: false, automationEnabled: false,
    }))
    expect(result.body).toMatchObject({ success: true, status: 'disabled' })
  })

  it('preferences.updated persiste cuando el canal ya existe (persisted: true)', async () => {
    getMetaChannel.mockResolvedValue(persistedChannel())
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.preferences.updated', eventId: '1',
      payload: { preferences: { notifyIncomeCreated: true } },
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ persisted: true })
  })

  it('preferences.updated no afirma persistencia si el canal no está conectado', async () => {
    getMetaChannel.mockResolvedValue(null)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.preferences.updated', eventId: '1', payload: {},
      userCode: USER_CODE, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ persisted: false })
  })
})

describe('MetaCloudWhatsAppProvider — test.requested', () => {
  it('sin ALLOW_REAL_SEND ni destinatario de prueba, solo verifica configuración (simulation:true)', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.test.requested', eventId: '1', payload: {}, deviceCode: DEVICE_CODE,
    })
    expect(result.body).toMatchObject({ simulation: true })
    expect(sendText).not.toHaveBeenCalled()
  })

  it('con ALLOW_REAL_SEND=true pero sin destinatario explícito, sigue sin enviar de verdad', async () => {
    getMetaCloudConfig.mockReturnValue({ ...ENABLED_CONFIG, allowRealSend: true })
    const provider = new MetaCloudWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'communication.whatsapp.test.requested', eventId: '1', payload: {}, deviceCode: DEVICE_CODE,
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
      payload: { testRecipient: '34600000000' }, deviceCode: DEVICE_CODE,
    })
    expect(sendText).toHaveBeenCalledWith({ recipient: '34600000000', text: expect.any(String) })
    expect(result.body).toMatchObject({ simulation: false, providerMessageId: 'wamid.test' })
  })
})
