import { Capacitor } from '@capacitor/core'

import type { AutomationEventEnvelope } from '../types/automation'
import { getDeviceCode, getLicenseStatus } from './licenseService'

const CONFIGURED_API_URL =
  typeof import.meta.env.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : ''
const REQUEST_TIMEOUT_MS = 10_000
const TOKEN_EXPIRATION_SKEW_MS = 60_000
const MAX_RESPONSE_BYTES = 2_100_000

export interface AutomationDeliveryResult {
  delivered: boolean
  error?: string
  data?: Record<string, unknown>
}

interface AutomationToken {
  token: string
  expiresAt: number
}

let cachedToken: AutomationToken | undefined
let tokenRequest: Promise<AutomationToken> | undefined

function isLocalDevelopmentUrl(url: URL) {
  return (
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  )
}

function getAutomationApiBaseUrl() {
  const isNative = Capacitor.isNativePlatform()
  const runtimeOrigin = new URL(globalThis.location.origin)
  const shouldUseConfiguredApi = isNative || isLocalDevelopmentUrl(runtimeOrigin)
  const rawBaseUrl = shouldUseConfiguredApi
    ? CONFIGURED_API_URL || runtimeOrigin.href
    : runtimeOrigin.href

  if (!rawBaseUrl) {
    throw new Error(
      'Falta configurar VITE_API_BASE_URL para Android o desarrollo local.',
    )
  }

  const baseUrl = new URL(rawBaseUrl)

  if (baseUrl.protocol !== 'https:' && !isLocalDevelopmentUrl(baseUrl)) {
    throw new Error('El Automation Hub requiere una conexión HTTPS segura.')
  }

  return baseUrl.href.replace(/\/$/, '')
}

function getAutomationApiUrl(path: '/api/automation-token' | '/api/automation') {
  return `${getAutomationApiBaseUrl()}${path}`
}

async function fetchWithTimeout(input: string, init: RequestInit) {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )

  try {
    return await fetch(input, {
      ...init,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}

async function readJsonObject(response: Response) {
  const contentLength = Number(response.headers.get('content-length') ?? 0)

  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new Error('La respuesta del Automation Hub es demasiado grande.')
  }

  const body = await response.text()

  if (new TextEncoder().encode(body).byteLength > MAX_RESPONSE_BYTES) {
    throw new Error('La respuesta del Automation Hub es demasiado grande.')
  }

  if (!body) {
    return undefined
  }

  const parsed = JSON.parse(body) as unknown

  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined
}

function isUsableToken(token: AutomationToken | undefined) {
  return Boolean(
    token && token.expiresAt - TOKEN_EXPIRATION_SKEW_MS > Date.now(),
  )
}

async function requestAutomationToken(): Promise<AutomationToken> {
  const licenseResult = await getLicenseStatus()
  const license = licenseResult.license

  if (licenseResult.status !== 'active' || !license) {
    throw new Error('Se requiere una licencia activa para usar automatizaciones.')
  }

  if (license.licenseVersion !== 2 || !license.activationCode) {
    throw new Error(
      'Las automatizaciones requieren una licencia firmada V2.',
    )
  }

  const deviceCode = await getDeviceCode()
  const response = await fetchWithTimeout(
    getAutomationApiUrl('/api/automation-token'),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activationCode: license.activationCode,
        deviceCode,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? 'El servidor rechazó la licencia para automatizaciones.'
        : `No se pudo autorizar el dispositivo (${response.status}).`,
    )
  }

  const body = await readJsonObject(response)
  const token = typeof body?.token === 'string' ? body.token : ''
  const expiresAtValue =
    typeof body?.expiresAt === 'string' ? Date.parse(body.expiresAt) : NaN

  if (!token || !Number.isFinite(expiresAtValue) || expiresAtValue <= Date.now()) {
    throw new Error('El servidor devolvió una autorización no válida.')
  }

  return { token, expiresAt: expiresAtValue }
}

async function getAutomationToken(forceRefresh = false) {
  if (!forceRefresh && isUsableToken(cachedToken)) {
    return cachedToken as AutomationToken
  }

  if (forceRefresh) {
    cachedToken = undefined
  }

  if (!tokenRequest) {
    tokenRequest = requestAutomationToken()
      .then((token) => {
        cachedToken = token
        return token
      })
      .finally(() => {
        tokenRequest = undefined
      })
  }

  return tokenRequest
}

async function postAutomationEvent(
  envelope: AutomationEventEnvelope,
  token: string,
) {
  const body = envelope.event === 'device.whatsapp.connect.requested'
    ? {
        event: envelope.event,
        userCode: envelope.data.userCode,
        deviceCode: envelope.data.deviceCode,
      }
    : {
        eventId: envelope.eventId,
        event: envelope.event,
        createdAt: envelope.createdAt,
        schemaVersion: envelope.schemaVersion,
        source: envelope.source,
        data: envelope.data,
      }

  return fetchWithTimeout(getAutomationApiUrl('/api/automation'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': envelope.eventId,
    },
    body: JSON.stringify(body),
  })
}

function getBackendErrorMessage(
  body: Record<string, unknown> | undefined,
  status: number,
) {
  if (typeof body?.error === 'string' && body.error.trim()) {
    return body.error.trim()
  }
  if (
    body?.error &&
    typeof body.error === 'object' &&
    !Array.isArray(body.error) &&
    typeof (body.error as Record<string, unknown>).message === 'string'
  ) {
    return ((body.error as Record<string, unknown>).message as string).trim()
  }
  if (typeof body?.message === 'string' && body.message.trim()) {
    return body.message.trim()
  }
  if (typeof body?.body === 'string' && body.body.trim()) {
    return body.body.trim()
  }

  return `El Automation Gateway devolvió el estado ${status}.`
}

export async function sendAutomationEvent(
  envelope: AutomationEventEnvelope,
): Promise<AutomationDeliveryResult> {
  try {
    let authorization = await getAutomationToken()
    let response = await postAutomationEvent(envelope, authorization.token)

    if (response.status === 401) {
      authorization = await getAutomationToken(true)
      response = await postAutomationEvent(envelope, authorization.token)
    }

    if (response.ok || response.status === 409) {
      return {
        delivered: true,
        data: await readJsonObject(response),
      }
    }

    let responseBody: Record<string, unknown> | undefined
    try {
      responseBody = await readJsonObject(response)
    } catch {
      responseBody = undefined
    }

    if (response.status === 422) {
      console.error(
        '[Private Balance] Automation Gateway rechazó el evento con 422.',
        responseBody ?? 'Respuesta sin cuerpo JSON.',
      )
    }

    return {
      delivered: false,
      error: getBackendErrorMessage(responseBody, response.status),
      data: responseBody,
    }
  } catch (error) {
    return {
      delivered: false,
      error:
        error instanceof Error
          ? error.message
          : 'No se pudo contactar con el Automation Hub.',
    }
  }
}

export function clearAutomationAuthorization() {
  cachedToken = undefined
  tokenRequest = undefined
}
