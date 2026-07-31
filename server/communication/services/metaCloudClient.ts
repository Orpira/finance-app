import {
  CommunicationAuthenticationError,
  CommunicationProviderError,
  CommunicationProviderUnavailableError,
  CommunicationRateLimitError,
} from '../errors/communicationErrors.js'
import { logCommunicationEvent } from '../security/redactCommunicationData.js'

const META_TIMEOUT_MS = 10_000

export interface MetaCloudClientConfig {
  accessToken: string
  phoneNumberId: string
  graphApiVersion: string
}

export interface MetaSendTextInput {
  recipient: string
  text: string
}

export interface MetaSendTemplateInput {
  recipient: string
  templateName: string
  languageCode: string
  components?: unknown[]
}

export interface MetaSendMessageResult {
  providerMessageId: string
}

/**
 * Único punto del backend que construye URLs de Graph API y envía el
 * Bearer token de Meta. Ninguna ruta ni servicio debe construirlas a mano.
 */
export interface MetaCloudClient {
  sendText(input: MetaSendTextInput): Promise<MetaSendMessageResult>
  sendTemplate(input: MetaSendTemplateInput): Promise<MetaSendMessageResult>
  markAsRead(providerMessageId: string): Promise<void>
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function buildMessagesUrl(config: MetaCloudClientConfig) {
  return `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`
}

function extractMessageId(json: unknown): MetaSendMessageResult {
  const messages = asRecord(json)?.messages
  const firstMessage = Array.isArray(messages) ? asRecord(messages[0]) : undefined
  const providerMessageId = typeof firstMessage?.id === 'string' ? firstMessage.id : undefined

  if (!providerMessageId) {
    throw new CommunicationProviderError('Meta no devolvió un identificador de mensaje.', 502)
  }
  return { providerMessageId }
}

async function callGraphApi(
  config: MetaCloudClientConfig,
  body: unknown,
  operation: string,
): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), META_TIMEOUT_MS)
  const startedAt = Date.now()

  try {
    const response = await fetch(buildMessagesUrl(config), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await response.text()
    const json = text ? safeJsonParse(text) : undefined

    if (response.ok) {
      logCommunicationEvent('meta_cloud.request', {
        operation, status: response.status, durationMs: Date.now() - startedAt,
      })
      return json
    }

    const metaError = asRecord(asRecord(json)?.error)
    logCommunicationEvent('meta_cloud.request_failed', {
      operation,
      status: response.status,
      metaCode: metaError?.code,
      durationMs: Date.now() - startedAt,
    })

    if (response.status === 401 || response.status === 403) {
      throw new CommunicationAuthenticationError('Meta rechazó las credenciales configuradas.')
    }
    if (response.status === 429) {
      throw new CommunicationRateLimitError('Meta aplicó un límite de tasa a este número.')
    }
    throw new CommunicationProviderError(
      `Meta devolvió un error al intentar ${operation}.`,
      response.status >= 500 ? 502 : 422,
    )
  } catch (error) {
    if (
      error instanceof CommunicationAuthenticationError ||
      error instanceof CommunicationRateLimitError ||
      error instanceof CommunicationProviderError
    ) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CommunicationProviderUnavailableError(`Tiempo de espera agotado al intentar ${operation}.`)
    }
    throw new CommunicationProviderUnavailableError(`No se pudo contactar con WhatsApp Cloud API al intentar ${operation}.`)
  } finally {
    clearTimeout(timeoutId)
  }
}

export function createMetaCloudClient(config: MetaCloudClientConfig): MetaCloudClient {
  return {
    async sendText(input) {
      const json = await callGraphApi(config, {
        messaging_product: 'whatsapp',
        to: input.recipient,
        type: 'text',
        text: { body: input.text },
      }, 'enviar texto')
      return extractMessageId(json)
    },

    async sendTemplate(input) {
      const json = await callGraphApi(config, {
        messaging_product: 'whatsapp',
        to: input.recipient,
        type: 'template',
        template: {
          name: input.templateName,
          language: { code: input.languageCode },
          components: input.components ?? [],
        },
      }, 'enviar plantilla')
      return extractMessageId(json)
    },

    async markAsRead(providerMessageId) {
      await callGraphApi(config, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: providerMessageId,
      }, 'marcar como leído')
    },
  }
}
