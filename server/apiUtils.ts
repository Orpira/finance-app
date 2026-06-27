/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http'

export interface VercelRequest extends IncomingMessage {
  body?: unknown
}

export interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse
  json(body: unknown): VercelResponse
}

const DEFAULT_ALLOWED_NATIVE_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
])

function configuredOrigins() {
  return new Set(
    (process.env.PRIVATE_BALANCE_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  )
}

export function applyApiSecurityHeaders(
  request: VercelRequest,
  response: VercelResponse,
) {
  const origin = typeof request.headers.origin === 'string'
    ? request.headers.origin
    : undefined
  const host = request.headers['x-forwarded-host'] ?? request.headers.host
  const sameOrigin = origin && host
    ? origin === `https://${host}` || origin === `http://${host}`
    : false
  const allowed = origin && (
    sameOrigin ||
    DEFAULT_ALLOWED_NATIVE_ORIGINS.has(origin) ||
    configuredOrigins().has(origin)
  )

  if (allowed) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key')
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  return !origin || Boolean(allowed)
}

export function rejectInvalidRequest(
  request: VercelRequest,
  response: VercelResponse,
  maxBodyBytes: number,
) {
  if (!applyApiSecurityHeaders(request, response)) {
    response.status(403).json({ error: 'Origen no permitido.' })
    return true
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return true
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST, OPTIONS')
    response.status(405).json({ error: 'Método no permitido.' })
    return true
  }

  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    response.status(413).json({ error: 'Solicitud demasiado grande.' })
    return true
  }

  return false
}
