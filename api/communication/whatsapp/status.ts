/// <reference types="node" />

import { rejectInvalidRequest, type VercelRequest, type VercelResponse } from '../../../server/apiUtils.js'
import { getMetaCloudConfig } from '../../../server/communication/config/metaCloudConfig.js'
import { respondWithCommunicationError } from '../../../server/communication/routeHelpers.js'
import { authenticateAutomationClient } from '../../../server/communication/security/authenticateAutomationClient.js'

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

export default async function handler(request: VercelRequest, response: VercelResponse) {
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
