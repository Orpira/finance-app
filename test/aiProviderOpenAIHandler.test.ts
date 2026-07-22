import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyAutomationJwt } = vi.hoisted(() => ({
  verifyAutomationJwt: vi.fn(),
}))

vi.mock('../server/automationSecurity', () => ({
  verifyAutomationJwt,
}))

import handler from '../api/ai-provider-openai'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'

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

function createRequest(overrides?: Partial<Record<string, unknown>>) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer token',
      'content-type': 'application/json',
    },
    body: {
      providerId: 'OPENAI',
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'Actúa como asistente financiero.' },
        { role: 'user', content: 'Hola IA' },
      ],
      timeoutMs: 4500,
      ...(overrides ?? {}),
    },
  } as unknown as VercelRequest
}

describe('/api/ai-provider-openai', () => {
  beforeEach(() => {
    verifyAutomationJwt.mockReset()
    verifyAutomationJwt.mockReturnValue({ sub: 'PB-DEVICE-123' })
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1'
    process.env.OPENAI_MODEL = 'gpt-4.1-mini'
    process.env.OPENAI_TIMEOUT_MS = '5000'
  })

  it('fails closed when credentials are missing', async () => {
    delete process.env.OPENAI_API_KEY
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(503)
    expect(response.body).toEqual(expect.objectContaining({
      error: 'El proveedor de IA no está configurado correctamente.',
    }))
  })

  it('fails closed when the requested model does not match configured production model', async () => {
    process.env.OPENAI_API_KEY = 'sk-server'
    const response = createResponse()

    await handler(createRequest({ model: 'gpt-4.1' }), response)

    expect(response.statusCode).toBe(422)
    expect(response.body).toEqual(expect.objectContaining({ code: 'model-mismatch' }))
  })

  it('proxies requests to OpenAI without leaking the credential to the client response', async () => {
    process.env.OPENAI_API_KEY = 'sk-server'
    const fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer sk-server')

      return new Response(JSON.stringify({
        id: 'chatcmpl_server_001',
        model: 'gpt-4.1-mini',
        choices: [
          {
            finish_reason: 'stop',
            message: { content: 'Respuesta remota segura.' },
          },
        ],
        usage: {
          prompt_tokens: 91,
          completion_tokens: 21,
          total_tokens: 112,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const response = createResponse()
    await handler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual(expect.objectContaining({ model: 'gpt-4.1-mini' }))
    expect(JSON.stringify(response.body)).not.toContain('sk-server')
  })

  it('returns 401 with sanitized message when JWT is invalid', async () => {
    process.env.OPENAI_API_KEY = 'sk-server'
    verifyAutomationJwt.mockImplementation(() => {
      throw new Error('invalid token')
    })

    const response = createResponse()
    await handler(createRequest(), response)

    expect(response.statusCode).toBe(401)
    expect(response.body).toEqual(expect.objectContaining({
      error: 'Autorización inválida o expirada.',
      code: 'authorization-invalid',
    }))
  })

  it.each([
    { status: 403, upstreamCode: 'insufficient_permissions' },
    { status: 429, upstreamCode: 'rate_limit_exceeded' },
    { status: 500, upstreamCode: 'internal_error' },
  ])('sanitizes upstream error for status $status', async ({ status, upstreamCode }) => {
    process.env.OPENAI_API_KEY = 'sk-server'
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: upstreamCode,
      },
    }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchSpy)

    const response = createResponse()
    await handler(createRequest(), response)

    expect(response.statusCode).toBe(status)
    expect(response.body).toEqual(expect.objectContaining({
      error: 'El proveedor de IA rechazó la solicitud.',
      code: upstreamCode,
    }))
    expect(JSON.stringify(response.body)).not.toContain('sk-server')
  })

  it('returns 504 with sanitized timeout message when upstream times out', async () => {
    process.env.OPENAI_API_KEY = 'sk-server'
    const fetchSpy = vi.fn(async () => {
      throw new DOMException('operation timed out', 'AbortError')
    })
    vi.stubGlobal('fetch', fetchSpy)

    const response = createResponse()
    await handler(createRequest(), response)

    expect(response.statusCode).toBe(504)
    expect(response.body).toEqual(expect.objectContaining({
      error: 'El proveedor de IA tardó demasiado en responder.',
      code: 'gateway-timeout',
    }))
  })

  it('returns 502 with sanitized message when upstream is unreachable', async () => {
    process.env.OPENAI_API_KEY = 'sk-server'
    const fetchSpy = vi.fn(async () => {
      throw new Error('socket hang up')
    })
    vi.stubGlobal('fetch', fetchSpy)

    const response = createResponse()
    await handler(createRequest(), response)

    expect(response.statusCode).toBe(502)
    expect(response.body).toEqual(expect.objectContaining({
      error: 'No se pudo contactar con el proveedor de IA.',
      code: 'gateway-unavailable',
    }))
  })
})
