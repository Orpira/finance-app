import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { forwardInboundMessage, forwardMessageStatus } from '../server/communication/services/n8nInboundForwarder'
import type { NormalizedInboundWhatsAppMessage, NormalizedWhatsAppMessageStatus } from '../server/communication/contracts/metaWebhook'

const ENV_KEYS = ['N8N_WHATSAPP_INBOUND_WEBHOOK_URL', 'N8N_WHATSAPP_STATUS_WEBHOOK_URL', 'N8N_WHATSAPP_FORWARD_AUTH_TOKEN']

const MESSAGE: NormalizedInboundWhatsAppMessage = {
  provider: 'meta-cloud', providerMessageId: 'wamid.1', phoneNumberId: 'pnid-1',
  senderPhone: '34600000000', timestamp: '2026-07-31T10:00:00.000Z', type: 'text', text: 'Hola',
}

const STATUS: NormalizedWhatsAppMessageStatus = {
  provider: 'meta-cloud', providerMessageId: 'wamid.1', status: 'delivered', timestamp: '2026-07-31T10:01:00.000Z',
}

function setForwarderEnv() {
  process.env.N8N_WHATSAPP_INBOUND_WEBHOOK_URL = 'https://n8n.example/webhook/inbound'
  process.env.N8N_WHATSAPP_STATUS_WEBHOOK_URL = 'https://n8n.example/webhook/status'
  process.env.N8N_WHATSAPP_FORWARD_AUTH_TOKEN = 'forward-token'
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
})

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('forwardInboundMessage', () => {
  it('no reenvía si N8N_WHATSAPP_INBOUND_WEBHOOK_URL o el token no están configurados', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await forwardInboundMessage(MESSAGE)

    expect(result).toEqual({ forwarded: false, reason: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reenvía con el contrato normalizado y el Bearer token, sin el texto crudo de Meta', async () => {
    setForwarderEnv()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await forwardInboundMessage(MESSAGE)

    expect(result).toEqual({ forwarded: true, status: 200 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://n8n.example/webhook/inbound')
    expect(init.headers.Authorization).toBe('Bearer forward-token')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      event: 'whatsapp.message.received',
      provider: 'meta-cloud',
      message: { providerMessageId: 'wamid.1', senderPhone: '34600000000', text: 'Hola' },
    })
  })

  it.each([429, 500, 502, 503, 504])('clasifica el status %i como reintentable', async (status) => {
    setForwarderEnv()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })))
    const result = await forwardInboundMessage(MESSAGE)
    expect(result).toMatchObject({ forwarded: false, retryable: true })
  })

  it.each([400, 401, 403])('clasifica el status %i como no reintentable', async (status) => {
    setForwarderEnv()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status })))
    const result = await forwardInboundMessage(MESSAGE)
    expect(result).toMatchObject({ forwarded: false, retryable: false })
  })

  it('un timeout se clasifica como reintentable', async () => {
    setForwarderEnv()
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    }))
    const result = await forwardInboundMessage(MESSAGE)
    expect(result).toMatchObject({ forwarded: false, retryable: true, reason: 'timeout' })
  })

  it('rechaza una URL de reenvío que no sea HTTPS', async () => {
    process.env.N8N_WHATSAPP_INBOUND_WEBHOOK_URL = 'http://n8n.example/webhook/inbound'
    process.env.N8N_WHATSAPP_FORWARD_AUTH_TOKEN = 'forward-token'
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await forwardInboundMessage(MESSAGE)
    expect(result).toEqual({ forwarded: false, reason: 'not_configured' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('forwardMessageStatus', () => {
  it('no reenvía si N8N_WHATSAPP_STATUS_WEBHOOK_URL no está configurado', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await forwardMessageStatus(STATUS)
    expect(result).toEqual({ forwarded: false, reason: 'not_configured' })
  })

  it('reenvía el estado normalizado con el contrato esperado', async () => {
    setForwarderEnv()
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await forwardMessageStatus(STATUS)

    expect(result).toEqual({ forwarded: true, status: 200 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://n8n.example/webhook/status')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      event: 'whatsapp.message.status.updated',
      status: { providerMessageId: 'wamid.1', state: 'delivered' },
    })
  })
})
