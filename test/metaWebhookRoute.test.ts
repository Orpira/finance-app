import { createHmac } from 'node:crypto'
import { Readable } from 'node:stream'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMetaCloudConfig, processNormalizedWebhookEvent } = vi.hoisted(() => ({
  getMetaCloudConfig: vi.fn(),
  processNormalizedWebhookEvent: vi.fn(),
}))

vi.mock('../server/communication/config/metaCloudConfig', () => ({ getMetaCloudConfig }))
vi.mock('../server/communication/services/metaWebhookService', () => ({ processNormalizedWebhookEvent }))

import webhookHandler from '../api/communication/meta/webhook'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'

const APP_SECRET = 'meta-app-secret'
const VERIFY_TOKEN = 'verify-token-123'

const ENABLED_CONFIG = {
  enabled: true, allowRealSend: false, webhookEnabled: true, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: APP_SECRET, accessToken: 't', verifyToken: VERIFY_TOKEN,
  phoneNumberId: '123', graphApiVersion: 'v21.0', n8nCommunicationApiKey: 'n8n-key',
}
const DISABLED_CONFIG = {
  enabled: false, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    headers: {} as Record<string, unknown>,
    status(statusCode: number) { this.statusCode = statusCode; return this },
    json(body: unknown) { this.body = body; return this },
    end(chunk?: unknown) { this.ended = true; if (chunk !== undefined) this.body = chunk; return this },
    setHeader(name: string, value: unknown) { this.headers[name] = value; return this },
  }
  return response as unknown as VercelResponse & typeof response
}

function createGetRequest(query: string) {
  return {
    method: 'GET',
    headers: {},
    url: `/api/communication/meta/webhook?${query}`,
  } as unknown as VercelRequest
}

function createPostRequest(bodyBuffer: Buffer, signature: string | undefined) {
  const request = Readable.from([bodyBuffer]) as unknown as VercelRequest & Record<string, unknown>
  Object.assign(request, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(signature ? { 'x-hub-signature-256': signature } : {}),
    },
    url: '/api/communication/meta/webhook',
  })
  return request as unknown as VercelRequest
}

function signBody(body: Buffer, secret = APP_SECRET) {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
}

beforeEach(() => {
  getMetaCloudConfig.mockReset()
  processNormalizedWebhookEvent.mockReset()
  processNormalizedWebhookEvent.mockResolvedValue({
    processedMessages: 0, duplicateMessages: 0, processedStatuses: 0, duplicateStatuses: 0, unknownEntries: 0,
  })
})

describe('GET /api/communication/meta/webhook — verificación', () => {
  it('devuelve hub.challenge con 200 cuando el modo y el token son correctos', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createGetRequest(`hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=CHALLENGE123`), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toBe('CHALLENGE123')
  })

  it('responde 403 cuando el verify_token es incorrecto', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createGetRequest('hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=CHALLENGE123'), response)

    expect(response.statusCode).toBe(403)
    expect(response.body).not.toBe('CHALLENGE123')
  })

  it('responde 403 cuando hub.mode no es "subscribe"', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createGetRequest(`hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=X`), response)

    expect(response.statusCode).toBe(403)
  })

  it('responde 403 cuando el webhook Cloud está deshabilitado, sin exigir n8n auth', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createGetRequest('hub.mode=subscribe&hub.verify_token=anything&hub.challenge=X'), response)

    expect(response.statusCode).toBe(403)
  })
})

describe('POST /api/communication/meta/webhook — validación de firma', () => {
  const payload = Buffer.from(JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ id: 'waba-1', changes: [{ field: 'messages', value: { messages: [] } }] }],
  }))

  it('acepta y procesa cuando la firma es correcta sobre el raw body', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createPostRequest(payload, signBody(payload)), response)

    expect(response.statusCode).toBe(200)
    expect(processNormalizedWebhookEvent).toHaveBeenCalledTimes(1)
  })

  it('rechaza con 401 cuando la firma es incorrecta, sin procesar el evento', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createPostRequest(payload, signBody(payload, 'otro-secreto')), response)

    expect(response.statusCode).toBe(401)
    expect(processNormalizedWebhookEvent).not.toHaveBeenCalled()
  })

  it('rechaza con 401 cuando la firma está ausente', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createPostRequest(payload, undefined), response)

    expect(response.statusCode).toBe(401)
    expect(processNormalizedWebhookEvent).not.toHaveBeenCalled()
  })

  it('responde 403 cuando el webhook Cloud está deshabilitado', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const response = createResponse()

    await webhookHandler(createPostRequest(payload, signBody(payload)), response)

    expect(response.statusCode).toBe(403)
    expect(processNormalizedWebhookEvent).not.toHaveBeenCalled()
  })

  it('un error de procesamiento no filtra al cliente: responde 200 igualmente', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    processNormalizedWebhookEvent.mockRejectedValue(new Error('fallo interno de normalización'))
    const response = createResponse()

    await webhookHandler(createPostRequest(payload, signBody(payload)), response)

    expect(response.statusCode).toBe(200)
  })
})
