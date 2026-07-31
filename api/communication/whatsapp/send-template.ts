/// <reference types="node" />

import { rejectInvalidRequest, type VercelRequest, type VercelResponse } from '../../../server/apiUtils.js'
import { getMetaCloudConfig } from '../../../server/communication/config/metaCloudConfig.js'
import { sendTemplateRequestSchema } from '../../../server/communication/contracts/outboundMessage.js'
import { CommunicationValidationError } from '../../../server/communication/errors/communicationErrors.js'
import { respondCloudDisabled, respondWithCommunicationError } from '../../../server/communication/routeHelpers.js'
import { authenticateAutomationClient } from '../../../server/communication/security/authenticateAutomationClient.js'
import { sendTemplateMessage } from '../../../server/communication/services/outboundMessageService.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
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
