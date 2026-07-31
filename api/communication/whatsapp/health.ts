/// <reference types="node" />

import { rejectInvalidRequest, type VercelRequest, type VercelResponse } from '../../../server/apiUtils.js'
import { getMetaCloudConfig } from '../../../server/communication/config/metaCloudConfig.js'
import { respondWithCommunicationError } from '../../../server/communication/routeHelpers.js'

export default async function handler(request: VercelRequest, response: VercelResponse) {
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
