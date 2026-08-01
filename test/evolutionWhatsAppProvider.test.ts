import { beforeEach, describe, expect, it, vi } from 'vitest'

const { dispatchWebhook } = vi.hoisted(() => ({
  dispatchWebhook: vi.fn(),
}))

vi.mock('../server/automation/webhookDispatcher', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/automation/webhookDispatcher')>()
  return {
    ...actual,
    dispatchWebhook,
  }
})

import { EvolutionWhatsAppProvider } from '../server/automation/providers/whatsapp/EvolutionWhatsAppProvider'
import { WhatsAppProviderUnavailableError } from '../server/automation/providers/whatsapp/errors'
import { WebhookDispatchError } from '../server/automation/webhookDispatcher'

const EVENT_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  dispatchWebhook.mockReset()
})

describe('EvolutionWhatsAppProvider', () => {
  it('declara las capacidades confirmadas en la auditoría (QR y pairing code, sin plantillas)', () => {
    const provider = new EvolutionWhatsAppProvider()
    expect(provider.getCapabilities()).toEqual({
      supportsQr: true,
      supportsPairingCode: true,
      supportsTemplates: false,
      supportsMessageStatus: false,
      supportsInboundWebhooks: true,
      supportsCoexistence: false,
    })
  })

  it('delega el envío del evento de canal al webhook de n8n sin transformar el payload', async () => {
    dispatchWebhook.mockResolvedValue({
      status: 200,
      body: { status: 'connecting', qrCode: 'data:image/png;base64,AAAA' },
      empty: false,
      successful: true,
    })

    const provider = new EvolutionWhatsAppProvider()
    const result = await provider.dispatchChannelEvent({
      event: 'device.whatsapp.connect.requested',
      eventId: EVENT_ID,
      payload: { event: 'device.whatsapp.connect.requested', userCode: 'PB-USER-x' },
    })

    expect(dispatchWebhook).toHaveBeenCalledWith({
      event: 'device.whatsapp.connect.requested',
      eventId: EVENT_ID,
      payload: { event: 'device.whatsapp.connect.requested', userCode: 'PB-USER-x' },
    })
    expect(result).toEqual({
      status: 200,
      body: { status: 'connecting', qrCode: 'data:image/png;base64,AAAA' },
      empty: false,
      successful: true,
    })
  })

  it('propaga WebhookDispatchError sin envolverlo, para no romper /api/automation', async () => {
    const originalError = new WebhookDispatchError('Falta configurar N8N_WHATSAPP_WEBHOOK_URL.', 503)
    dispatchWebhook.mockRejectedValue(originalError)

    const provider = new EvolutionWhatsAppProvider()
    await expect(provider.dispatchChannelEvent({
      event: 'communication.whatsapp.status.requested',
      eventId: EVENT_ID,
      payload: {},
    })).rejects.toBe(originalError)
  })

  it('normaliza cualquier otro error inesperado como WhatsAppProviderUnavailableError', async () => {
    dispatchWebhook.mockRejectedValue(new TypeError('fetch is not defined'))

    const provider = new EvolutionWhatsAppProvider()
    await expect(provider.dispatchChannelEvent({
      event: 'communication.whatsapp.test.requested',
      eventId: EVENT_ID,
      payload: {},
    })).rejects.toBeInstanceOf(WhatsAppProviderUnavailableError)
  })
})
