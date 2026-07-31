import type { WhatsAppProviderName } from './WhatsAppProvider.js'

export class WhatsAppProviderError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string, options?: { cause?: unknown }) {
    super(message)
    if (options && 'cause' in options) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
    this.name = 'WhatsAppProviderError'
    this.status = status
    this.code = code
  }
}

export class WhatsAppProviderConfigurationError extends WhatsAppProviderError {
  constructor(message: string) {
    super(message, 503, 'WHATSAPP_PROVIDER_CONFIGURATION_ERROR')
    this.name = 'WhatsAppProviderConfigurationError'
  }
}

export class WhatsAppProviderAuthenticationError extends WhatsAppProviderError {
  constructor(message: string) {
    super(message, 401, 'WHATSAPP_PROVIDER_AUTHENTICATION_ERROR')
    this.name = 'WhatsAppProviderAuthenticationError'
  }
}

export class WhatsAppProviderUnavailableError extends WhatsAppProviderError {
  constructor(message: string) {
    super(message, 502, 'WHATSAPP_PROVIDER_UNAVAILABLE')
    this.name = 'WhatsAppProviderUnavailableError'
  }
}

export class UnsupportedProviderCapabilityError extends WhatsAppProviderError {
  constructor(message: string) {
    super(message, 422, 'WHATSAPP_PROVIDER_CAPABILITY_UNSUPPORTED')
    this.name = 'UnsupportedProviderCapabilityError'
  }
}

export class UnsupportedWhatsAppProviderError extends WhatsAppProviderError {
  constructor(providerName: string) {
    super(`Proveedor de WhatsApp no soportado: "${providerName}".`, 500, 'WHATSAPP_PROVIDER_UNSUPPORTED')
    this.name = 'UnsupportedWhatsAppProviderError'
  }
}

export class ProviderNotImplementedError extends WhatsAppProviderError {
  constructor(providerName: WhatsAppProviderName) {
    super(
      `El proveedor de WhatsApp "${providerName}" aún no está implementado en Private Balance.`,
      501,
      'WHATSAPP_PROVIDER_NOT_IMPLEMENTED',
    )
    this.name = 'ProviderNotImplementedError'
  }
}

/**
 * Forma de respuesta normalizada para exponer estos errores por HTTP sin
 * filtrar detalles internos (tokens, URLs de n8n, payload crudo del
 * proveedor).
 */
export function toWhatsAppProviderErrorBody(
  error: WhatsAppProviderError,
  provider?: WhatsAppProviderName,
) {
  return {
    success: false,
    ...(provider ? { provider } : {}),
    error: {
      code: error.code,
      message: error.message,
    },
  }
}
