import { db } from '../database/db'
import type { AppLicense, LicenseStatus, LicenseType } from '../types/license'
import { CURRENT_LICENSE_ID, getDeviceCode } from './licenseDeviceService'
import {
  activateSignedLicense,
  getSignedLicenseStatus,
} from './signedLicenseService'
import {
  getDeviceHashFragment,
  parseAndVerifyActivationCode,
} from '../utils/licenseCodeGenerator'

const SIGNED_LICENSE_PREFIX = 'PB-LIC-V2.'

export { getDeviceCode } from './licenseDeviceService'

export type LicenseAccessStatus = LicenseStatus | 'clock-tampered'

export interface LicenseStatusResult {
  license?: AppLicense
  status: LicenseAccessStatus
}

export interface ActivationValidationResult {
  activationCode: string
  expirationDate?: string
  licenseType: LicenseType
}

function parseExpirationDate(expirationToken: string) {
  const year = Number(expirationToken.slice(0, 4))
  const month = Number(expirationToken.slice(4, 6))
  const day = Number(expirationToken.slice(6, 8))
  const expirationDate = new Date(year, month - 1, day, 23, 59, 59, 999)

  if (
    expirationDate.getFullYear() !== year ||
    expirationDate.getMonth() !== month - 1 ||
    expirationDate.getDate() !== day
  ) {
    throw new Error('La fecha de expiración del código no es válida.')
  }

  return expirationDate
}

export function getCurrentLicense() {
  return db.licenses.get(CURRENT_LICENSE_ID)
}

/**
 * Validación local para demos/licencias simples. No ofrece seguridad absoluta:
 * el algoritmo y su checksum forman parte del paquete instalado y pueden ser
 * inspeccionados. Una licencia comercial fuerte debería usar firmas asimétricas.
 */
export function validateActivationCode(
  code: string,
  deviceCode: string,
): ActivationValidationResult {
  const parsedCode = parseAndVerifyActivationCode(code)

  if (parsedCode.deviceHash !== getDeviceHashFragment(deviceCode)) {
    throw new Error('Este código pertenece a otro dispositivo.')
  }

  if (parsedCode.licenseType === 'lifetime') {
    return {
      activationCode: parsedCode.normalizedCode,
      licenseType: parsedCode.licenseType,
    }
  }

  const expirationDate = parseExpirationDate(parsedCode.expirationToken)

  if (expirationDate.getTime() <= Date.now()) {
    throw new Error('Este código de activación ya ha expirado.')
  }

  return {
    activationCode: parsedCode.normalizedCode,
    expirationDate: expirationDate.toISOString(),
    licenseType: parsedCode.licenseType,
  }
}

export async function activateLicense(code: string) {
  if (code.trim().startsWith(SIGNED_LICENSE_PREFIX)) {
    return activateSignedLicense(code)
  }

  const deviceCode = await getDeviceCode()
  const validation = validateActivationCode(code, deviceCode)
  const currentLicense = await getCurrentLicense()
  const now = new Date().toISOString()
  const license: AppLicense = {
    id: CURRENT_LICENSE_ID,
    deviceCode,
    activationCode: validation.activationCode,
    activationDate: now,
    expirationDate: validation.expirationDate,
    status: 'active',
    licenseType: validation.licenseType,
    licenseVersion: 1,
    lastValidAccessDate: now,
    createdAt: currentLicense?.createdAt ?? now,
    updatedAt: now,
  }

  await db.licenses.put(license)

  return license
}

export async function markLicenseExpired() {
  const license = await getCurrentLicense()

  if (!license) {
    return undefined
  }

  const updatedAt = new Date().toISOString()
  const expiredLicense = {
    ...license,
    status: 'expired' as const,
    updatedAt,
  }

  await db.licenses.put(expiredLicense)

  return expiredLicense
}

export async function getLicenseStatus(): Promise<LicenseStatusResult> {
  const license = await getCurrentLicense()

  if (!license) {
    return { status: 'inactive' }
  }

  if (license.licenseVersion === 2) {
    return getSignedLicenseStatus()
  }

  const deviceCode = await getDeviceCode()

  if (license.deviceCode !== deviceCode || license.status === 'inactive') {
    return { license, status: 'inactive' }
  }

  if (license.status === 'expired') {
    return { license, status: 'expired' }
  }

  const now = Date.now()
  const lastValidAccess = license.lastValidAccessDate
    ? new Date(license.lastValidAccessDate).getTime()
    : undefined

  if (
    lastValidAccess !== undefined &&
    Number.isFinite(lastValidAccess) &&
    now < lastValidAccess
  ) {
    return { license, status: 'clock-tampered' }
  }

  if (
    license.licenseType !== 'lifetime' &&
    (!license.expirationDate ||
      new Date(license.expirationDate).getTime() <= now)
  ) {
    const expiredLicense = await markLicenseExpired()

    return { license: expiredLicense, status: 'expired' }
  }

  const updatedLicense: AppLicense = {
    ...license,
    licenseVersion: license.licenseVersion ?? 1,
    lastValidAccessDate: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  }

  await db.licenses.put(updatedLicense)

  return { license: updatedLicense, status: 'active' }
}

export async function isLicenseValid() {
  return (await getLicenseStatus()).status === 'active'
}
