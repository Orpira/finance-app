/// <reference types="node" />

import { createHash, webcrypto } from 'node:crypto'

// Clave de firma DEDICADA a licencias de prueba (trial). Es intencionalmente
// distinta de la clave privada usada por scripts/generate-signed-license.mjs
// para licencias de pago (demo, monthly, annual, lifetime).
//
// Motivo: esta clave, a diferencia de la clave de licencias de pago, debe
// vivir como variable de entorno en el runtime del servidor (Vercel) para
// poder firmar trials automáticamente en cada solicitud. Eso la expone a un
// vector de ataque que la clave de pago nunca tiene (la de pago solo se usa
// offline, a mano, por el propietario). Si la clave de trial se filtrara,
// el daño se limita a permitir generar pruebas gratuitas de 7 días — nunca
// licencias de pago ni acceso indefinido.
//
// Generar el par de claves (una sola vez):
//   node scripts/generate-license-keys.mjs trial-private-key.json trial-public-key.json
//
// - trial-private-key.json -> pegar su contenido completo como el valor de
//   la variable de entorno TRIAL_LICENSE_PRIVATE_KEY_JWK en Vercel.
//   NUNCA debe entrar al repositorio (ya cubierto por los mismos patrones
//   de .gitignore que license-private-key.json).
// - trial-public-key.json -> pegar sus campos (kty, x, y, crv) aquí abajo,
//   en trialPublicLicenseKeyJwk, y en el equivalente del cliente
//   (src/services/signedLicenseService.ts).

export const trialPublicLicenseKeyJwk = {
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'LzRzoVexyh_gLcNQ1FUR2FNP9cVht6bPwB6KaIVhslQ',
  y: 'LLxQ49VMUVnMeEZ9yScyjKWPlEFGFprZ32Zkh6aS-j8',
  crv: 'P-256',
} as const

export const TRIAL_APP_ID = 'private-balance'
export const TRIAL_LICENSE_VERSION = 2
export const TRIAL_LICENSE_TYPE = 'trial'
export const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000
const SIGNED_LICENSE_PREFIX = 'PB-LIC-V2'

export interface TrialLicensePayload {
  app: typeof TRIAL_APP_ID
  version: typeof TRIAL_LICENSE_VERSION
  deviceCode: string
  licenseType: typeof TRIAL_LICENSE_TYPE
  issuedAt: string
  expiresAt: string
  features: string[]
  devicePolicy: 'single'
}

function base64UrlEncode(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function readTrialPrivateKeyJwk() {
  const raw = process.env.TRIAL_LICENSE_PRIVATE_KEY_JWK?.trim()

  if (!raw) {
    throw new Error(
      'La emisión de pruebas gratuitas no está configurada (falta TRIAL_LICENSE_PRIVATE_KEY_JWK).',
    )
  }

  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('TRIAL_LICENSE_PRIVATE_KEY_JWK no contiene un JWK válido.')
  }
}

async function importTrialPrivateKey() {
  return webcrypto.subtle.importKey(
    'jwk',
    readTrialPrivateKeyJwk(),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/**
 * Firma un nuevo código de licencia de prueba (7 días, atado a un único
 * dispositivo) usando la clave privada de trial. Formato idéntico al de las
 * licencias V2 de pago (PB-LIC-V2.<payload>.<firma>) para reutilizar toda la
 * lógica de validación, expiración y detección de manipulación de reloj que
 * ya existe en el cliente.
 */
export async function signTrialLicense(deviceCode: string, expiresAtOverride?: Date) {
  const now = new Date()
  // La reactivación de un trial vigente firma un nuevo activationCode (por
  // ejemplo tras cambiar de dispositivo o reinstalar) pero NUNCA extiende la
  // ventana de 7 días: reusa el expiresAt original vía expiresAtOverride.
  const expiresAt = expiresAtOverride ?? new Date(now.getTime() + TRIAL_DURATION_MS)

  const payload: TrialLicensePayload = {
    app: TRIAL_APP_ID,
    version: TRIAL_LICENSE_VERSION,
    deviceCode,
    licenseType: TRIAL_LICENSE_TYPE,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    features: ['core', 'backup', 'reports'],
    devicePolicy: 'single',
  }

  const payloadBase64Url = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  const privateKey = await importTrialPrivateKey()
  const signature = await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(payloadBase64Url),
  )
  const signatureBase64Url = base64UrlEncode(new Uint8Array(signature))
  const activationCode = `${SIGNED_LICENSE_PREFIX}.${payloadBase64Url}.${signatureBase64Url}`

  return { activationCode, payload, expiresAt: expiresAt.toISOString() }
}

export function getSignedLicenseKey(activationCode: string) {
  return createHash('sha256')
    .update(activationCode.trim().replace(/\s+/g, ''))
    .digest('hex')
}
