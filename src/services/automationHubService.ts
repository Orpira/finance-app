import type { AutomationEventEnvelope } from '../types/automation'

const WEBHOOK_URL = typeof import.meta.env.VITE_N8N_WEBHOOK_URL === 'string'
  ? import.meta.env.VITE_N8N_WEBHOOK_URL.trim()
  : undefined

const BEARER_TOKEN = typeof import.meta.env.VITE_PRIVATE_BALANCE_TOKEN === 'string'
  ? import.meta.env.VITE_PRIVATE_BALANCE_TOKEN.trim()
  : undefined

const REQUEST_TIMEOUT_MS = 10_000

export interface AutomationDeliveryResult {
  delivered: boolean
  error?: string
  data?: Record<string, unknown>
}

interface AutomationHubConfig {
  webhookUrl: string
  bearerToken: string
}

function getAutomationHubConfig(): AutomationHubConfig {
  if (!WEBHOOK_URL) {
    throw new Error('Falta configurar VITE_N8N_WEBHOOK_URL para automatizaciones.')
  }

  if (!BEARER_TOKEN) {
    throw new Error('Falta configurar VITE_PRIVATE_BALANCE_TOKEN para automatizaciones.')
  }

  return {
    webhookUrl: WEBHOOK_URL,
    bearerToken: BEARER_TOKEN,
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
) {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    return await fetch(input, {
      ...init,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

export async function sendAutomationEvent(
  envelope: AutomationEventEnvelope,
): Promise<AutomationDeliveryResult> {
  try {
    const { webhookUrl, bearerToken } = getAutomationHubConfig()

    const response = await fetchWithTimeout(webhookUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': envelope.eventId,
      },
      body: JSON.stringify(envelope),
    })

    if (response.ok || response.status === 409) {
      let data: Record<string, unknown> | undefined
      try {
        const body = await response.json() as unknown
        if (body && typeof body === 'object' && !Array.isArray(body)) {
          data = body as Record<string, unknown>
        }
      } catch {
        // Some n8n workflows acknowledge the event without a JSON body.
      }
      return { delivered: true, data }
    }

    const errorMessage = response.status === 401
      ? 'El webhook rechazó la credencial configurada.'
      : `El webhook devolvió el estado ${response.status}.`

    return {
      delivered: false,
      error: errorMessage,
    }
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'No se pudo contactar con el webhook de automatización.'

    return {
      delivered: false,
      error: message,
    }
  }
}

// Compatibilidad hacia atrás: no se requiere autorización previa
export function clearAutomationAuthorization() {}
