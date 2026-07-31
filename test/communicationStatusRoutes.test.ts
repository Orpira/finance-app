import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getMetaCloudConfig } = vi.hoisted(() => ({ getMetaCloudConfig: vi.fn() }))
vi.mock('../server/communication/config/metaCloudConfig', () => ({ getMetaCloudConfig }))

import actionHandler from '../api/communication/whatsapp/[action]'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'

const healthHandler = (request: VercelRequest, response: VercelResponse) =>
  actionHandler({ ...request, query: { action: 'health' } } as VercelRequest, response)
const statusHandler = (request: VercelRequest, response: VercelResponse) =>
  actionHandler({ ...request, query: { action: 'status' } } as VercelRequest, response)

const DISABLED_CONFIG = {
  enabled: false, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
}
const ENABLED_CONFIG = {
  enabled: true, allowRealSend: true, webhookEnabled: true, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: 's', accessToken: 't', verifyToken: 'v',
  phoneNumberId: '123', graphApiVersion: 'v21.0', n8nCommunicationApiKey: 'n8n-key',
}

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    status(statusCode: number) { this.statusCode = statusCode; return this },
    json(body: unknown) { this.body = body; return this },
    end() { return this },
    setHeader(name: string, value: unknown) { this.headers[name] = value; return this },
  }
  return response as unknown as VercelResponse & typeof response
}

function createRequest(headers: Record<string, string> = {}) {
  return { method: 'GET', headers } as unknown as VercelRequest
}

beforeEach(() => {
  getMetaCloudConfig.mockReset()
  delete process.env.N8N_COMMUNICATION_API_KEY
})

afterEach(() => {
  delete process.env.N8N_COMMUNICATION_API_KEY
})

describe('GET /api/communication/whatsapp/health', () => {
  it('no expone secretos, solo flags booleanas', async () => {
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await healthHandler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      status: 'ok', provider: 'meta-cloud', enabled: true, realSendEnabled: true, webhookEnabled: true,
    })
  })

  it('reporta enabled:false cuando Cloud está deshabilitado, sin exigir autenticación', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const response = createResponse()

    await healthHandler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ enabled: false })
  })
})

describe('GET /api/communication/whatsapp/status', () => {
  it('sin N8N_COMMUNICATION_API_KEY configurado y con Cloud deshabilitado, no exige autenticación', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const response = createResponse()

    await statusHandler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ configured: false, enabled: false })
  })

  it('con N8N_COMMUNICATION_API_KEY configurado, exige Authorization válido', async () => {
    process.env.N8N_COMMUNICATION_API_KEY = 'expected-key'
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await statusHandler(createRequest({}), response)

    expect(response.statusCode).toBe(401)
  })

  it('con Authorization correcto, devuelve el estado sin exponer secretos', async () => {
    process.env.N8N_COMMUNICATION_API_KEY = 'expected-key'
    getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
    const response = createResponse()

    await statusHandler(createRequest({ authorization: 'Bearer expected-key' }), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ provider: 'meta-cloud', configured: true, enabled: true })
    expect(JSON.stringify(response.body)).not.toContain('expected-key')
  })
})
