export class CommunicationError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'CommunicationError'
    this.status = status
    this.code = code
  }
}

export class CommunicationConfigurationError extends CommunicationError {
  constructor(message: string) {
    super(message, 503, 'COMMUNICATION_CONFIGURATION_ERROR')
    this.name = 'CommunicationConfigurationError'
  }
}

export class CommunicationAuthenticationError extends CommunicationError {
  constructor(message: string) {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'CommunicationAuthenticationError'
  }
}

export class CommunicationValidationError extends CommunicationError {
  constructor(message: string) {
    super(message, 422, 'COMMUNICATION_VALIDATION_ERROR')
    this.name = 'CommunicationValidationError'
  }
}

export class CommunicationProviderError extends CommunicationError {
  constructor(message: string, status = 502) {
    super(message, status, 'COMMUNICATION_PROVIDER_ERROR')
    this.name = 'CommunicationProviderError'
  }
}

export class CommunicationProviderUnavailableError extends CommunicationError {
  constructor(message: string) {
    super(message, 502, 'COMMUNICATION_PROVIDER_UNAVAILABLE')
    this.name = 'CommunicationProviderUnavailableError'
  }
}

export class CommunicationRateLimitError extends CommunicationError {
  constructor(message: string) {
    super(message, 429, 'COMMUNICATION_RATE_LIMIT_EXCEEDED')
    this.name = 'CommunicationRateLimitError'
  }
}

export class CommunicationTemplateRequiredError extends CommunicationError {
  constructor(message: string) {
    super(message, 422, 'WHATSAPP_TEMPLATE_REQUIRED')
    this.name = 'CommunicationTemplateRequiredError'
  }
}

export class CommunicationTemplateRejectedError extends CommunicationError {
  constructor(message: string) {
    super(message, 422, 'WHATSAPP_TEMPLATE_REJECTED')
    this.name = 'CommunicationTemplateRejectedError'
  }
}

export class CommunicationDuplicateRequestError extends CommunicationError {
  constructor(message: string) {
    super(message, 409, 'COMMUNICATION_DUPLICATE_REQUEST')
    this.name = 'CommunicationDuplicateRequestError'
  }
}

export class CommunicationWebhookSignatureError extends CommunicationError {
  constructor(message: string) {
    super(message, 401, 'COMMUNICATION_WEBHOOK_SIGNATURE_INVALID')
    this.name = 'CommunicationWebhookSignatureError'
  }
}

export class CommunicationRealSendDisabledError extends CommunicationError {
  constructor(message: string) {
    super(message, 422, 'WHATSAPP_CLOUD_REAL_SEND_DISABLED')
    this.name = 'CommunicationRealSendDisabledError'
  }
}

/**
 * Forma de respuesta pública. Nunca incluye tokens, app secret, URLs de
 * Graph API ni el body crudo devuelto por Meta.
 */
export function toCommunicationErrorBody(error: CommunicationError, requestId?: string) {
  return {
    success: false,
    ...(requestId ? { requestId } : {}),
    provider: 'meta-cloud' as const,
    error: {
      code: error.code,
      message: error.message,
    },
  }
}
