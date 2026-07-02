/// <reference types="node" />

import {
  createHash,
  createHmac,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
  verify,
} from 'node:crypto'

const SIGNED_LICENSE_PREFIX = 'PB-LIC-V2'
const LICENSE_APP_ID = 'private-balance'
const LICENSE_VERSION = 2
const JWT_ISSUER = 'private-balance-automation'
const JWT_AUDIENCE = 'private-balance-automation-proxy'
const JWT_TTL_SECONDS = 15 * 60
const ALLOWED_LICENSE_TYPES = new Set([
  'demo',
  'monthly',
  'annual',
  'lifetime',
])

const publicLicenseKeyJwk = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'DYNiVDNSdO_PV1g6QE4n2xtPkZXdlxuY2T0FV2md7fs',
  y: 'LLO8InWuxK-EZDBqDegKqK8WQlvnnnzFSLqxynmqlzU',
  crv: 'P-256',
} as const

export interface SignedLicensePayload {
  app: string
  version: number
  deviceCode: string
  licenseType: string
  issuedAt: string
  expiresAt: string | null
  features: unknown
  devicePolicy?: 'multi' | 'single'
}

export interface AutomationJwtClaims {
  iss: typeof JWT_ISSUER
  aud: typeof JWT_AUDIENCE
  sub: string
  jti: string
  licenseType: string
  iat: number
  exp: number
}

function encodeBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString('base64url')
}

function decodeJson<T>(value: string) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T
}

function requireJwtSecret() {
  const secret = process.env.AUTOMATION_JWT_SECRET?.trim()

  if (!secret || secret.length < 32) {
    throw new Error('AUTOMATION_JWT_SECRET debe tener al menos 32 caracteres.')
  }

  return secret
}

function isValidIsoDate(value: unknown) {
  return typeof value === 'string' && Number.isFinite(new Date(value).getTime())
}

export function getSignedLicenseKey(activationCode: string) {
  return createHash('sha256')
    .update(activationCode.trim().replace(/\s+/g, ''))
    .digest('hex')
}

export function verifySignedLicense(activationCode: string) {
  const normalizedCode = activationCode.trim().replace(/\s+/g, '')
  const parts = normalizedCode.split('.')

  if (parts.length !== 3 || parts[0] !== SIGNED_LICENSE_PREFIX) {
    throw new Error('La licencia firmada no tiene un formato válido.')
  }

  const [, payloadBase64Url, signatureBase64Url] = parts
  if (!payloadBase64Url || !signatureBase64Url) {
    throw new Error('La licencia firmada está incompleta.')
  }

  const publicKey = createPublicKey({
    key: publicLicenseKeyJwk,
    format: 'jwk',
  })
  const validSignature = verify(
    'sha256',
    Buffer.from(payloadBase64Url),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(signatureBase64Url, 'base64url'),
  )

  if (!validSignature) {
    throw new Error('La firma digital de la licencia no es válida.')
  }

  const payload = decodeJson<Partial<SignedLicensePayload>>(payloadBase64Url)

  if (payload.app !== LICENSE_APP_ID || payload.version !== LICENSE_VERSION) {
    throw new Error('La licencia no pertenece a Private Balance.')
  }
  if (typeof payload.deviceCode !== 'string') {
    throw new Error('La licencia no contiene un dispositivo inicial válido.')
  }
  if (!payload.licenseType || !ALLOWED_LICENSE_TYPES.has(payload.licenseType)) {
    throw new Error('El tipo de licencia no es válido.')
  }
  if (!isValidIsoDate(payload.issuedAt) || !Array.isArray(payload.features)) {
    throw new Error('El contenido de la licencia no es válido.')
  }
  if (
    payload.devicePolicy !== undefined &&
    !['multi', 'single'].includes(payload.devicePolicy)
  ) {
    throw new Error('La política de dispositivos no es válida.')
  }
  if (payload.licenseType === 'lifetime') {
    if (payload.expiresAt !== null) {
      throw new Error('La licencia lifetime no es válida.')
    }
  } else if (
    !isValidIsoDate(payload.expiresAt) ||
    new Date(payload.expiresAt as string).getTime() <= Date.now()
  ) {
    throw new Error('La licencia ha expirado.')
  }

  return payload as SignedLicensePayload
}

export function verifySignedLicenseForDevice(
  activationCode: string,
  deviceCode: string,
) {
  const payload = verifySignedLicense(activationCode)
  const devicePolicy = payload.devicePolicy ?? 'multi'

  if (
    devicePolicy === 'single' &&
    payload.deviceCode.trim().toUpperCase() !== deviceCode.trim().toUpperCase()
  ) {
    throw new Error('Esta licencia pertenece a otro dispositivo.')
  }

  return payload
}

export function issueAutomationJwt(
  deviceCode: string,
  licenseType: string,
  licenseExpiresAt: string | null,
) {
  const now = Math.floor(Date.now() / 1000)
  const licenseExpiration = licenseExpiresAt
    ? Math.floor(new Date(licenseExpiresAt).getTime() / 1000)
    : Number.POSITIVE_INFINITY
  const claims: AutomationJwtClaims = {
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    sub: deviceCode,
    jti: randomUUID(),
    licenseType,
    iat: now,
    exp: Math.min(now + JWT_TTL_SECONDS, licenseExpiration),
  }
  const header = { alg: 'HS256', typ: 'JWT' }
  const unsignedToken = `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(claims))}`
  const signature = createHmac('sha256', requireJwtSecret())
    .update(unsignedToken)
    .digest('base64url')

  return {
    token: `${unsignedToken}.${signature}`,
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  }
}

export function verifyAutomationJwt(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('JWT inválido.')

  const [headerPart, claimsPart, signaturePart] = parts
  if (!headerPart || !claimsPart || !signaturePart) {
    throw new Error('JWT incompleto.')
  }

  const header = decodeJson<{ alg?: string; typ?: string }>(headerPart)
  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    throw new Error('Algoritmo JWT no permitido.')
  }

  const unsignedToken = `${headerPart}.${claimsPart}`
  const expectedSignature = createHmac('sha256', requireJwtSecret())
    .update(unsignedToken)
    .digest()
  const actualSignature = Buffer.from(signaturePart, 'base64url')

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error('Firma JWT inválida.')
  }

  const claims = decodeJson<AutomationJwtClaims>(claimsPart)
  const now = Math.floor(Date.now() / 1000)
  if (
    claims.iss !== JWT_ISSUER ||
    claims.aud !== JWT_AUDIENCE ||
    typeof claims.sub !== 'string' ||
    !claims.sub.startsWith('PB-') ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    typeof claims.iat !== 'number' ||
    claims.iat > now + 60
  ) {
    throw new Error('Claims JWT inválidos.')
  }

  return claims
}
