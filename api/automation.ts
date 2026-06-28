/// <reference types="node" />

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
  'communication.whatsapp.qr.requested',
  'communication.whatsapp.status.requested',
  'communication.whatsapp.disconnect.requested',
  'communication.whatsapp.test.requested',
  'communication.whatsapp.preferences.updated',
] as const
const N8N_TIMEOUT_MS = 10_000

const envelopeSchema = z.object({
  eventId: z.string().uuid(),
  event: z.enum(EVENT_TYPES),
  createdAt: z.iso.datetime(),
  schemaVersion: z.literal(1),
  source: z.literal('private-balance-pwa').optional(),
  data: z.record(z.string(), z.unknown()),
}).strict()

function getBearerToken(request: VercelRequest) {
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new Error('Autorización ausente.')
  }

  return authorization.slice('Bearer '.length).trim()
}

function getN8nConfiguration() {
  const url = process.env.N8N_WEBHOOK_URL?.trim()
  const token = process.env.PRIVATE_BALANCE_TOKEN?.trim()

  if (!url || !token || new URL(url).protocol !== 'https:') {
    throw new Error('El webhook n8n no está configurado de forma segura.')
  }

  return { url, token }
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

  let envelope
  try {
    envelope = envelopeSchema.parse(request.body)
  } catch {
    response.status(422).json({ error: 'Evento no válido.' })
    return
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)

  try {
    const n8n = getN8nConfiguration()
    const n8nResponse = await fetch(n8n.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${n8n.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': envelope.eventId,
        'X-Private-Balance-Event-Id': envelope.eventId,
      },
      body: JSON.stringify({
        ...envelope,
        deviceCode: claims.sub,
        receivedAt: new Date().toISOString(),
        source: envelope.source ?? 'private-balance-pwa',
      }),
      signal: controller.signal,
    })

    if (n8nResponse.ok || n8nResponse.status === 409) {
      let data: unknown
      try {
        data = await n8nResponse.json()
      } catch {
        data = undefined
      }
      response.status(202).json({ accepted: true, eventId: envelope.eventId, data })
      return
    }

    response.status(502).json({ error: 'n8n no aceptó el evento.' })
  } catch {
    response.status(503).json({ error: 'n8n no está disponible.' })
  } finally {
    clearTimeout(timeoutId)
  }
}
