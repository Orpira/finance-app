/// <reference types="node" />

import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import { verifyAutomationJwt } from '../server/automationSecurity.js'

const EVENT_TYPES = [
  'income.created',
  'expense.created',
  'calendar.created',
  'device.provision.requested',
  'device.whatsapp.connect.requested',
  'communication.whatsapp.qr.requested',
  'communication.whatsapp.status.requested',
  'communication.whatsapp.disconnect.requested',
  'communication.whatsapp.test.requested',
  'communication.whatsapp.preferences.updated',
] as const

type AutomationEvent = (typeof EVENT_TYPES)[number]
type N8nWebhookEnvironment =
  | 'N8N_AUTOMATION_WEBHOOK_URL'
  | 'N8N_DEVICE_PROVISIONING_WEBHOOK_URL'
  | 'N8N_WHATSAPP_WEBHOOK_URL'

const EVENT_ROUTER: Record<AutomationEvent, N8nWebhookEnvironment> = {
  'income.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'expense.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'calendar.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'device.provision.requested': 'N8N_DEVICE_PROVISIONING_WEBHOOK_URL',
  'device.whatsapp.connect.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  // Compatibility for QR requests already persisted by older clients.
  'communication.whatsapp.qr.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.status.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.disconnect.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.test.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.preferences.updated': 'N8N_WHATSAPP_WEBHOOK_URL',
}

const N8N_TIMEOUT_MS = 10_000
const MAX_N8N_RESPONSE_BYTES = 2_100_000

const identityCodesSchema = z.object({
  userCode: z.string().regex(/^PB-USER-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  deviceCode: z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
})

const envelopeSchema = z.object({
  eventId: z.string().uuid(),
  event: z.enum(EVENT_TYPES),
  createdAt: z.iso.datetime().default(() => new Date().toISOString()),
  schemaVersion: z.literal(1),
  source: z.literal('private-balance-pwa').optional(),
  data: z.record(z.string(), z.unknown()),
  timezone: z.string().optional(),
  locale: z.string().optional(),
})

const whatsappConnectRequestSchema = identityCodesSchema.extend({
  event: z.literal('device.whatsapp.connect.requested'),
  timezone: z.string().optional(),
  locale: z.string().optional(),
}).strict()

const provisionIdentityDataSchema = identityCodesSchema.extend({
  deviceName: z.string().min(1).max(200).optional(),
  platform: z.enum(['web', 'android', 'ios', 'unknown']).default('unknown'),
  appVersion: z.string().min(1).max(100).optional(),
}).passthrough()

type AutomationEnvelope = z.infer<typeof envelopeSchema>

function getBearerToken(request: VercelRequest) {
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new Error('Autorización ausente.')
  }

  return authorization.slice('Bearer '.length).trim()
}

function getRequestEventId(request: VercelRequest) {
  const idempotencyKey = request.headers['idempotency-key']
  const parsedKey = z.string().uuid().safeParse(idempotencyKey)
  return parsedKey.success ? parsedKey.data : randomUUID()
}

function parseGatewayRequest(request: VercelRequest): AutomationEnvelope | null {
  const envelopeResult = envelopeSchema.safeParse(request.body)
  if (envelopeResult.success) return envelopeResult.data

  const connectResult = whatsappConnectRequestSchema.safeParse(request.body)
  if (!connectResult.success) return null

  return {
    eventId: getRequestEventId(request),
    event: connectResult.data.event,
    createdAt: new Date().toISOString(),
    schemaVersion: 1,
    source: 'private-balance-pwa',
    data: {
      userCode: connectResult.data.userCode,
      deviceCode: connectResult.data.deviceCode,
    },
    timezone: connectResult.data.timezone,
    locale: connectResult.data.locale,
  }
}

function getN8nConfiguration(event: AutomationEvent) {
  const environmentName = EVENT_ROUTER[event]
  const rawUrl = process.env[environmentName]?.trim()
  const token = process.env.N8N_INTERNAL_TOKEN?.trim()

  if (!rawUrl || !token) {
    throw new Error(`Falta configurar ${environmentName} o N8N_INTERNAL_TOKEN.`)
  }

  const url = new URL(rawUrl)
  if (url.protocol !== 'https:') {
    throw new Error(`${environmentName} debe utilizar HTTPS.`)
  }

  return { url: url.href, token }
}

async function readN8nResponse(response: Response) {
  const contentLength = Number(response.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_N8N_RESPONSE_BYTES) {
    throw new Error('La respuesta de n8n es demasiado grande.')
  }

  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_N8N_RESPONSE_BYTES) {
    throw new Error('La respuesta de n8n es demasiado grande.')
  }

  if (!text) return { text, json: undefined }

  try {
    return { text, json: JSON.parse(text) as unknown }
  } catch {
    return { text, json: undefined }
  }
}

function buildN8nPayload(
  envelope: AutomationEnvelope,
  licenseDeviceCode: string,
) {
  if (envelope.event === 'device.whatsapp.connect.requested') {
    const identity = identityCodesSchema.parse(envelope.data)
    return {
      event: envelope.event,
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      timezone: envelope.timezone,
      locale: envelope.locale,
    }
  }

  if (envelope.event === 'device.provision.requested') {
    const identity = provisionIdentityDataSchema.parse(envelope.data)
    return {
      event: envelope.event,
      userCode: identity.userCode,
      deviceCode: identity.deviceCode,
      deviceName: identity.deviceName ?? null,
      platform: identity.platform ?? 'unknown',
      appVersion: identity.appVersion ?? null,
      timezone: envelope.timezone,
      locale: envelope.locale,
    }
  }

  return {
    ...envelope,
    deviceCode: licenseDeviceCode,
    receivedAt: new Date().toISOString(),
    source: envelope.source ?? 'private-balance-pwa',
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (rejectInvalidRequest(request, response, 256 * 1024)) return

  let claims
  try {
    claims = verifyAutomationJwt(getBearerToken(request))
  } catch {
    response.status(401).json({ error: 'Autorización inválida o expirada.' })
    return
  }

  const envelope = parseGatewayRequest(request)
  if (!envelope || !EVENT_ROUTER[envelope.event]) {
    response.status(422).json({ error: 'Evento no válido.' })
    return
  }

  let payload: ReturnType<typeof buildN8nPayload>
  try {
    payload = buildN8nPayload(envelope, claims.sub)
  } catch {
    response.status(422).json({ error: 'Evento no válido.' })
    return
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)

  try {
    const n8n = getN8nConfiguration(envelope.event)
    const n8nResponse = await fetch(n8n.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${n8n.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': envelope.eventId,
        'X-Private-Balance-Event-Id': envelope.eventId,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const n8nBody = await readN8nResponse(n8nResponse)

    if (n8nResponse.status === 204) {
      response.status(204).end()
      return
    }

    if (n8nResponse.ok || n8nResponse.status === 409) {
      if (n8nBody.json === undefined) {
        response.status(502).json({
          error: 'n8n no devolvió una respuesta JSON válida.',
        })
        return
      }

      response.status(n8nResponse.status).json(n8nBody.json)
      return
    }

    const errorBody = n8nBody.json ?? {
      error: n8nBody.text || `n8n devolvió el estado ${n8nResponse.status}.`,
    }
    console.error(
      `Automation Gateway: n8n devolvió ${n8nResponse.status} para ${envelope.event}.`,
      errorBody,
    )
    response.status(n8nResponse.status).json(errorBody)
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'No se pudo contactar con n8n.'
    const status = message.includes('configurar') || message.includes('HTTPS')
      ? 503
      : message.includes('demasiado grande')
        ? 502
        : 504
    response.status(status).json({ error: message })
  } finally {
    clearTimeout(timeoutId)
  }
}
