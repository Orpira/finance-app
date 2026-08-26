import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resolveActiveWhatsAppProvider, dispatchChannelEvent } = vi.hoisted(() => ({
  resolveActiveWhatsAppProvider: vi.fn(),
  dispatchChannelEvent: vi.fn(),
}))

const { dispatchWebhook } = vi.hoisted(() => ({
  dispatchWebhook: vi.fn(),
}))

vi.mock('../server/automation/providers/whatsapp/WhatsAppProviderFactory', () => ({ resolveActiveWhatsAppProvider }))

vi.mock('../server/automation/webhookDispatcher', () => ({ dispatchWebhook }))

import {
  AutomationIdentityMismatchError,
  dispatchAutomationEvent,
} from '../server/automation/eventDispatcher'
import * as communicationResolver from '../server/automation/communicationResolver'
import type { AutomationEnvelope } from '../server/automation/eventTypes'

const EVENT_ID = '11111111-1111-4111-8111-111111111111'
const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'
const SPOOFED_USER_CODE = 'PB-USER-99999999-9999-4999-8999-999999999999'
const SPOOFED_DEVICE_CODE = 'PB-DEVICE-99999999-9999-4999-8999-999999999999'

function envelope(event: AutomationEnvelope['event'], data: Record<string, unknown>): AutomationEnvelope {
  return {
    eventId: EVENT_ID, event, createdAt: '2026-07-31T10:00:00.000Z', schemaVersion: 1,
    source: 'private-balance-pwa', data,
  }
}

function identity() {
  return { userCode: USER_CODE, deviceCode: DEVICE_CODE }
}

beforeEach(() => {
  resolveActiveWhatsAppProvider.mockReset()
  dispatchChannelEvent.mockReset()
  dispatchWebhook.mockReset()
  vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel').mockReset()
  resolveActiveWhatsAppProvider.mockReturnValue({ dispatchChannelEvent })
  dispatchChannelEvent.mockResolvedValue({ status: 200, body: { success: true }, empty: false, successful: true })
  dispatchWebhook.mockResolvedValue({ status: 202, body: { queued: true }, empty: false, successful: true })
})

describe('eventDispatcher — identidad canónica (PB-SEC-001)', () => {
  it('connect pasa la identidad canónica del servidor al proveedor', async () => {
    await dispatchAutomationEvent({
      envelope: envelope('device.whatsapp.connect.requested', { userCode: USER_CODE, deviceCode: DEVICE_CODE }),
      identity: identity(),
    })

    expect(dispatchChannelEvent).toHaveBeenCalledWith(expect.objectContaining({
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
    }))
  })

  it('connect con userCode ajeno en data se rechaza fail-closed sin invocar al proveedor', async () => {
    await expect(dispatchAutomationEvent({
      envelope: envelope('device.whatsapp.connect.requested', { userCode: SPOOFED_USER_CODE, deviceCode: DEVICE_CODE }),
      identity: identity(),
    })).rejects.toBeInstanceOf(AutomationIdentityMismatchError)

    expect(dispatchChannelEvent).not.toHaveBeenCalled()
  })

  it('status.requested con deviceCode ajeno se rechaza aunque el userCode coincida', async () => {
    await expect(dispatchAutomationEvent({
      envelope: envelope('communication.whatsapp.status.requested', { userCode: USER_CODE, deviceCode: SPOOFED_DEVICE_CODE }),
      identity: identity(),
    })).rejects.toBeInstanceOf(AutomationIdentityMismatchError)

    expect(dispatchChannelEvent).not.toHaveBeenCalled()
  })

  it('userCode spoofed dentro de data.payload se rechaza', async () => {
    await expect(dispatchAutomationEvent({
      envelope: envelope('communication.whatsapp.test.requested', {
        payload: { userCode: SPOOFED_USER_CODE },
      }),
      identity: identity(),
    })).rejects.toBeInstanceOf(AutomationIdentityMismatchError)

    expect(dispatchChannelEvent).not.toHaveBeenCalled()
  })

  it('userCode spoofed en la raíz del envelope se rechaza', async () => {
    await expect(dispatchAutomationEvent({
      envelope: {
        ...envelope('communication.whatsapp.disconnect.requested', {}),
        userCode: SPOOFED_USER_CODE,
      },
      identity: identity(),
    })).rejects.toBeInstanceOf(AutomationIdentityMismatchError)

    expect(dispatchChannelEvent).not.toHaveBeenCalled()
  })

  it('evento sin identidad cliente usa exclusivamente la identidad canónica', async () => {
    await dispatchAutomationEvent({
      envelope: envelope('communication.whatsapp.test.requested', {}),
      identity: identity(),
    })

    expect(dispatchChannelEvent).toHaveBeenCalledWith(expect.objectContaining({
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
    }))
  })

  it('income.created resuelve el canal con el userCode canónico, no con el del cliente', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')
      .mockResolvedValue(null)

    await dispatchAutomationEvent({
      envelope: envelope('income.created', { income: { id: 1 }, userCode: USER_CODE }),
      identity: identity(),
    })

    expect(resolveSpy).toHaveBeenCalledWith(USER_CODE)
    resolveSpy.mockRestore()
  })

  it('income.created con userCode ajeno anidado se rechaza antes de resolver canal o webhook', async () => {
    const resolveSpy = vi.spyOn(communicationResolver, 'resolveActiveWhatsappChannel')

    await expect(dispatchAutomationEvent({
      envelope: envelope('income.created', {
        income: { id: 1 },
        payload: { userCode: SPOOFED_USER_CODE },
      }),
      identity: identity(),
    })).rejects.toBeInstanceOf(AutomationIdentityMismatchError)

    expect(resolveSpy).not.toHaveBeenCalled()
    expect(dispatchWebhook).not.toHaveBeenCalled()
    resolveSpy.mockRestore()
  })
})
