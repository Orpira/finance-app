import { webcrypto } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const APP_ID = 'private-balance'
const LICENSE_VERSION = 2
const DEFAULT_PRIVATE_KEY_PATH = 'license-private-key.json'
const VALID_LICENSE_TYPES = new Set(['demo', 'monthly', 'annual', 'lifetime'])

function printUsage() {
  console.log(`
Uso:
node scripts/generate-signed-license.mjs DEVICE_CODE TIPO_LICENCIA [FECHA_EXPIRACION]

Ejemplos:
node scripts/generate-signed-license.mjs PB-F78A-870C-3216 demo 2026-07-31
node scripts/generate-signed-license.mjs PB-F78A-870C-3216 lifetime
node scripts/generate-signed-license.mjs PB-F78A-870C-3216 lifetime --single-device

Clave privada:
- LICENSE_PRIVATE_KEY_JWK='{"kty":"EC",...}' node scripts/generate-signed-license.mjs ...
- LICENSE_PRIVATE_KEY_PATH=/ruta/segura/private.json node scripts/generate-signed-license.mjs ...
- Por defecto lee ./license-private-key.json, archivo ignorado por Git.
`)
}

function base64UrlEncode(bytes) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function normalizeExpirationDate(value) {
  if (!value) {
    throw new Error('Las licencias temporales requieren fecha de expiración.')
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T23:59:59.999Z`
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error('La fecha de expiración debe ser YYYY-MM-DD o ISO válida.')
  }

  return date.toISOString()
}

async function readPrivateKeyJwk() {
  if (process.env.LICENSE_PRIVATE_KEY_JWK) {
    return JSON.parse(process.env.LICENSE_PRIVATE_KEY_JWK)
  }

  const keyPath = process.env.LICENSE_PRIVATE_KEY_PATH ?? DEFAULT_PRIVATE_KEY_PATH
  const content = await readFile(keyPath, 'utf8')

  return JSON.parse(content)
}

async function importPrivateKey(jwk) {
  return webcrypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

const [, , deviceCode, licenseType, expirationDate] = process.argv
const devicePolicy = process.argv.includes('--single-device') ? 'single' : 'multi'

if (!deviceCode || !licenseType) {
  printUsage()
  process.exit(1)
}

if (!VALID_LICENSE_TYPES.has(licenseType)) {
  throw new Error('Tipo de licencia inválido: demo, monthly, annual, lifetime.')
}

const now = new Date().toISOString()
const payload = {
  app: APP_ID,
  version: LICENSE_VERSION,
  deviceCode: deviceCode.trim().toUpperCase(),
  licenseType,
  issuedAt: now,
  expiresAt:
    licenseType === 'lifetime' ? null : normalizeExpirationDate(expirationDate),
  features: ['core', 'backup', 'reports'],
  devicePolicy,
}

const privateKey = await importPrivateKey(await readPrivateKeyJwk())
const payloadBase64Url = base64UrlEncode(
  new TextEncoder().encode(JSON.stringify(payload)),
)
const signature = await webcrypto.subtle.sign(
  { name: 'ECDSA', hash: 'SHA-256' },
  privateKey,
  new TextEncoder().encode(payloadBase64Url),
)
const signatureBase64Url = base64UrlEncode(new Uint8Array(signature))

console.log(`PB-LIC-V2.${payloadBase64Url}.${signatureBase64Url}`)
