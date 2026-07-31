/// <reference types="node" />

import type { NormalizedInboundWhatsAppMessage, NormalizedWhatsAppMessageStatus } from '../contracts/metaWebhook.js'
import { logCommunicationEvent } from '../security/redactCommunicationData.js'

const FORWARD_TIMEOUT_MS = 8_000
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504])

export interface ForwardResult {
  forwarded: boolean
  status?: number
  retryable?: boolean
  reason?: string
}

interface ForwarderTarget {
  url: string
  token: string
}

function getForwarderTarget(urlEnvName: string): ForwarderTarget | null {
  const url = process.env[urlEnvName]?.trim()
  const token = process.env.N8N_WHATSAPP_FORWARD_AUTH_TOKEN?.trim()
  if (!url || !token) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
  } catch {
    return null
  }

  return { url, token }
}

/**
 * Reenvío de un único intento: en una función serverless de Vercel no hay
 * forma segura de dormir minutos entre reintentos (sección 26 del documento
 * de la Fase 4 lo reconoce explícitamente: "no depender de setTimeout de
 * larga duración"). Se clasifica el resultado como reintentable o no y se
 * deja constancia técnica de un fallo reintentable; la re-ejecución
 * programada (Vercel Cron u otra cola) es preparación para una fase
 * posterior, documentada en docs/whatsapp/n8n-meta-cloud-integration.md.
 */
async function forwardEvent(
  target: ForwarderTarget,
  payload: unknown,
): Promise<ForwardResult> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FORWARD_TIMEOUT_MS)

  try {
    const response = await fetch(target.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${target.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    if (response.ok) {
      return { forwarded: true, status: response.status }
    }

    return {
      forwarded: false,
      status: response.status,
      retryable: RETRYABLE_STATUS_CODES.has(response.status),
      reason: `n8n devolvió ${response.status}`,
    }
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'AbortError'
    return {
      forwarded: false,
      retryable: true,
      reason: isTimeout ? 'timeout' : 'network_error',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function forwardInboundMessage(
  message: NormalizedInboundWhatsAppMessage,
): Promise<ForwardResult> {
  const target = getForwarderTarget('N8N_WHATSAPP_INBOUND_WEBHOOK_URL')
  if (!target) {
    return { forwarded: false, reason: 'not_configured' }
  }

  const payload = {
    event: 'whatsapp.message.received',
    eventId: `meta:${message.providerMessageId}`,
    provider: message.provider,
    occurredAt: new Date().toISOString(),
    message: {
      providerMessageId: message.providerMessageId,
      senderPhone: message.senderPhone,
      senderName: message.senderName,
      type: message.type,
      text: message.text,
      timestamp: message.timestamp,
    },
    channel: {
      phoneNumberId: message.phoneNumberId,
    },
  }

  const result = await forwardEvent(target, payload)
  logCommunicationEvent('whatsapp.inbound.forward', {
    providerMessageId: message.providerMessageId,
    forwarded: result.forwarded,
    status: result.status,
    retryable: result.retryable,
    reason: result.reason,
  })
  return result
}

export async function forwardMessageStatus(
  status: NormalizedWhatsAppMessageStatus,
): Promise<ForwardResult> {
  const target = getForwarderTarget('N8N_WHATSAPP_STATUS_WEBHOOK_URL')
  if (!target) {
    return { forwarded: false, reason: 'not_configured' }
  }

  const payload = {
    event: 'whatsapp.message.status.updated',
    eventId: `status:${status.providerMessageId}:${status.status}:${status.timestamp}`,
    provider: status.provider,
    occurredAt: new Date().toISOString(),
    status: {
      providerMessageId: status.providerMessageId,
      state: status.status,
      timestamp: status.timestamp,
      errorCode: status.errorCode ?? null,
      errorMessage: status.errorMessage ?? null,
    },
  }

  const result = await forwardEvent(target, payload)
  logCommunicationEvent('whatsapp.status.forward', {
    providerMessageId: status.providerMessageId,
    state: status.status,
    forwarded: result.forwarded,
    status: result.status,
    retryable: result.retryable,
    reason: result.reason,
  })
  return result
}
