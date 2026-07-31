/// <reference types="node" />

import {
  rejectInvalidRequest,
  type VercelRequest,
  type VercelResponse,
} from '../../server/apiUtils.js'
import { verifyAutomationJwt } from '../../server/automationSecurity.js'
import { WhatsAppProviderError } from '../../server/automation/providers/whatsapp/errors.js'
import { resolveActiveWhatsAppProvider } from '../../server/automation/providers/whatsapp/WhatsAppProviderFactory.js'

function extractBearer(request: VercelRequest) {
  const authorization = request.headers.authorization
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new Error('Autorización ausente.')
  }

  const token = authorization.slice('Bearer '.length).trim()
  if (!token) throw new Error('Autorización ausente.')
  return token
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (rejectInvalidRequest(request, response, 0, {
    allowedMethods: ['GET'],
    requireJsonContentType: false,
  })) return

  try {
    verifyAutomationJwt(extractBearer(request))
    const provider = resolveActiveWhatsAppProvider()
    response.status(200).json({
      provider: provider.name,
      capabilities: provider.getCapabilities(),
    })
  } catch (error) {
    if (error instanceof WhatsAppProviderError) {
      response.status(error.status).json({ error: error.message })
      return
    }

    const message = error instanceof Error
      ? error.message
      : 'No se pudieron obtener las capacidades del proveedor.'
    const status = message.includes('Autorización') || message.includes('JWT') ? 401 : 500
    response.status(status).json({ error: message })
  }
}
