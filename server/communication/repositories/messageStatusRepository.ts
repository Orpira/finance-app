import { getNeonClient } from '../../neonClient.js'

/**
 * Guarda únicamente metadatos técnicos del estado de un mensaje. Nunca
 * texto del mensaje, información financiera, ni el nombre completo del
 * destinatario — solo lo necesario para correlacionar y depurar entregas.
 */
export interface MessageStatusRecord {
  providerMessageId: string
  requestId?: string
  status: string
  errorCode?: string
  errorMessage?: string
  occurredAt: string
}

let schemaRequest: Promise<void> | undefined

async function ensureSchema() {
  const sql = getNeonClient()
  await sql`
    CREATE TABLE IF NOT EXISTS communication_message_statuses (
      id BIGSERIAL PRIMARY KEY,
      provider_message_id TEXT NOT NULL,
      request_id TEXT,
      status TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      occurred_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS communication_message_statuses_provider_message_id_idx
      ON communication_message_statuses (provider_message_id, occurred_at DESC)
  `
}

function ensureMessageStatusSchema() {
  if (!schemaRequest) {
    schemaRequest = ensureSchema().catch((error) => {
      schemaRequest = undefined
      throw error
    })
  }
  return schemaRequest
}

interface MessageStatusRow {
  provider_message_id: string
  request_id: string | null
  status: string
  error_code: string | null
  error_message: string | null
  occurred_at: string
}

export async function recordMessageStatus(record: MessageStatusRecord): Promise<void> {
  await ensureMessageStatusSchema()
  const sql = getNeonClient()
  await sql`
    INSERT INTO communication_message_statuses (
      provider_message_id, request_id, status, error_code, error_message, occurred_at
    ) VALUES (
      ${record.providerMessageId}, ${record.requestId ?? null}, ${record.status},
      ${record.errorCode ?? null}, ${record.errorMessage ?? null}, ${record.occurredAt}
    )
  `
}

export async function getLatestMessageStatus(
  providerMessageId: string,
): Promise<MessageStatusRecord | null> {
  await ensureMessageStatusSchema()
  const sql = getNeonClient()
  const rows = await sql`
    SELECT * FROM communication_message_statuses
    WHERE provider_message_id = ${providerMessageId}
    ORDER BY occurred_at DESC
    LIMIT 1
  ` as MessageStatusRow[]

  const row = rows[0]
  if (!row) return null

  return {
    providerMessageId: row.provider_message_id,
    requestId: row.request_id ?? undefined,
    status: row.status,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    occurredAt: new Date(row.occurred_at).toISOString(),
  }
}
