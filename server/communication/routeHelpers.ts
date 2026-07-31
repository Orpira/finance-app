import type { VercelResponse } from '../apiUtils.js'
import { CommunicationError, toCommunicationErrorBody } from './errors/communicationErrors.js'

export function respondWithCommunicationError(
  response: VercelResponse,
  error: unknown,
  requestId?: string,
): void {
  if (error instanceof CommunicationError) {
    response.status(error.status).json(toCommunicationErrorBody(error, requestId))
    return
  }

  response.status(500).json({
    success: false,
    ...(requestId ? { requestId } : {}),
    provider: 'meta-cloud',
    error: {
      code: 'COMMUNICATION_UNEXPECTED_ERROR',
      message: 'Error inesperado del backend de comunicaciones.',
    },
  })
}

export function respondCloudDisabled(response: VercelResponse): void {
  response.status(503).json({
    success: false,
    provider: 'meta-cloud',
    error: {
      code: 'WHATSAPP_CLOUD_DISABLED',
      message: 'WhatsApp Cloud API no está habilitado en este entorno.',
    },
  })
}
