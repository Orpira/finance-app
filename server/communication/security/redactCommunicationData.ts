const SENSITIVE_KEYS = new Set([
  'accesstoken', 'access_token', 'appsecret', 'app_secret', 'verifytoken',
  'verify_token', 'apikey', 'api_key', 'authorization', 'text', 'body',
  'components', 'password', 'token',
])

function hashPhoneNumber(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return `phone_${hash.toString(16)}`
}

function isLikelyPhoneNumber(value: string) {
  return /^\+?\d{7,20}$/.test(value.trim())
}

/**
 * Prepara datos para logging: nunca deja pasar tokens/secretos, y sustituye
 * números de teléfono y texto de mensajes por un hash u omisión. Pensado
 * para usarse antes de cualquier `console.info`/`console.error` en este
 * módulo (no hay un logger dedicado en el repositorio; se reutiliza console,
 * igual que el resto del backend).
 */
export function redactCommunicationData(value: unknown): unknown {
  if (typeof value === 'string') {
    return isLikelyPhoneNumber(value) ? hashPhoneNumber(value) : value
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactCommunicationData(item))
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) return [key, '[redacted]'] as const
      return [key, redactCommunicationData(nested)] as const
    })
    return Object.fromEntries(entries)
  }
  return value
}

export function logCommunicationEvent(event: string, fields: object) {
  console.info(JSON.stringify({ event, ...redactCommunicationData(fields) as Record<string, unknown> }))
}
