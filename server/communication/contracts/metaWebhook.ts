export type NormalizedInboundMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'interactive'
  | 'location'
  | 'unknown'

export interface NormalizedInboundWhatsAppMessage {
  provider: 'meta-cloud'
  providerMessageId: string
  phoneNumberId: string
  senderPhone: string
  senderName?: string
  timestamp: string
  type: NormalizedInboundMessageType
  text?: string
}

export type NormalizedWhatsAppMessageStatusValue =
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'unknown'

export interface NormalizedWhatsAppMessageStatus {
  provider: 'meta-cloud'
  providerMessageId: string
  recipientPhone?: string
  status: NormalizedWhatsAppMessageStatusValue
  timestamp: string
  errorCode?: string
  errorMessage?: string
}

export interface NormalizedMetaWebhookEvent {
  messages: NormalizedInboundWhatsAppMessage[]
  statuses: NormalizedWhatsAppMessageStatus[]
  unknownEntries: number
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function normalizeMessageType(rawType: unknown): NormalizedInboundMessageType {
  const type = typeof rawType === 'string' ? rawType : ''
  const known: readonly NormalizedInboundMessageType[] = [
    'text', 'image', 'audio', 'video', 'document', 'interactive', 'location',
  ]
  return (known as readonly string[]).includes(type) ? type as NormalizedInboundMessageType : 'unknown'
}

function normalizeStatusValue(rawStatus: unknown): NormalizedWhatsAppMessageStatusValue {
  const status = typeof rawStatus === 'string' ? rawStatus : ''
  const known: readonly NormalizedWhatsAppMessageStatusValue[] = ['sent', 'delivered', 'read', 'failed']
  return (known as readonly string[]).includes(status) ? status as NormalizedWhatsAppMessageStatusValue : 'unknown'
}

// Antes de 2001-09-09 (el propio origen del formato de webhooks de Meta) y
// después de 2100-01-01: fuera de rango razonable, se trata como inválido.
const MIN_VALID_UNIX_SECONDS = 1_000_000_000
const MAX_VALID_UNIX_SECONDS = 4_102_444_800

/**
 * Marcador determinista para "timestamp ausente o inválido" (época Unix).
 * Deliberadamente NO se usa `new Date()` (la hora de recepción): la clave de
 * idempotencia de un estado es `status:<id>:<status>:<timestamp>` (ver
 * metaWebhookService.ts). Si dos entregas del mismo estado con un timestamp
 * inválido normalizaran a la hora actual, cada entrega generaría una clave
 * distinta y la deduplicación dejaría de funcionar exactamente para el caso
 * que más la necesita (payloads malformados que Meta reintenta). Un
 * marcador fijo mantiene la misma clave en cada reintento; el campo
 * `unknownEntries` ya deja constancia de que hubo datos con forma
 * inesperada, así que esto no oculta el problema, solo evita que rompa la
 * deduplicación.
 */
const UNKNOWN_TIMESTAMP_ISO = new Date(0).toISOString()

/**
 * Meta envía message.timestamp/status.timestamp como Unix timestamp en
 * segundos, normalmente como cadena de dígitos (p. ej. "1504902988"), pero
 * el contrato también admite un número ya parseado. Guardar el valor
 * literal como texto hace que Postgres falle con "date/time field value out
 * of range" al intentar interpretarlo como fecha, así que aquí siempre se
 * produce un ISO 8601 válido o el marcador `UNKNOWN_TIMESTAMP_ISO` anterior.
 */
export function normalizeMetaTimestamp(value: unknown): string {
  let seconds: number | undefined
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    seconds = Number(value)
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    seconds = value
  }

  if (
    seconds !== undefined &&
    Number.isFinite(seconds) &&
    seconds >= MIN_VALID_UNIX_SECONDS &&
    seconds <= MAX_VALID_UNIX_SECONDS
  ) {
    const date = new Date(seconds * 1000)
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString()
    }
  }

  return UNKNOWN_TIMESTAMP_ISO
}

/**
 * Estructura real de Meta:
 * { object, entry: [{ id, changes: [{ value: { metadata, contacts, messages, statuses }, field }] }] }
 * Cualquier forma inesperada se cuenta como `unknownEntries` en lugar de
 * lanzar un error global (los eventos desconocidos no deben tumbar el
 * webhook completo).
 */
export function normalizeMetaWebhookPayload(payload: unknown): NormalizedMetaWebhookEvent {
  const messages: NormalizedInboundWhatsAppMessage[] = []
  const statuses: NormalizedWhatsAppMessageStatus[] = []
  let unknownEntries = 0

  const body = asRecord(payload)
  const entries = asArray(body?.entry)

  for (const entry of entries) {
    const changes = asArray(asRecord(entry)?.changes)
    for (const change of changes) {
      const value = asRecord(asRecord(change)?.value)
      if (!value) {
        unknownEntries += 1
        continue
      }

      const metadata = asRecord(value.metadata)
      const phoneNumberId = typeof metadata?.phone_number_id === 'string' ? metadata.phone_number_id : ''
      const contacts = asArray(value.contacts)
      const senderName = typeof asRecord(contacts[0])?.profile === 'object'
        ? (asRecord(asRecord(contacts[0])?.profile)?.name as string | undefined)
        : undefined

      const rawMessages = asArray(value.messages)
      for (const rawMessage of rawMessages) {
        const message = asRecord(rawMessage)
        if (!message || typeof message.id !== 'string' || typeof message.from !== 'string') {
          unknownEntries += 1
          continue
        }
        const text = asRecord(message.text)
        messages.push({
          provider: 'meta-cloud',
          providerMessageId: message.id,
          phoneNumberId,
          senderPhone: message.from,
          senderName,
          timestamp: normalizeMetaTimestamp(message.timestamp),
          type: normalizeMessageType(message.type),
          ...(typeof text?.body === 'string' ? { text: text.body } : {}),
        })
      }

      const rawStatuses = asArray(value.statuses)
      for (const rawStatus of rawStatuses) {
        const status = asRecord(rawStatus)
        if (!status || typeof status.id !== 'string') {
          unknownEntries += 1
          continue
        }
        const errors = asArray(status.errors)
        const firstError = asRecord(errors[0])
        statuses.push({
          provider: 'meta-cloud',
          providerMessageId: status.id,
          recipientPhone: typeof status.recipient_id === 'string' ? status.recipient_id : undefined,
          status: normalizeStatusValue(status.status),
          timestamp: normalizeMetaTimestamp(status.timestamp),
          ...(firstError && typeof firstError.code !== 'undefined' ? { errorCode: String(firstError.code) } : {}),
          ...(typeof firstError?.title === 'string' ? { errorMessage: firstError.title } : {}),
        })
      }

      if (rawMessages.length === 0 && rawStatuses.length === 0) {
        unknownEntries += 1
      }
    }
  }

  return { messages, statuses, unknownEntries }
}
