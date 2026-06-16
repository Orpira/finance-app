const PBKDF2_ITERATIONS = 210_000
const SALT_LENGTH = 16
const IV_LENGTH = 12

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return window.btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = window.atob(value)
  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}

function bytesToArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
}

async function deriveAesKey(passwordOrKey: string, salt: Uint8Array) {
  if (!passwordOrKey.trim()) {
    throw new Error('La clave de cifrado es obligatoria.')
  }

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passwordOrKey),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return window.crypto.subtle.deriveKey(
    {
      hash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      name: 'PBKDF2',
      salt: bytesToArrayBuffer(salt),
    },
    keyMaterial,
    {
      length: 256,
      name: 'AES-GCM',
    },
    false,
    ['encrypt', 'decrypt'],
  )
}

export interface EncryptedPayload {
  algorithm: 'AES-GCM'
  ciphertext: string
  iv: string
  iterations: number
  kdf: 'PBKDF2-SHA256'
  salt: string
}

export async function encryptJsonPayload(
  data: unknown,
  passwordOrKey: string,
): Promise<EncryptedPayload> {
  if (!window.crypto?.subtle) {
    throw new Error('El cifrado Web Crypto no está disponible en este entorno.')
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveAesKey(passwordOrKey, salt)
  const encodedData = new TextEncoder().encode(JSON.stringify(data))
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      iv: bytesToArrayBuffer(iv),
      name: 'AES-GCM',
    },
    key,
    encodedData,
  )

  return {
    algorithm: 'AES-GCM',
    ciphertext: bytesToBase64(new Uint8Array(encryptedBuffer)),
    iv: bytesToBase64(iv),
    iterations: PBKDF2_ITERATIONS,
    kdf: 'PBKDF2-SHA256',
    salt: bytesToBase64(salt),
  }
}

export async function decryptJsonPayload<T>(
  encryptedPayload: EncryptedPayload,
  passwordOrKey: string,
) {
  const salt = base64ToBytes(encryptedPayload.salt)
  const iv = base64ToBytes(encryptedPayload.iv)
  const ciphertext = base64ToBytes(encryptedPayload.ciphertext)
  const key = await deriveAesKey(passwordOrKey, salt)
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      iv: bytesToArrayBuffer(iv),
      name: 'AES-GCM',
    },
    key,
    ciphertext,
  )
  const decryptedText = new TextDecoder().decode(decryptedBuffer)

  return JSON.parse(decryptedText) as T
}
