import { db } from '../database/db'
import type { AppLicense, LicenseStatus, LicenseType } from '../types/license'
import {
  CURRENT_LICENSE_ID,
  getDeviceCode,
  logLicenseValidatedForExistingDeviceCode,
} from './licenseDeviceService'
import { getOrCreateDeviceIdentity } from './deviceIdentityService'
import { authorizeSignedLicenseDevice } from './licenseAuthorizationService'

const SIGNED_LICENSE_PREFIX = 'PB-LIC-V2'
const LICENSE_APP_ID = 'private-balance'
const LICENSE_VERSION = 2
const ALLOWED_LICENSE_TYPES = [
  'demo',
  'monthly',
  'annual',
  'lifetime',
] satisfies LicenseType[]

const publicLicenseKeyJwk: JsonWebKey = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'DYNiVDNSdO_PV1g6QE4n2xtPkZXdlxuY2T0FV2md7fs',
  y: 'LLO8InWuxK-EZDBqDegKqK8WQlvnnnzFSLqxynmqlzU',
  crv: 'P-256',
}

export type SignedLicenseAccessStatus = LicenseStatus | 'clock-tampered'

export interface SignedLicenseStatusResult {
  license?: AppLicense
  status: SignedLicenseAccessStatus
}

export interface SignedLicensePayload {
  app: 'private-balance'
  version: 2
  deviceCode: string
  licenseType: LicenseType
  issuedAt: string
  expiresAt: string | null
  features: string[]
  devicePolicy?: 'multi' | 'single'
}

export interface SignedLicenseValidationResult {
  activationCode: string
  expirationDate?: string
  licenseType: LicenseType
  payload: SignedLicensePayload
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  )
  const binary = globalThis.atob(padded)

  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function decodeBase64UrlJson<T>(value: string): T {
  const json = new TextDecoder().decode(base64UrlToBytes(value))

  return JSON.parse(json) as T
}

function normalizeSignedLicenseCode(code: string) {
  return code.trim().replace(/\s+/g, '')
}

function isLicenseType(value: unknown): value is LicenseType {
  return (
    typeof value === 'string' &&
    ALLOWED_LICENSE_TYPES.includes(value as LicenseType)
  )
}

function assertIsoDate(value: unknown, message: string) {
  if (typeof value !== 'string') {
    throw new Error(message)
  }

  const time = new Date(value).getTime()

  if (!Number.isFinite(time)) {
    throw new Error(message)
  }

  return time
}

function validatePayloadShape(
  payload: Partial<SignedLicensePayload>,
  deviceCode: string,
  checkExpiration: boolean,
): SignedLicensePayload {
  if (payload.app !== LICENSE_APP_ID || payload.version !== LICENSE_VERSION) {
    throw new Error('La licencia no pertenece a Private Balance.')
  }

  if (typeof payload.deviceCode !== 'string') {
    throw new Error('La licencia no contiene un dispositivo inicial válido.')
  }

  if (
    payload.devicePolicy !== undefined &&
    !['multi', 'single'].includes(payload.devicePolicy)
  ) {
    throw new Error('La política de dispositivos no es válida.')
  }

  if (
    payload.devicePolicy === 'single' &&
    payload.deviceCode.trim().toUpperCase() !== deviceCode.trim().toUpperCase()
  ) {
    throw new Error('Esta licencia pertenece a otro dispositivo.')
  }

  if (!isLicenseType(payload.licenseType)) {
    throw new Error('El tipo de licencia no es válido.')
  }

  assertIsoDate(payload.issuedAt, 'La fecha de emisión de la licencia no es válida.')

  if (!Array.isArray(payload.features)) {
    throw new Error('Las funcionalidades de la licencia no son válidas.')
  }

  if (payload.licenseType === 'lifetime') {
    if (payload.expiresAt !== null) {
      throw new Error('Una licencia lifetime no debe incluir expiración.')
    }
  } else {
    const expiresAt = assertIsoDate(
      payload.expiresAt,
      'La fecha de expiración de la licencia no es válida.',
    )

    if (checkExpiration && expiresAt <= Date.now()) {
      throw new Error('Esta licencia ya ha expirado.')
    }
  }

  return payload as SignedLicensePayload
}

async function importPublicLicenseKey() {
  return globalThis.crypto.subtle.importKey(
    'jwk',
    publicLicenseKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  )
}

async function parseAndVerifySignedLicense(
  code: string,
  deviceCode: string,
  options: { checkExpiration: boolean },
): Promise<SignedLicenseValidationResult> {
  const normalizedCode = normalizeSignedLicenseCode(code)
  const parts = normalizedCode.split('.')

  if (parts.length !== 3 || parts[0] !== SIGNED_LICENSE_PREFIX) {
    throw new Error('La licencia firmada no tiene un formato válido.')
  }

  const [, payloadBase64Url, signatureBase64Url] = parts

  if (!payloadBase64Url || !signatureBase64Url) {
    throw new Error('La licencia firmada está incompleta.')
  }

  const key = await importPublicLicenseKey()
  const isValidSignature = await globalThis.crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    base64UrlToBytes(signatureBase64Url),
    new TextEncoder().encode(payloadBase64Url),
  )

  if (!isValidSignature) {
    throw new Error('La firma digital de la licencia no es válida.')
  }

  const payload = validatePayloadShape(
    decodeBase64UrlJson<Partial<SignedLicensePayload>>(payloadBase64Url),
    deviceCode,
    options.checkExpiration,
  )

  return {
    activationCode: normalizedCode,
    expirationDate: payload.expiresAt ?? undefined,
    licenseType: payload.licenseType,
    payload,
  }
}

export async function verifySignedLicense(code: string, deviceCode: string) {
  return parseAndVerifySignedLicense(code, deviceCode, { checkExpiration: true })
}

export async function activateSignedLicense(code: string) {
  const identity = await getOrCreateDeviceIdentity()
  const validation = await verifySignedLicense(code, identity.deviceCode)
  const authorization = await authorizeSignedLicenseDevice(
    validation.activationCode,
    identity,
  )
  const currentLicense = await db.licenses.get(CURRENT_LICENSE_ID)
  const now = new Date().toISOString()
  const license: AppLicense = {
    id: CURRENT_LICENSE_ID,
    deviceCode: identity.deviceCode,
    activationCode: validation.activationCode,
    activationDate: now,
    expirationDate: validation.expirationDate,
    status: 'active',
    licenseType: validation.licenseType,
    licenseVersion: 2,
    licenseKey: authorization.licenseKey,
    userCode: identity.userCode,
    deviceName: identity.deviceName,
    platform: identity.platform,
    // Do NOT persist device authorization locally. Authorization must
    // always be validated against the backend (Neon). Keep only the
    // canonical license fields in IndexedDB.
    lastValidAccessDate: now,
    createdAt: currentLicense?.createdAt ?? now,
    updatedAt: now,
  }

  // Persist license without authorization metadata
  const licenseToPersist: AppLicense = {
    ...license,
    // Ensure authorization metadata is not stored locally
    deviceAuthorization: undefined,
    activeDevices: undefined,
    maxDevices: undefined,
  }

  await db.licenses.put(licenseToPersist)

  // Return a view that includes authorization info for immediate UI feedback
  return {
    ...licenseToPersist,
    deviceAuthorization: authorization.deviceAuthorization,
    activeDevices: authorization.activeDevices,
    maxDevices: authorization.maxDevices,
  }
}

async function markSignedLicenseExpired(license: AppLicense) {
  const expiredLicense: AppLicense = {
    ...license,
    status: 'expired',
    updatedAt: new Date().toISOString(),
  }

  await db.licenses.put(expiredLicense)

  return expiredLicense
}

export async function getSignedLicenseStatus(): Promise<SignedLicenseStatusResult> {
  const license = await db.licenses.get(CURRENT_LICENSE_ID)

  if (!license) {
    return { status: 'inactive' }
  }

  const deviceCode = await getDeviceCode()

  if (license.deviceCode !== deviceCode || license.status === 'inactive') {
    return { license, status: 'inactive' }
  }

  if (license.status === 'expired') {
    return { license, status: 'expired' }
  }

  if (license.licenseVersion === 2) {
    if (!license.activationCode) {
      return { license, status: 'inactive' }
    }

    try {
      await parseAndVerifySignedLicense(license.activationCode, deviceCode, {
        checkExpiration: false,
      })
    } catch {
      return { license, status: 'inactive' }
    }
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
    const expiredLicense = await markSignedLicenseExpired(license)

    return { license: expiredLicense, status: 'expired' }
  }

  const updatedLicense: AppLicense = {
    ...license,
    licenseVersion: license.licenseVersion ?? 1,
    lastValidAccessDate: new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  }

  await db.licenses.put(updatedLicense)
  logLicenseValidatedForExistingDeviceCode(deviceCode)

  return { license: updatedLicense, status: 'active' }
}

export async function isSignedLicenseValid() {
  return (await getSignedLicenseStatus()).status === 'active'
}
