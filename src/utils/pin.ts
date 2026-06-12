const HASH_VERSION = 'v1'
const PIN_PATTERN = /^\d{4,6}$/

function bytesToHex(bytes: ArrayBuffer | Uint8Array) {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)

  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)

  return bytesToHex(hash)
}

function createSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)

  return bytesToHex(bytes)
}

export function isValidPin(pin: string) {
  return PIN_PATTERN.test(pin)
}

export async function createPinHash(pin: string) {
  const salt = createSalt()
  const hash = await sha256(`${salt}:${pin}`)

  return `${HASH_VERSION}:${salt}:${hash}`
}

export async function verifyPinHash(pin: string, storedHash: string) {
  const [version, salt, hash] = storedHash.split(':')

  if (version !== HASH_VERSION || !salt || !hash) {
    return false
  }

  const candidateHash = await sha256(`${salt}:${pin}`)

  return candidateHash === hash
}
