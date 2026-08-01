import { getNeonClient } from '../../neonClient.js'

export interface IdempotencyRecord {
  key: string
  payloadHash: string
  resultStatus: number
  resultBody: unknown
  createdAt: string
}

let schemaRequest: Promise<void> | undefined

async function ensureSchema() {
  const sql = getNeonClient()
  await sql`
    CREATE TABLE IF NOT EXISTS communication_idempotency_keys (
      idempotency_key TEXT PRIMARY KEY,
      payload_hash TEXT NOT NULL,
      result_status INTEGER NOT NULL,
      result_body JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS communication_idempotency_keys_expires_at_idx
      ON communication_idempotency_keys (expires_at)
  `
}

function ensureCommunicationIdempotencySchema() {
  if (!schemaRequest) {
    schemaRequest = ensureSchema().catch((error) => {
      schemaRequest = undefined
      throw error
    })
  }
  return schemaRequest
}

interface IdempotencyRow {
  idempotency_key: string
  payload_hash: string
  result_status: number
  result_body: unknown
  created_at: string
}

export async function getIdempotencyRecord(key: string): Promise<IdempotencyRecord | null> {
  await ensureCommunicationIdempotencySchema()
  const sql = getNeonClient()
  const rows = await sql`
    SELECT * FROM communication_idempotency_keys
    WHERE idempotency_key = ${key} AND expires_at > NOW()
    LIMIT 1
  ` as IdempotencyRow[]

  const row = rows[0]
  if (!row) return null

  return {
    key: row.idempotency_key,
    payloadHash: row.payload_hash,
    resultStatus: row.result_status,
    resultBody: row.result_body,
    createdAt: new Date(row.created_at).toISOString(),
  }
}

/**
 * Libera una clave reclamada por `claimEventOnce` (ver metaWebhookService.ts)
 * cuando el procesamiento posterior a la reclama falla: sin esto, un fallo
 * transitorio (p. ej. la base de datos rechaza `touchMetaChannelInbound`)
 * dejaría el evento marcado como "ya procesado" para siempre, aunque nunca
 * se completó — un reintento futuro de Meta (o el operador) nunca podría
 * reprocesarlo.
 */
export async function deleteIdempotencyRecord(key: string): Promise<void> {
  await ensureCommunicationIdempotencySchema()
  const sql = getNeonClient()
  await sql`DELETE FROM communication_idempotency_keys WHERE idempotency_key = ${key}`
}

export async function saveIdempotencyRecord(input: {
  key: string
  payloadHash: string
  resultStatus: number
  resultBody: unknown
  retentionDays: number
}): Promise<void> {
  await ensureCommunicationIdempotencySchema()
  const sql = getNeonClient()
  await sql`
    INSERT INTO communication_idempotency_keys (
      idempotency_key, payload_hash, result_status, result_body, created_at, expires_at
    ) VALUES (
      ${input.key}, ${input.payloadHash}, ${input.resultStatus}, ${JSON.stringify(input.resultBody)},
      NOW(), NOW() + make_interval(days => ${Math.max(input.retentionDays, 1)})
    )
    ON CONFLICT (idempotency_key) DO NOTHING
  `
  await sql`DELETE FROM communication_idempotency_keys WHERE expires_at <= NOW()`
}
