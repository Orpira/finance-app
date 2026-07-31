import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getMetaCloudConfig, authenticateAutomationClient, sendTextMessage, sendTemplateMessage, markMessageAsRead } = vi.hoisted(() => ({
  getMetaCloudConfig: vi.fn(),
  authenticateAutomationClient: vi.fn(),
  sendTextMessage: vi.fn(),
  sendTemplateMessage: vi.fn(),
  markMessageAsRead: vi.fn(),
}))

vi.mock('../server/communication/config/metaCloudConfig', () => ({ getMetaCloudConfig }))
vi.mock('../server/communication/security/authenticateAutomationClient', () => ({ authenticateAutomationClient }))
vi.mock('../server/communication/services/outboundMessageService', () => ({
  sendTextMessage, sendTemplateMessage, markMessageAsRead,
}))

import sendTextHandler from '../api/communication/whatsapp/send-text'
import sendTemplateHandler from '../api/communication/whatsapp/send-template'
import markReadHandler from '../api/communication/whatsapp/mark-read'
import type { VercelRequest, VercelResponse } from '../server/apiUtils'
import { CommunicationAuthenticationError } from '../server/communication/errors/communicationErrors'

const ENABLED_CONFIG = {
  enabled: true, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
  appSecret: 's', accessToken: 't', verifyToken: 'v',
  phoneNumberId: '123', graphApiVersion: 'v21.0', n8nCommunicationApiKey: 'n8n-key',
}
const DISABLED_CONFIG = {
  enabled: false, allowRealSend: false, webhookEnabled: false, forwardInboundToN8n: false,
  messageRetentionDays: 0, idempotencyRetentionDays: 30,
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

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer n8n-key', 'content-type': 'application/json', ...headers },
    body,
  } as unknown as VercelRequest
}

const VALID_TEXT_BODY = { requestId: '11111111-1111-4111-8111-111111111111', recipient: '34600000000', text: 'Hola' }

beforeEach(() => {
  getMetaCloudConfig.mockReset()
  authenticateAutomationClient.mockReset()
  sendTextMessage.mockReset()
  sendTemplateMessage.mockReset()
  markMessageAsRead.mockReset()
  getMetaCloudConfig.mockReturnValue(ENABLED_CONFIG)
})

describe('POST /api/communication/whatsapp/send-text', () => {
  it('responde 503 con servicio deshabilitado cuando Cloud API no está habilitada', async () => {
    getMetaCloudConfig.mockReturnValue(DISABLED_CONFIG)
    const response = createResponse()

    await sendTextHandler(createRequest(VALID_TEXT_BODY), response)

    expect(response.statusCode).toBe(503)
    expect(authenticateAutomationClient).not.toHaveBeenCalled()
  })

  it('responde 401 cuando la autenticación de n8n falla', async () => {
    authenticateAutomationClient.mockImplementation(() => {
      throw new CommunicationAuthenticationError('Solicitud no autorizada.')
    })
    const response = createResponse()

    await sendTextHandler(createRequest(VALID_TEXT_BODY, { authorization: 'Bearer wrong' }), response)

    expect(response.statusCode).toBe(401)
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('responde 422 cuando el payload es inválido (sin requestId)', async () => {
    const response = createResponse()
    await sendTextHandler(createRequest({ recipient: '1', text: 'x' }), response)
    expect(response.statusCode).toBe(422)
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('responde 422 cuando el payload incluye campos no permitidos (objeto financiero completo)', async () => {
    const response = createResponse()
    await sendTextHandler(createRequest({ ...VALID_TEXT_BODY, income: { amount: 1000 } }), response)
    expect(response.statusCode).toBe(422)
  })

  it('en modo simulación devuelve status "simulated" sin llamar a Meta', async () => {
    sendTextMessage.mockResolvedValue({
      success: true, requestId: VALID_TEXT_BODY.requestId, provider: 'meta-cloud', status: 'simulated', simulation: true,
    })
    const response = createResponse()

    await sendTextHandler(createRequest(VALID_TEXT_BODY), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ status: 'simulated', simulation: true })
  })

  it('una segunda solicitud con el mismo requestId reutiliza el resultado del servicio (idempotencia delegada)', async () => {
    sendTextMessage.mockResolvedValue({
      success: true, requestId: VALID_TEXT_BODY.requestId, provider: 'meta-cloud', status: 'simulated', simulation: true,
    })
    const response1 = createResponse()
    const response2 = createResponse()

    await sendTextHandler(createRequest(VALID_TEXT_BODY), response1)
    await sendTextHandler(createRequest(VALID_TEXT_BODY), response2)

    expect(sendTextMessage).toHaveBeenCalledTimes(2)
    expect(response1.body).toEqual(response2.body)
  })
})

describe('POST /api/communication/whatsapp/send-template', () => {
  const VALID_TEMPLATE_BODY = {
    requestId: '22222222-2222-4222-8222-222222222222',
    recipient: '34600000000',
    template: { name: 'income_registered', languageCode: 'es', components: [] },
  }

  it('en modo simulación devuelve status "simulated"', async () => {
    sendTemplateMessage.mockResolvedValue({
      success: true, requestId: VALID_TEMPLATE_BODY.requestId, provider: 'meta-cloud', status: 'simulated', simulation: true,
    })
    const response = createResponse()

    await sendTemplateHandler(createRequest(VALID_TEMPLATE_BODY), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ status: 'simulated' })
  })

  it('responde 422 si falta el nombre de la plantilla', async () => {
    const response = createResponse()
    await sendTemplateHandler(createRequest({ ...VALID_TEMPLATE_BODY, template: { languageCode: 'es' } }), response)
    expect(response.statusCode).toBe(422)
  })
})

describe('POST /api/communication/whatsapp/mark-read', () => {
  it('en modo simulación devuelve success sin providerMessageId', async () => {
    const requestId = '33333333-3333-4333-8333-333333333333'
    markMessageAsRead.mockResolvedValue({ success: true, requestId, provider: 'meta-cloud', status: 'simulated', simulation: true })
    const response = createResponse()

    await markReadHandler(createRequest({ requestId, providerMessageId: 'wamid.1' }), response)

    expect(response.statusCode).toBe(200)
    expect(response.body).toMatchObject({ status: 'simulated' })
  })
})
