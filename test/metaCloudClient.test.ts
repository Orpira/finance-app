import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createMetaCloudClient } from '../server/communication/services/metaCloudClient'
import {
  CommunicationAuthenticationError,
  CommunicationProviderError,
  CommunicationProviderUnavailableError,
  CommunicationRateLimitError,
} from '../server/communication/errors/communicationErrors'

const CONFIG = {
  accessToken: 'super-secret-token',
  phoneNumberId: '1234567890',
  graphApiVersion: 'v21.0',
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('metaCloudClient — construcción de la solicitud', () => {
  it('construye la URL de Graph API con versión y phoneNumberId, y agrega el Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { messages: [{ id: 'wamid.TEST' }] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const client = createMetaCloudClient(CONFIG)
    await client.sendText({ recipient: '34600000000', text: 'hola' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v21.0/1234567890/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer super-secret-token',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('sendText envía el payload de texto de Graph API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid.1' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createMetaCloudClient(CONFIG)
    const result = await client.sendText({ recipient: '34600000000', text: 'Hola mundo' })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '34600000000',
      type: 'text',
      text: { body: 'Hola mundo' },
    })
    expect(result).toEqual({ providerMessageId: 'wamid.1' })
  })

  it('sendTemplate envía el payload de plantilla de Graph API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { messages: [{ id: 'wamid.2' }] }))
    vi.stubGlobal('fetch', fetchMock)

    const client = createMetaCloudClient(CONFIG)
    await client.sendTemplate({
      recipient: '34600000000', templateName: 'income_registered', languageCode: 'es', components: [],
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp',
      to: '34600000000',
      type: 'template',
      template: { name: 'income_registered', language: { code: 'es' }, components: [] },
    })
  })

  it('markAsRead envía el payload de estado leído', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}))
    vi.stubGlobal('fetch', fetchMock)

    const client = createMetaCloudClient(CONFIG)
    await client.markAsRead('wamid.3')

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({
      messaging_product: 'whatsapp', status: 'read', message_id: 'wamid.3',
    })
  })
})

describe('metaCloudClient — normalización de errores', () => {
  it.each([401, 403])('mapea el status %i a CommunicationAuthenticationError', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { error: { message: 'denied', code: status } })))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toBeInstanceOf(CommunicationAuthenticationError)
  })

  it('mapea el status 429 a CommunicationRateLimitError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(429, { error: { message: 'limited' } })))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toBeInstanceOf(CommunicationRateLimitError)
  })

  it.each([400, 422])('mapea errores de cliente (%i) a CommunicationProviderError', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, { error: { message: 'bad request' } })))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toBeInstanceOf(CommunicationProviderError)
  })

  it('mapea errores de servidor (500) a CommunicationProviderError con status 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: { message: 'boom' } })))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' }))
      .rejects.toMatchObject({ status: 502 })
  })

  it('un timeout se normaliza como CommunicationProviderUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      return Promise.reject(error)
    }))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toBeInstanceOf(CommunicationProviderUnavailableError)
  })

  it('un fallo de red se normaliza como CommunicationProviderUnavailableError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toBeInstanceOf(CommunicationProviderUnavailableError)
  })

  it('si Meta no devuelve un id de mensaje, lanza CommunicationProviderError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {})))
    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toBeInstanceOf(CommunicationProviderError)
  })
})

describe('metaCloudClient — no expone el token en los logs', () => {
  it('los logs de fallo no contienen el access token', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, { error: { message: 'boom' } })))

    const client = createMetaCloudClient(CONFIG)
    await expect(client.sendText({ recipient: '1', text: 'x' })).rejects.toThrow()

    const loggedText = infoSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n')
    expect(loggedText).not.toContain(CONFIG.accessToken)
  })
})
