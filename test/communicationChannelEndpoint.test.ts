import { beforeEach, describe, expect, it, vi } from 'vitest'

const { verifyAutomationJwt } = vi.hoisted(() => ({
  verifyAutomationJwt: vi.fn(),
}))

const { resolveCanonicalUserCode } = vi.hoisted(() => ({
  resolveCanonicalUserCode: vi.fn(),
}))

const { getCommunicationChannel } = vi.hoisted(() => ({
  getCommunicationChannel: vi.fn(),
}))

vi.mock('../server/automationSecurity', () => ({
  verifyAutomationJwt,
}))

vi.mock('../server/canonicalIdentity', () => ({
  resolveCanonicalUserCode,
}))

vi.mock('../server/communicationChannelStore', () => ({
  getCommunicationChannel,
}))

import handler from '../api/communication-channel'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'

const DEVICE_CODE = 'PB-DEVICE-22222222-2222-4222-8222-222222222222'
const USER_CODE = 'PB-USER-11111111-1111-4111-8111-111111111111'
const VICTIM_USER_CODE = 'PB-USER-99999999-9999-4999-8999-999999999999'

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

function createRequest(headers: Record<string, string | undefined> = {}) {
  return {
    method: 'GET',
    headers: {
      authorization: 'Bearer token',
      ...headers,
    },
  } as unknown as VercelRequest
}

beforeEach(() => {
  verifyAutomationJwt.mockReset()
  verifyAutomationJwt.mockReturnValue({ sub: DEVICE_CODE })
  resolveCanonicalUserCode.mockReset()
  resolveCanonicalUserCode.mockResolvedValue(USER_CODE)
  getCommunicationChannel.mockReset()
  getCommunicationChannel.mockResolvedValue(null)
})

describe('GET /api/communication-channel — identidad canónica (PB-SEC-001)', () => {
  it('resuelve el userCode canónico desde el JWT e ignora el header del cliente', async () => {
    const response = createResponse()

    await handler(createRequest({
      'x-private-balance-user-code': VICTIM_USER_CODE,
    }), response)

    expect(resolveCanonicalUserCode).toHaveBeenCalledWith(DEVICE_CODE)
    expect(getCommunicationChannel).toHaveBeenCalledTimes(1)
    expect(getCommunicationChannel).toHaveBeenCalledWith(USER_CODE, DEVICE_CODE)
    expect(getCommunicationChannel).not.toHaveBeenCalledWith(VICTIM_USER_CODE, DEVICE_CODE)
    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({ channel: null })
  })

  it('funciona sin el header de compatibilidad', async () => {
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(getCommunicationChannel).toHaveBeenCalledWith(USER_CODE, DEVICE_CODE)
  })

  it('devuelve el canal propio cuando existe', async () => {
    getCommunicationChannel.mockResolvedValue({
      id: 'channel-1',
      userCode: USER_CODE,
      deviceCode: DEVICE_CODE,
      provider: 'whatsapp',
      instanceName: 'default',
      instanceId: null,
      phoneNumber: '+34600111222',
      ownerJid: null,
      profileName: null,
      profilePhoto: null,
      status: 'connected',
      pairingCode: null,
      providerMetadata: null,
      connectedAt: '2026-08-01T10:00:00.000Z',
      lastSeenAt: '2026-08-01T10:00:00.000Z',
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    })
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toEqual({
      channel: expect.objectContaining({
        userCode: USER_CODE,
        deviceCode: DEVICE_CODE,
        status: 'connected',
      }),
    })
  })

  it('devuelve 401 cuando el JWT es inválido sin consultar identidad ni canal', async () => {
    verifyAutomationJwt.mockImplementation(() => {
      throw new Error('token inválido')
    })
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(401)
    expect(resolveCanonicalUserCode).not.toHaveBeenCalled()
    expect(getCommunicationChannel).not.toHaveBeenCalled()
  })

  it('devuelve 403 fail-closed cuando la identidad canónica no se puede resolver', async () => {
    resolveCanonicalUserCode.mockRejectedValue(new Error('identidad no resuelta'))
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(403)
    expect(getCommunicationChannel).not.toHaveBeenCalled()
  })

  it('devuelve 500 genérico sin filtrar detalles internos si la consulta falla', async () => {
    getCommunicationChannel.mockRejectedValue(new Error('SQLSTATE: detalle interno de tabla'))
    const response = createResponse()

    await handler(createRequest(), response)

    expect(response.statusCode).toBe(500)
    expect(response.body).toEqual({ error: 'No se pudo obtener el canal.' })
  })
})
