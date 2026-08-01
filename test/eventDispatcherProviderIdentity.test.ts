import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveActiveWhatsAppProvider, dispatchChannelEvent } = vi.hoisted(() => ({
  resolveActiveWhatsAppProvider: vi.fn(),
  dispatchChannelEvent: vi.fn(),
}))

vi.mock('../server/automation/providers/whatsapp/WhatsAppProviderFactory', () => ({ resolveActiveWhatsAppProvider }))

import { dispatchAutomationEvent } from '../server/automation/eventDispatcher'
import type { AutomationEnvelope } from '../server/automation/eventTypes'

const EVENT_ID = '11111111-1111-4111-8111-111111111111'
const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'

function envelope(event: AutomationEnvelope['event'], data: Record<string, unknown>): AutomationEnvelope {
  return {
    eventId: EVENT_ID, event, createdAt: '2026-07-31T10:00:00.000Z', schemaVersion: 1,
    source: 'private-balance-pwa', data,
  }
}

beforeEach(() => {
  resolveActiveWhatsAppProvider.mockReset()
  dispatchChannelEvent.mockReset()
  resolveActiveWhatsAppProvider.mockReturnValue({ dispatchChannelEvent })
  dispatchChannelEvent.mockResolvedValue({ status: 200, body: { success: true }, empty: false, successful: true })
})

describe('eventDispatcher — resolución de identidad para el proveedor de WhatsApp (Fase 4)', () => {
  it('pasa userCode (resuelto desde el payload) y deviceCode (del JWT) al proveedor en connect', async () => {
    await dispatchAutomationEvent({
      envelope: envelope('device.whatsapp.connect.requested', { userCode: USER_CODE, deviceCode: DEVICE_CODE }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(dispatchChannelEvent).toHaveBeenCalledWith(expect.objectContaining({
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
    }))
  })

  it('deviceCode siempre proviene del JWT autenticado (licenseDeviceCode), no del payload', async () => {
    const spoofedDeviceCode = 'PB-DEVICE-99999999-9999-4999-8999-999999999999'
    await dispatchAutomationEvent({
      envelope: envelope('communication.whatsapp.status.requested', { userCode: USER_CODE, deviceCode: spoofedDeviceCode }),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(dispatchChannelEvent).toHaveBeenCalledWith(expect.objectContaining({
      deviceCode: DEVICE_CODE,
    }))
  })

  it('userCode queda undefined si no se puede resolver desde el payload ni desde deviceCode', async () => {
    await dispatchAutomationEvent({
      envelope: envelope('communication.whatsapp.test.requested', {}),
      licenseDeviceCode: DEVICE_CODE,
    })

    expect(dispatchChannelEvent).toHaveBeenCalledWith(expect.objectContaining({
      userCode: undefined,
      deviceCode: DEVICE_CODE,
    }))
  })
})
