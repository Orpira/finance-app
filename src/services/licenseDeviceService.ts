import { db } from '../database/db'
import { getOrCreateDeviceIdentity } from './deviceIdentityService'

export const CURRENT_LICENSE_ID = 'current'

const LEGACY_DEVICE_CODE_STORAGE_KEY = 'finance-app:license-device-code'

let deviceCodeRequest: Promise<string> | undefined

function logExistingDeviceCode(message: string, deviceCode: string) {
  if (import.meta.env.DEV) {
    console.info(`[Private Balance] ${message}`, { deviceCode })
  }
}

async function resolveDeviceCode() {
  // Existing licenses keep their original binding. This avoids invalidating a
  // previously activated V1/V2 license during the identity migration.
  try {
    const existingLicense = await db.licenses.get(CURRENT_LICENSE_ID)
    if (existingLicense?.deviceCode) {
      logExistingDeviceCode(
        'deviceCode recuperado desde licencia existente',
        existingLicense.deviceCode,
      )
      return existingLicense.deviceCode
    }
  } catch {
    // Device identity has independent IndexedDB/localStorage/native fallbacks.
  }

  const identity = await getOrCreateDeviceIdentity()

  // Keep the old key synchronized for compatibility with installed versions
  // that still read it, but never use it to generate a second identity.
  try {
    globalThis.localStorage?.setItem(
      LEGACY_DEVICE_CODE_STORAGE_KEY,
      identity.deviceCode,
    )
  } catch {
    // The canonical identity is already persisted by deviceIdentityService.
  }

  return identity.deviceCode
}

export function getDeviceCode() {
  if (!deviceCodeRequest) {
    deviceCodeRequest = resolveDeviceCode().finally(() => {
      deviceCodeRequest = undefined
    })
  }

  return deviceCodeRequest
}

export function logLicenseValidatedForExistingDeviceCode(deviceCode: string) {
  logExistingDeviceCode(
    'Licencia validada para deviceCode existente',
    deviceCode,
  )
}
