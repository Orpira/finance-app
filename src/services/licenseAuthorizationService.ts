import { Capacitor } from '@capacitor/core'

import type { DeviceIdentity } from '../types/deviceIdentity'

const CONFIGURED_API_URL =
  typeof import.meta.env.VITE_API_BASE_URL === 'string'
    ? import.meta.env.VITE_API_BASE_URL.trim()
    : ''
const REQUEST_TIMEOUT_MS = 10_000

export interface LicenseDeviceAuthorizationResult {
  licenseKey: string
  deviceAuthorization: 'existing' | 'registered'
  activeDevices: number
  maxDevices: number
}

function isLocalDevelopmentUrl(url: URL) {
  return url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
}

function getLicenseApiUrl() {
  const runtimeOrigin = new URL(globalThis.location.origin)
  const shouldUseConfiguredApi =
    Capacitor.isNativePlatform() || isLocalDevelopmentUrl(runtimeOrigin)
  const baseUrl = shouldUseConfiguredApi
    ? CONFIGURED_API_URL || runtimeOrigin.href
    : runtimeOrigin.href

  return `${baseUrl.replace(/\/$/, '')}/api/license-activate`
}

export async function authorizeSignedLicenseDevice(
  activationCode: string,
  identity: DeviceIdentity,
): Promise<LicenseDeviceAuthorizationResult> {
  const controller = new AbortController()
  const timeoutId = globalThis.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(getLicenseApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        activationCode,
        userCode: identity.userCode,
        deviceCode: identity.deviceCode,
        deviceName: identity.deviceName,
        platform: identity.platform,
      }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    const body = await response.json() as Record<string, unknown>

    if (!response.ok) {
      throw new Error(
        typeof body.error === 'string' && body.error.trim()
          ? body.error.trim()
          : `No se pudo autorizar el dispositivo (${response.status}).`,
      )
    }

    if (
      typeof body.licenseKey !== 'string' ||
      !['existing', 'registered'].includes(String(body.deviceAuthorization)) ||
      typeof body.activeDevices !== 'number' ||
      typeof body.maxDevices !== 'number'
    ) {
      throw new Error('El servidor devolvió una autorización no válida.')
    }

    return body as unknown as LicenseDeviceAuthorizationResult
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(
        'El servidor de licencias tardó demasiado en responder.',
        { cause: error },
      )
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeoutId)
  }
}
