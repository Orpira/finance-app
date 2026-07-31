/// <reference types="node" />

import { rejectInvalidRequest, type VercelRequest, type VercelResponse } from '../../../server/apiUtils.js'
import { getMetaCloudConfig } from '../../../server/communication/config/metaCloudConfig.js'
import {
  markAsReadRequestSchema,
  sendTemplateRequestSchema,
  sendTextRequestSchema,
} from '../../../server/communication/contracts/outboundMessage.js'
import { CommunicationValidationError } from '../../../server/communication/errors/communicationErrors.js'
import { respondCloudDisabled, respondWithCommunicationError } from '../../../server/communication/routeHelpers.js'
import { authenticateAutomationClient } from '../../../server/communication/security/authenticateAutomationClient.js'
import {
  markMessageAsRead,
  sendTemplateMessage,
  sendTextMessage,
} from '../../../server/communication/services/outboundMessageService.js'

/**
 * N8N_COMMUNICATION_API_KEY puede existir aunque WHATSAPP_CLOUD_ENABLED sea
 * false (p. ej. durante el rollout inicial); si está presente, se exige
 * siempre. Si no está presente y el servicio está deshabilitado, no hay
 * secreto que proteger: se informa el estado "deshabilitado" sin exigir
 * autenticación en ese caso concreto.
 */
function getConfiguredApiKey(): string | undefined {
  return process.env.N8N_COMMUNICATION_API_KEY?.trim() || undefined
}

async function handleHealth(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 0, {
    allowedMethods: ['GET'],
    requireJsonContentType: false,
  })) return

  try {
    const config = getMetaCloudConfig()
    response.status(200).json({
      status: 'ok',
      provider: 'meta-cloud',
      enabled: config.enabled,
      realSendEnabled: config.allowRealSend,
      webhookEnabled: config.webhookEnabled,
    })
  } catch (error) {
    respondWithCommunicationError(response, error)
  }
}

async function handleStatus(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 0, {
    allowedMethods: ['GET'],
    requireJsonContentType: false,
  })) return

  try {
    const config = getMetaCloudConfig()
    const apiKey = getConfiguredApiKey()
    if (apiKey) {
      authenticateAutomationClient(request.headers.authorization, apiKey)
    }

    response.status(200).json({
      provider: 'meta-cloud',
      configured: config.enabled,
      enabled: config.enabled,
      realSendEnabled: config.allowRealSend,
      webhookEnabled: config.webhookEnabled,
      lastInboundAt: null,
      lastOutboundAt: null,
      lastError: null,
    })
  } catch (error) {
    respondWithCommunicationError(response, error)
  }
}

async function handleSendText(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 64 * 1024, { allowedMethods: ['POST'] })) return

  let requestId: string | undefined
  try {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      respondCloudDisabled(response)
      return
    }

    authenticateAutomationClient(request.headers.authorization, config.n8nCommunicationApiKey)

    const parsed = sendTextRequestSchema.safeParse(request.body)
    if (!parsed.success) throw new CommunicationValidationError('Payload inválido para send-text.')
    requestId = parsed.data.requestId

    const result = await sendTextMessage(parsed.data, config)
    response.status(200).json(result)
  } catch (error) {
    respondWithCommunicationError(response, error, requestId)
  }
}

async function handleSendTemplate(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 64 * 1024, { allowedMethods: ['POST'] })) return

  let requestId: string | undefined
  try {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      respondCloudDisabled(response)
      return
    }

    authenticateAutomationClient(request.headers.authorization, config.n8nCommunicationApiKey)

    const parsed = sendTemplateRequestSchema.safeParse(request.body)
    if (!parsed.success) throw new CommunicationValidationError('Payload inválido para send-template.')
    requestId = parsed.data.requestId

    const result = await sendTemplateMessage(parsed.data, config)
    response.status(200).json(result)
  } catch (error) {
    respondWithCommunicationError(response, error, requestId)
  }
}

async function handleMarkRead(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 16 * 1024, { allowedMethods: ['POST'] })) return

  let requestId: string | undefined
  try {
    const config = getMetaCloudConfig()
    if (!config.enabled) {
      respondCloudDisabled(response)
      return
    }

    authenticateAutomationClient(request.headers.authorization, config.n8nCommunicationApiKey)

    const parsed = markAsReadRequestSchema.safeParse(request.body)
    if (!parsed.success) throw new CommunicationValidationError('Payload inválido para mark-read.')
    requestId = parsed.data.requestId

    const result = await markMessageAsRead(parsed.data, config)
    response.status(200).json(result)
  } catch (error) {
    respondWithCommunicationError(response, error, requestId)
  }
}

const ACTION_HANDLERS: Record<string, (request: VercelRequest, response: VercelResponse) => Promise<void>> = {
  health: handleHealth,
  status: handleStatus,
  'send-text': handleSendText,
  'send-template': handleSendTemplate,
  'mark-read': handleMarkRead,
}

/**
 * Consolida los endpoints de WhatsApp Cloud en una sola Serverless Function
 * (ruta dinámica `[action]`) para no superar el límite de 12 funciones del
 * plan Hobby de Vercel. Las URLs públicas (`/api/communication/whatsapp/health`,
 * `/status`, `/send-text`, `/send-template`, `/mark-read`) no cambian.
 */
export default async function handler(request: VercelRequest, response: VercelResponse) {
  const action = request.query?.action
  const resolvedAction = Array.isArray(action) ? action[0] : action
  const target = resolvedAction ? ACTION_HANDLERS[resolvedAction] : undefined

  if (!target) {
    response.status(404).json({ error: 'Recurso no encontrado.' })
    return
  }

  await target(request, response)
}
