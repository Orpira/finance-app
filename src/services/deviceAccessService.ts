import { Capacitor } from '@capacitor/core'
import type { DeviceIdentity } from '../types/deviceIdentity'
import type { AppLicense } from '../types/license'
import {
  authorizeSignedLicenseDevice,
  DeviceAccessDeniedError,
} from './licenseAuthorizationService'

const STORAGE_KEY = 'finance-app:device-access-permit'
const MAX_OFFLINE_MS = 7 * 24 * 60 * 60 * 1000

type Permit = {
  licenseKey: string
  deviceCode: string
  checkedAt: number
  validUntil: number
}

let currentPermit: Permit | undefined
let requiresPermit = false

export function assertDeviceMayWrite() {
  if (!requiresPermit) return
  const now = Date.now()
  if (!currentPermit || now < currentPermit.checkedAt || now >= currentPermit.validUntil) {
    throw new Error('Renueva el permiso del dispositivo antes de guardar cambios.')
  }
}

function readPermit(licenseKey: string, deviceCode: string): Permit | undefined {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (!stored || typeof stored !== 'object') return
    const permit = stored as Partial<Permit>
    if (
      permit.licenseKey === licenseKey &&
      permit.deviceCode === deviceCode &&
      typeof permit.checkedAt === 'number' &&
      typeof permit.validUntil === 'number' &&
      Number.isSafeInteger(permit.checkedAt) &&
      Number.isSafeInteger(permit.validUntil) &&
      permit.validUntil - permit.checkedAt <= MAX_OFFLINE_MS
    ) {
      return permit as Permit
    }
  } catch {
    // Without a readable permit, a connection is required.
  }
}

export async function refreshDeviceAccess(
  license: AppLicense,
  identity: DeviceIdentity,
): Promise<'allowed' | 'denied' | 'offline-expired'> {
  const { activationCode, licenseKey } = license
  requiresPermit = Capacitor.getPlatform() === 'android' &&
    license.licenseVersion === 2 && license.licenseType !== 'trial'
  if (!requiresPermit) {
    currentPermit = undefined
    return 'allowed'
  }
  if (!activationCode || !licenseKey) {
    currentPermit = undefined
    return 'offline-expired'
  }

  currentPermit = readPermit(licenseKey, identity.deviceCode)
  const checkedAt = Date.now()
  try {
    const result = await authorizeSignedLicenseDevice(activationCode, identity, true)
    const duration = result.validForMs
    if (result.licenseKey !== licenseKey || typeof duration !== 'number' ||
        !Number.isSafeInteger(duration) || duration <= 0 || duration > MAX_OFFLINE_MS) {
      throw new Error('El servidor devolvió un permiso de uso inválido.')
    }
    const permit = {
      licenseKey,
      deviceCode: identity.deviceCode,
      checkedAt,
      validUntil: checkedAt + duration,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(permit))
    currentPermit = permit
  } catch (error) {
    if (error instanceof DeviceAccessDeniedError) {
      currentPermit = undefined
      localStorage.removeItem(STORAGE_KEY)
      return 'denied'
    }
  }

  try {
    assertDeviceMayWrite()
    return 'allowed'
  } catch {
    return 'offline-expired'
  }
}
