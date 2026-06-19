const HASH_VERSION = 'v2'
const LEGACY_HASH_VERSION = 'v1'
const PBKDF2_ITERATIONS = 210_000
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

async function pbkdf2(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      salt: new TextEncoder().encode(salt),
    },
    key,
    256,
  )

  return bytesToHex(bits)
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
  const hash = await pbkdf2(pin, salt)

  return `${HASH_VERSION}:${PBKDF2_ITERATIONS}:${salt}:${hash}`
}

export async function verifyPinHash(pin: string, storedHash: string) {
  const [version, iterationsOrSalt, saltOrHash, storedHashValue] = storedHash.split(':')

  if (version === LEGACY_HASH_VERSION && iterationsOrSalt && saltOrHash) {
    return (await sha256(`${iterationsOrSalt}:${pin}`)) === saltOrHash
  }

  if (
    version !== HASH_VERSION ||
    Number(iterationsOrSalt) !== PBKDF2_ITERATIONS ||
    !saltOrHash ||
    !storedHashValue
  ) return false

  const candidateHash = await pbkdf2(pin, saltOrHash)

  return candidateHash === storedHashValue
}
