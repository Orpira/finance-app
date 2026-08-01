/// <reference types="node" />

import { rejectInvalidRequest, type VercelRequest, type VercelResponse } from '../../../server/apiUtils.js'
import { getMetaCloudConfig, type MetaCloudEnabledConfig } from '../../../server/communication/config/metaCloudConfig.js'
import { normalizeMetaWebhookPayload } from '../../../server/communication/contracts/metaWebhook.js'
import { logCommunicationEvent } from '../../../server/communication/security/redactCommunicationData.js'
import { readRawRequestBody } from '../../../server/communication/security/rawBody.js'
import { verifyMetaWebhookSignature } from '../../../server/communication/security/verifyMetaSignature.js'
import { processNormalizedWebhookEvent } from '../../../server/communication/services/metaWebhookService.js'

/**
 * Meta firma el body crudo: Vercel no debe parsear el JSON antes de que
 * calculemos el HMAC, o la firma no coincidiría con los bytes recibidos.
 */
export const config = { api: { bodyParser: false } }

function getQueryParam(request: VercelRequest, name: string): string | undefined {
  const url = new URL(request.url ?? '/', 'http://internal.invalid')
  return url.searchParams.get(name) ?? undefined
}

function handleVerification(request: VercelRequest, response: VercelResponse) {
  const metaConfig = getMetaCloudConfig()
  const mode = getQueryParam(request, 'hub.mode')
  const challenge = getQueryParam(request, 'hub.challenge')
  const verifyToken = getQueryParam(request, 'hub.verify_token')

  if (
    metaConfig.enabled &&
    metaConfig.webhookEnabled &&
    mode === 'subscribe' &&
    challenge &&
    verifyToken === metaConfig.verifyToken
  ) {
    response.status(200).end(challenge)
    return
  }

  // Nunca registrar hub.verify_token, ni el recibido ni el esperado.
  response.status(403).end()
}

/**
 * Se espera (await) todo el procesamiento antes de responder: en el runtime
 * serverless de Vercel no hay garantía de que el trabajo en segundo plano
 * continúe después de enviar la respuesta, así que "responder rápido" se
 * interpreta como "no bloquear más de lo necesario", no como "responder
 * antes de terminar de procesar".
 */
async function handleEvent(request: VercelRequest, response: VercelResponse) {
  const metaConfig = getMetaCloudConfig()
  if (!metaConfig.enabled || !metaConfig.webhookEnabled) {
    response.status(403).end()
    return
  }

  const rawBody = await readRawRequestBody(request, 1_000_000)
  const signatureHeader = request.headers['x-hub-signature-256']
  const validSignature = verifyMetaWebhookSignature(
    rawBody,
    typeof signatureHeader === 'string' ? signatureHeader : undefined,
    (metaConfig as MetaCloudEnabledConfig).appSecret,
  )

  if (!validSignature) {
    logCommunicationEvent('whatsapp.webhook.signature_invalid', {})
    response.status(401).end()
    return
  }

  try {
    const payload: unknown = JSON.parse(rawBody.toString('utf8'))
    const normalized = normalizeMetaWebhookPayload(payload)
    const result = await processNormalizedWebhookEvent(normalized, metaConfig as MetaCloudEnabledConfig)
    logCommunicationEvent('whatsapp.webhook.processed', result)
  } catch (error) {
    logCommunicationEvent('whatsapp.webhook.processing_error', {
      message: error instanceof Error ? error.message : 'unknown',
    })
  }

  response.status(200).end()
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 1_000_000, {
    allowedMethods: ['GET', 'POST'],
    requireJsonContentType: false,
  })) return

  try {
    if (request.method === 'GET') {
      handleVerification(request, response)
      return
    }
    await handleEvent(request, response)
  } catch (error) {
    logCommunicationEvent('whatsapp.webhook.unexpected_error', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    if (!response.headersSent) response.status(500).end()
  }
}
