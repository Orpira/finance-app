/// <reference types="node" />

import type { AutomationEvent } from './eventTypes.js'

type N8nWebhookEnvironment =
  | 'N8N_AUTOMATION_WEBHOOK_URL'
  | 'N8N_DEVICE_PROVISIONING_WEBHOOK_URL'
  | 'N8N_WHATSAPP_WEBHOOK_URL'

const EVENT_WEBHOOKS: Record<AutomationEvent, N8nWebhookEnvironment> = {
  'income.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'service.completed': 'N8N_AUTOMATION_WEBHOOK_URL',
  'expense.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'calendar.created': 'N8N_AUTOMATION_WEBHOOK_URL',
  'device.provision.requested': 'N8N_DEVICE_PROVISIONING_WEBHOOK_URL',
  'device.whatsapp.connect.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.qr.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.status.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.disconnect.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.test.requested': 'N8N_WHATSAPP_WEBHOOK_URL',
  'communication.whatsapp.preferences.updated': 'N8N_WHATSAPP_WEBHOOK_URL',
}

const N8N_TIMEOUT_MS = 10_000
const MAX_N8N_RESPONSE_BYTES = 2_100_000

export interface WebhookDispatchResult {
  status: number
  body?: unknown
  empty: boolean
  successful: boolean
}

export class WebhookDispatchError extends Error {
  constructor(
    message: string,
    readonly status: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export function hasWebhookRoute(event: AutomationEvent) {
  return Boolean(EVENT_WEBHOOKS[event])
}

function getN8nConfiguration(event: AutomationEvent) {
  const environmentName = EVENT_WEBHOOKS[event]
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

function mapDispatchError(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : 'No se pudo contactar con n8n.'
  const status = message.includes('configurar') || message.includes('HTTPS')
    ? 503
    : message.includes('demasiado grande') ||
        message.includes('respuesta JSON válida')
      ? 502
      : 504

  return new WebhookDispatchError(
    message,
    status,
    error instanceof Error ? { cause: error } : undefined,
  )
}

export async function dispatchWebhook(input: {
  event: AutomationEvent
  eventId: string
  payload: unknown
}): Promise<WebhookDispatchResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)

  try {
    const n8n = getN8nConfiguration(input.event)
    const response = await fetch(n8n.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${n8n.token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.eventId,
        'X-Private-Balance-Event-Id': input.eventId,
      },
      body: JSON.stringify(input.payload),
      signal: controller.signal,
    })
    const responseBody = await readN8nResponse(response)

    if (response.status === 204) {
      return { status: 204, empty: true, successful: true }
    }

    if (response.ok || response.status === 409) {
      if (responseBody.json === undefined) {
        throw new Error('n8n no devolvió una respuesta JSON válida.')
      }

      return {
        status: response.status,
        body: responseBody.json,
        empty: false,
        successful: true,
      }
    }

    const errorBody = responseBody.json ?? {
      error: responseBody.text || `n8n devolvió el estado ${response.status}.`,
    }
    console.error(
      `Automation Gateway: n8n devolvió ${response.status} para ${input.event}.`,
      errorBody,
    )

    return {
      status: response.status,
      body: errorBody,
      empty: false,
      successful: false,
    }
  } catch (error) {
    if (error instanceof WebhookDispatchError) throw error
    throw mapDispatchError(error)
  } finally {
    clearTimeout(timeoutId)
  }
}
