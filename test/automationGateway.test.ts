import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dispatchWebhook } = vi.hoisted(() => ({
  dispatchWebhook: vi.fn(),
}))

vi.mock('../server/automation/webhookDispatcher', () => ({
  dispatchWebhook,
}))

import {
  buildN8nPayload,
  dispatchAutomationEvent,
} from '../server/automation/eventDispatcher'
import {
  AUTOMATION_EVENT_TYPES,
  isSynchronousAutomationEvent,
  type AutomationEnvelope,
} from '../server/automation/eventTypes'
import * as communicationResolver from '../server/automation/communicationResolver'

const EVENT_ID = '11111111-1111-4111-8111-111111111111'
const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'
const ROOT_DEVICE_CODE = 'PB-9DB2-FBCE-EA10'

function envelope(
  event: AutomationEnvelope['event'],
  data: Record<string, unknown> = {},
): AutomationEnvelope {
  return {
    eventId: EVENT_ID,
    event,
    createdAt: '2026-07-02T20:00:00.000Z',
    schemaVersion: 1,
    source: 'private-balance-pwa',
    data,
    timezone: 'Europe/Madrid',
    locale: 'es-ES',
  }
}

beforeEach(() => {
  dispatchWebhook.mockReset()
})

describe('Automation Gateway dispatcher', () => {
  it('mantiene todos los eventos actuales y el evento QR legado', () => {
    expect(AUTOMATION_EVENT_TYPES).toContain('income.created')
    expect(AUTOMATION_EVENT_TYPES).toContain('service.completed')
    expect(AUTOMATION_EVENT_TYPES).toContain('device.whatsapp.connect.requested')
    expect(AUTOMATION_EVENT_TYPES).toContain('communication.whatsapp.qr.requested')
  })

  it('confirma los eventos financieros asíncronos con accepted y eventId', async () => {
    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('income.created', { income: { id: 1 } }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
  })

  it('mantiene WhatsApp connect síncrono y devuelve directamente el JSON de n8n', async () => {
    const n8nBody = {
      status: 'connecting',
      qrCode: 'data:image/png;base64,AAAA',
    }
    dispatchWebhook.mockResolvedValue({
      status: 200,
      body: n8nBody,
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('device.whatsapp.connect.requested', {
        userCode: USER_CODE,
        deviceCode: DEVICE_CODE,
        phoneNumber: '34600111222',
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(isSynchronousAutomationEvent('device.whatsapp.connect.requested')).toBe(true)
    expect(result).toEqual({ status: 200, body: n8nBody, empty: false })
  })

  it('conserva el payload reducido de WhatsApp connect', () => {
    const payload = buildN8nPayload(
      envelope('device.whatsapp.connect.requested', {
        userCode: USER_CODE,
        deviceCode: DEVICE_CODE,
        phoneNumber: '34600111222',
      }),
      DEVICE_CODE,
    )

    expect(payload).toEqual({
      event: 'device.whatsapp.connect.requested',
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
      phoneNumber: '34600111222',
      timezone: 'Europe/Madrid',
      locale: 'es-ES',
    })
  })
})

describe('Communication resolver opcional', () => {
  it('no falla si Neon no está configurado', async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL
    delete process.env.DATABASE_URL

    try {
      await expect(communicationResolver.resolveActiveCommunicationChannels(USER_CODE)).resolves.toEqual([])
      await expect(communicationResolver.resolveActiveWhatsappChannel(USER_CODE)).resolves.toBeNull()
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl
      }
    }
  })

  it('income.created sin canal conectado mantiene el comportamiento actual', async () => {
    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('income.created', {
        income: { id: 1 },
        userCode: USER_CODE,
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'income.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'income.created',
        deviceCode: DEVICE_CODE,
        receivedAt: expect.any(String),
        source: 'private-balance-pwa',
      }),
    })
  })

  it('income.created con canal WhatsApp conectado agrega communicationChannel, instanceName y whatsappNumber al payload', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue({
        id: '1',
        userCode: USER_CODE,
        provider: 'whatsapp',
        status: 'connected',
        instanceName: 'default',
        phoneNumber: '+34123456789',
        preferences: { notify: true },
        providerMetadata: { api: 'whatsapp' },
      })

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('income.created', {
        income: { id: 1 },
        userCode: USER_CODE,
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(resolveSpy).toHaveBeenCalledWith(USER_CODE)
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'income.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'income.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
        instanceName: 'default',
        whatsappNumber: '+34123456789',
        communicationChannel: {
          provider: 'whatsapp',
          instanceName: 'default',
          phoneNumber: '+34123456789',
          status: 'connected',
          preferences: { notify: true },
          providerMetadata: { api: 'whatsapp' },
        },
      }),
    })

    resolveSpy.mockRestore()
  })

  it('expense.created sin canal conectado mantiene el comportamiento actual', async () => {
    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('expense.created', {
        expense: { id: 1 },
        userCode: USER_CODE,
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'expense.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'expense.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
      }),
    })
  })

  it('expense.created con canal WhatsApp conectado agrega communicationChannel, instanceName y whatsappNumber al payload', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue({
        id: '2',
        userCode: USER_CODE,
        provider: 'whatsapp',
        status: 'connected',
        instanceName: 'default',
        phoneNumber: '+34123456789',
        preferences: { notify: false },
        providerMetadata: { api: 'whatsapp' },
      })

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('expense.created', {
        expense: { id: 1 },
        userCode: USER_CODE,
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(resolveSpy).toHaveBeenCalledWith(USER_CODE)
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'expense.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'expense.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
        instanceName: 'default',
        whatsappNumber: '+34123456789',
        communicationChannel: {
          provider: 'whatsapp',
          instanceName: 'default',
          phoneNumber: '+34123456789',
          status: 'connected',
          preferences: { notify: false },
          providerMetadata: { api: 'whatsapp' },
        },
      }),
    })

    resolveSpy.mockRestore()
  })

  it('calendar.created sin canal conectado mantiene el comportamiento actual', async () => {
    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('calendar.created', {
        calendar: { id: 1 },
        userCode: USER_CODE,
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'calendar.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'calendar.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
      }),
    })
  })

  it('calendar.created con canal WhatsApp conectado agrega communicationChannel, instanceName y whatsappNumber al payload', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue({
        id: '3',
        userCode: USER_CODE,
        provider: 'whatsapp',
        status: 'connected',
        instanceName: 'default',
        phoneNumber: '+34123456789',
        preferences: { notify: true },
        providerMetadata: { api: 'whatsapp' },
      })

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('calendar.created', {
        calendar: { id: 1 },
        userCode: USER_CODE,
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(resolveSpy).toHaveBeenCalledWith(USER_CODE)
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'calendar.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'calendar.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
        instanceName: 'default',
        whatsappNumber: '+34123456789',
        communicationChannel: {
          provider: 'whatsapp',
          instanceName: 'default',
          phoneNumber: '+34123456789',
          status: 'connected',
          preferences: { notify: true },
          providerMetadata: { api: 'whatsapp' },
        },
      }),
    })

    resolveSpy.mockRestore()
  })

  it('income.created extrae userCode desde envelope.data.data?.userCode', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue({
        id: '4',
        userCode: USER_CODE,
        provider: 'whatsapp',
        status: 'connected',
        instanceName: 'default',
        phoneNumber: '+34123456789',
        preferences: {},
        providerMetadata: {},
      })

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    await dispatchAutomationEvent({
      envelope: envelope('income.created', {
        income: { id: 1 },
        data: { userCode: USER_CODE },
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(resolveSpy).toHaveBeenCalledWith(USER_CODE)
    resolveSpy.mockRestore()
  })

  it('income.created extrae userCode desde envelope.data.payload?.userCode', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue({
        id: '5',
        userCode: USER_CODE,
        provider: 'whatsapp',
        status: 'connected',
        instanceName: 'default',
        phoneNumber: '+34123456789',
        preferences: {},
        providerMetadata: {},
      })

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    await dispatchAutomationEvent({
      envelope: envelope('income.created', {
        income: { id: 1 },
        payload: { userCode: USER_CODE },
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(resolveSpy).toHaveBeenCalledWith(USER_CODE)
    resolveSpy.mockRestore()
  })

  it('income.created con deviceCode en la raíz resuelve userCode y agrega los datos del canal', async () => {
    const resolveUserCodeSpy = vi.spyOn(communicationResolver, 'resolveUserCodeFromDeviceCode')
      .mockResolvedValue(USER_CODE)
    
    const resolveWhatsappSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue({
        id: '6',
        userCode: USER_CODE,
        provider: 'whatsapp',
        status: 'connected',
        instanceName: 'default',
        phoneNumber: '+34123456789',
        preferences: { notify: true },
        providerMetadata: { api: 'whatsapp' },
      })

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: {
        ...envelope('income.created', { income: { id: 1 } }),
        deviceCode: ROOT_DEVICE_CODE,
      },
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(resolveUserCodeSpy).toHaveBeenCalledWith(ROOT_DEVICE_CODE)
    expect(resolveWhatsappSpy).toHaveBeenCalledWith(USER_CODE)
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'income.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'income.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
        instanceName: 'default',
        whatsappNumber: '+34123456789',
        communicationChannel: {
          provider: 'whatsapp',
          instanceName: 'default',
          phoneNumber: '+34123456789',
          status: 'connected',
          preferences: { notify: true },
          providerMetadata: { api: 'whatsapp' },
        },
      }),
    })

    resolveUserCodeSpy.mockRestore()
    resolveWhatsappSpy.mockRestore()
  })

  it('income.created sin deviceCode encontrado mantiene comportamiento actual sin fallar', async () => {
    const resolveUserCodeSpy = vi.spyOn(communicationResolver, 'resolveUserCodeFromDeviceCode')
      .mockResolvedValue(null)

    dispatchWebhook.mockResolvedValue({
      status: 202,
      body: { queued: true },
      empty: false,
      successful: true,
    })

    const result = await dispatchAutomationEvent({
      envelope: envelope('income.created', {
        income: { id: 1 },
        // No userCode en envelope
      }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(result).toEqual({
      status: 202,
      body: { accepted: true, eventId: EVENT_ID },
      empty: false,
    })
    expect(resolveUserCodeSpy).toHaveBeenCalledWith(DEVICE_CODE)
    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'income.created',
      eventId: EVENT_ID,
      payload: expect.objectContaining({
        event: 'income.created',
        deviceCode: DEVICE_CODE,
        source: 'private-balance-pwa',
      }),
    })

    resolveUserCodeSpy.mockRestore()
  })
})
