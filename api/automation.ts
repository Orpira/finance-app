/// <reference types="node" />

import { randomUUID } from 'node:crypto'

import { z } from 'zod'

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../server/apiUtils.js'
import {
  dispatchAutomationEvent,
} from '../server/automation/eventDispatcher.js'
import {
  AUTOMATION_EVENT_TYPES,
  type AutomationEnvelope,
} from '../server/automation/eventTypes.js'
import {
  hasWebhookRoute,
  WebhookDispatchError,
} from '../server/automation/webhookDispatcher.js'
import { verifyAutomationJwt } from '../server/automationSecurity.js'

const identityCodesSchema = z.object({
  userCode: z.string().regex(/^PB-USER-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
  deviceCode: z.string().regex(/^PB-DEVICE-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
})

const envelopeSchema = z.object({
  eventId: z.string().uuid(),
  event: z.enum(AUTOMATION_EVENT_TYPES),
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
  console.log('===== ENVELOPE RECIBIDO =====');
  console.log(JSON.stringify(envelope, null, 2));   
  if (!envelope || !hasWebhookRoute(envelope.event)) {
    response.status(422).json({ error: 'Evento no válido.' })
    return
  }

  try {
    const result = await dispatchAutomationEvent({
      envelope,
      licenseDeviceCode: claims.sub,
    })

    if (result.empty) {
      response.status(result.status).end()
      return
    }

    response.status(result.status).json(result.body)
  } catch (error) {
    if (error instanceof z.ZodError) {
      response.status(422).json({ error: 'Evento no válido.' })
      return
    }

    if (error instanceof WebhookDispatchError) {
      response.status(error.status).json({ error: error.message })
      return
    }

    response.status(504).json({ error: 'No se pudo contactar con n8n.' })
  }
}
