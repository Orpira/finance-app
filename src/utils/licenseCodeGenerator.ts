import type { LicenseType } from '../types/license'

const LICENSE_PREFIX = 'PB'
const CHECKSUM_SALT = 'PRIVATE-BALANCE-OFFLINE-V1'

const licenseTypeTokens: Record<LicenseType, string> = {
  demo: 'DEMO',
  monthly: 'MONTHLY',
  annual: 'ANNUAL',
  lifetime: 'LIFETIME',
}

const tokenLicenseTypes: Record<string, LicenseType> = Object.fromEntries(
  Object.entries(licenseTypeTokens).map(([type, token]) => [token, type]),
) as Record<string, LicenseType>

function simpleHash(value: string) {
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function checksum(payload: string) {
  return simpleHash(`${payload}|${CHECKSUM_SALT}`)
    .toString(36)
    .toUpperCase()
    .padStart(4, '0')
    .slice(-4)
}

function normalizeExpirationDate(expirationDate: string) {
  const compactDate = expirationDate.replaceAll('-', '')

  if (!/^\d{8}$/.test(compactDate)) {
    throw new Error('La fecha de expiración debe tener formato YYYY-MM-DD.')
  }

  return compactDate
}

export function getDeviceHashFragment(deviceCode: string) {
  return simpleHash(deviceCode.trim().toUpperCase())
    .toString(16)
    .toUpperCase()
    .padStart(8, '0')
    .slice(-8)
}

/**
 * Genera códigos para demos y licencias simples sin servidor.
 *
 * Esta protección es deliberadamente básica: el algoritmo vive dentro de la
 * aplicación y una persona con conocimientos puede inspeccionarlo. No sustituye
 * una firma criptográfica asimétrica ni una validación remota.
 */
export function generateActivationCode(
  deviceCode: string,
  licenseType: LicenseType,
  expirationDate: string,
) {
  const typeToken = licenseTypeTokens[licenseType]
  const expirationToken =
    licenseType === 'lifetime'
      ? '00000000'
      : normalizeExpirationDate(expirationDate)
  const deviceHash = getDeviceHashFragment(deviceCode)
  const payload = [LICENSE_PREFIX, typeToken, expirationToken, deviceHash].join(
    '-',
  )

  return `${payload}-${checksum(payload)}`
}

export interface ParsedActivationCode {
  deviceHash: string
  expirationToken: string
  licenseType: LicenseType
  normalizedCode: string
}

export function parseAndVerifyActivationCode(code: string) {
  const normalizedCode = code.trim().toUpperCase()
  const parts = normalizedCode.split('-')

  if (parts.length !== 5 || parts[0] !== LICENSE_PREFIX) {
    throw new Error('El código de activación no tiene un formato válido.')
  }

  const [, typeToken, expirationToken, deviceHash, receivedChecksum] = parts
  const licenseType = tokenLicenseTypes[typeToken]

  if (!licenseType || !/^[A-F0-9]{8}$/.test(deviceHash)) {
    throw new Error('El tipo de licencia o el dispositivo no son válidos.')
  }

  if (
    (licenseType === 'lifetime' && expirationToken !== '00000000') ||
    (licenseType !== 'lifetime' && !/^\d{8}$/.test(expirationToken))
  ) {
    throw new Error('La fecha incluida en el código no es válida.')
  }

  const payload = parts.slice(0, 4).join('-')

  if (checksum(payload) !== receivedChecksum) {
    throw new Error('El código de activación está dañado o no es válido.')
  }

  return {
    deviceHash,
    expirationToken,
    licenseType,
    normalizedCode,
  } satisfies ParsedActivationCode
}
