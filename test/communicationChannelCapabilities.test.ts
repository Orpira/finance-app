import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyAutomationJwt } = vi.hoisted(() => ({
  verifyAutomationJwt: vi.fn(),
}))

vi.mock('../server/automationSecurity', () => ({
  verifyAutomationJwt,
}))

import handler from '../api/communication-channel/capabilities'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'

const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'

function createResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, unknown>,
    body: undefined as unknown,
    ended: false,
    status(statusCode: number) {
      this.statusCode = statusCode
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
    end() {
      this.ended = true
      return this
    },
    setHeader(name: string, value: unknown) {
      this.headers[name] = value
      return this
    },
  }
  return response as unknown as VercelResponse & typeof response
}

function createRequest(overrides: Partial<VercelRequest> = {}) {
  return {
    method: 'GET',
    headers: {
      authorization: 'Bearer token',
      ...overrides.headers,
    },
    ...overrides,
  } as unknown as VercelRequest
}

beforeEach(() => {
  verifyAutomationJwt.mockReset()
  verifyAutomationJwt.mockReturnValue({ sub: DEVICE_CODE })
})

afterEach(() => {
  delete process.env.WHATSAPP_PROVIDER
})

describe('GET /api/communication-channel/capabilities', () => {
  it('devuelve el proveedor activo y sus capacidades', async () => {
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      provider: 'evolution',
      capabilities: {
        supportsQr: true,
        supportsPairingCode: true,
        supportsTemplates: false,
        supportsMessageStatus: false,
        supportsInboundWebhooks: true,
        supportsCoexistence: false,
      },
    })
  })

  it('rechaza métodos distintos de GET', async () => {
    const response = createResponse()

    await handler(createRequest({ method: 'POST' }), response)

    expect(response.statusCode).toBe(405)
  })

  it('rechaza solicitudes sin autorización antes de resolver el proveedor', async () => {
    const response = createResponse()

    await handler(createRequest({ headers: { authorization: '' } }), response)

    expect(response.statusCode).toBe(401)
  })

  it('devuelve 503 explícito si WHATSAPP_PROVIDER tiene un valor inválido, sin exponer el proveedor', async () => {
    process.env.WHATSAPP_PROVIDER = 'not-a-real-provider'
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(503)
    expect(response.body).toEqual({
      error: 'WHATSAPP_PROVIDER="not-a-real-provider" no es válido. Usa uno de: evolution, meta-cloud.',
    })
  })
})
