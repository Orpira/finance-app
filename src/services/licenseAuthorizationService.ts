import type { DeviceIdentity } from '../types/deviceIdentity'
import { getPrivateBalanceApiUrl } from './apiBaseUrl'

const REQUEST_TIMEOUT_MS = 10_000

export interface LicenseDeviceAuthorizationResult {
  licenseKey: string
  deviceAuthorization: 'existing' | 'registered'
  activeDevices: number
  maxDevices: number
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
    const response = await fetch(getPrivateBalanceApiUrl('/api/license-activate'), {
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
