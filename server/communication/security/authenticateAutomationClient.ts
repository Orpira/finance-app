/// <reference types="node" />

import { timingSafeEqual } from 'node:crypto'

import { CommunicationAuthenticationError } from '../errors/communicationErrors.js'
import { isRateLimited, registerAttempt } from './rateLimiter.js'

const AUTH_FAILURE_WINDOW_MS = 5 * 60 * 1000
const MAX_AUTH_FAILURES_PER_WINDOW = 20
const RATE_LIMIT_KEY = 'n8n-communication-auth'

function secureCompare(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected)
  const providedBuffer = Buffer.from(provided)
  if (expectedBuffer.length !== providedBuffer.length) return false
  return timingSafeEqual(expectedBuffer, providedBuffer)
}

/**
 * Autentica llamadas de n8n hacia el backend de comunicaciones con
 * `Authorization: Bearer <N8N_COMMUNICATION_API_KEY>`. Nunca acepta la clave
 * en query params, nunca registra la clave recibida (solo éxito/fallo), y
 * responde siempre con el mismo mensaje genérico ante fallo (no revela si la
 * clave existe, está mal formada o simplemente no coincide).
 */
export function authenticateAutomationClient(
  authorizationHeader: string | undefined,
  configuredApiKey: string,
): void {
  if (isRateLimited(RATE_LIMIT_KEY, {
    windowMs: AUTH_FAILURE_WINDOW_MS,
    maxAttempts: MAX_AUTH_FAILURES_PER_WINDOW,
  })) {
    throw new CommunicationAuthenticationError('Solicitud no autorizada.')
  }

  const provided = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : ''

  if (!provided || !secureCompare(configuredApiKey, provided)) {
    registerAttempt(RATE_LIMIT_KEY, {
      windowMs: AUTH_FAILURE_WINDOW_MS,
      maxAttempts: MAX_AUTH_FAILURES_PER_WINDOW,
    })
    throw new CommunicationAuthenticationError('Solicitud no autorizada.')
  }
}
