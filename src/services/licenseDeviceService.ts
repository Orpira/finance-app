import { Capacitor } from '@capacitor/core'
import { Device } from '@capacitor/device'

import { getDeviceHashFragment } from '../utils/licenseCodeGenerator'

export const CURRENT_LICENSE_ID = 'current'

const DEVICE_CODE_STORAGE_KEY = 'finance-app:license-device-code'
const FALLBACK_DEVICE_ID_STORAGE_KEY = 'finance-app:license-device-id'

function createFallbackUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (value) => {
    const random = Math.floor(Math.random() * 16)
    const digit = value === 'x' ? random : (random & 0x3) | 0x8

    return digit.toString(16)
  })
}

function getFallbackDeviceId() {
  const storedId = localStorage.getItem(FALLBACK_DEVICE_ID_STORAGE_KEY)

  if (storedId) {
    return storedId
  }

  const nextId = createFallbackUuid()
  localStorage.setItem(FALLBACK_DEVICE_ID_STORAGE_KEY, nextId)

  return nextId
}

async function hashDeviceIdentifier(identifier: string) {
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(identifier),
    )

    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  }

  return `${getDeviceHashFragment(identifier)}${getDeviceHashFragment(
    `${identifier}:fallback`,
  )}`
}

async function getStableDeviceIdentifier() {
  if (Capacitor.isNativePlatform()) {
    try {
      const deviceId = await Device.getId()

      if (deviceId.identifier) {
        return `native:${deviceId.identifier}`
      }
    } catch {
      // Web/PWA-compatible fallback below.
    }
  }

  return `local:${getFallbackDeviceId()}`
}

export async function getDeviceCode() {
  const storedCode = localStorage.getItem(DEVICE_CODE_STORAGE_KEY)

  if (storedCode) {
    return storedCode
  }

  const identifier = await getStableDeviceIdentifier()
  const hash = await hashDeviceIdentifier(identifier)
  const deviceCode = `PB-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`

  localStorage.setItem(DEVICE_CODE_STORAGE_KEY, deviceCode)

  return deviceCode
}
