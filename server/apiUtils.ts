/// <reference types="node" />

import type { IncomingMessage, ServerResponse } from 'node:http'

export interface VercelRequest extends IncomingMessage {
  body?: unknown
}

export interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse
  json(body: unknown): VercelResponse
}

interface RequestValidationOptions {
  allowedMethods?: string[]
  requireJsonContentType?: boolean
}

const DEFAULT_ALLOWED_NATIVE_ORIGINS = new Set([
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
])

function isAllowedLocalOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    )
  } catch {
    return false
  }
}

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
  options: RequestValidationOptions = {},
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
    isAllowedLocalOrigin(origin) ||
    configuredOrigins().has(origin)
  )

  const allowedMethods = options.allowedMethods ?? ['POST']

  if (allowed) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  response.setHeader(
    'Access-Control-Allow-Methods',
    [...new Set([...allowedMethods.map((method) => method.toUpperCase()), 'OPTIONS'])].join(', '),
  )
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Authorization, Content-Type, Idempotency-Key, X-Private-Balance-Event-Id, X-Private-Balance-User-Code',
  )
  response.setHeader('Cache-Control', 'no-store')
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'",
  )
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  )
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('X-Content-Type-Options', 'nosniff')

  return !origin || Boolean(allowed)
}

export function rejectInvalidRequest(
  request: VercelRequest,
  response: VercelResponse,
  maxBodyBytes: number,
  options: RequestValidationOptions = {},
) {
  const allowedMethods = options.allowedMethods ?? ['POST']
  const requireJsonContentType = options.requireJsonContentType ?? true

  if (!applyApiSecurityHeaders(request, response, { allowedMethods })) {
    response.status(403).json({ error: 'Origen no permitido.' })
    return true
  }

  if (request.method === 'OPTIONS') {
    response.status(204).end()
    return true
  }

  const requestMethod = request.method?.toUpperCase() ?? ''
  if (!allowedMethods.map((method) => method.toUpperCase()).includes(requestMethod)) {
    response.setHeader('Allow', [...allowedMethods.map((method) => method.toUpperCase()), 'OPTIONS'].join(', '))
    response.status(405).json({ error: 'Método no permitido.' })
    return true
  }

  if (requireJsonContentType && ['POST', 'PUT', 'PATCH'].includes(requestMethod)) {
    const contentType = request.headers['content-type']
    if (
      typeof contentType !== 'string' ||
      !contentType.toLowerCase().startsWith('application/json')
    ) {
      response.status(415).json({ error: 'Content-Type no permitido.' })
      return true
    }
  }

  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    response.status(413).json({ error: 'Solicitud demasiado grande.' })
    return true
  }

  return false
}
