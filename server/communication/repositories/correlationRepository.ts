import { getNeonClient } from '../../neonClient.js'

export interface CorrelationRecord {
  id: string
  eventId: string | null
  workflowId: string | null
  requestId: string
  providerMessageId: string | null
  userReference: string | null
  deviceReference: string | null
  status: string
  createdAt: string
  updatedAt: string
}

let schemaRequest: Promise<void> | undefined

async function ensureSchema() {
  const sql = getNeonClient()
  await sql`
    CREATE TABLE IF NOT EXISTS communication_message_correlations (
      id BIGSERIAL PRIMARY KEY,
      event_id TEXT,
      workflow_id TEXT,
      request_id TEXT NOT NULL,
      provider_message_id TEXT,
      user_reference TEXT,
      device_reference TEXT,
      status TEXT NOT NULL DEFAULT 'accepted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (request_id)
    )
  `
  await sql`
    CREATE INDEX IF NOT EXISTS communication_message_correlations_provider_message_id_idx
      ON communication_message_correlations (provider_message_id)
      WHERE provider_message_id IS NOT NULL
  `
}

function ensureCorrelationSchema() {
  if (!schemaRequest) {
    schemaRequest = ensureSchema().catch((error) => {
      schemaRequest = undefined
      throw error
    })
  }
  return schemaRequest
}

function mapRow(row: Record<string, unknown>): CorrelationRecord {
  return {
    id: String(row.id),
    eventId: row.event_id === null ? null : String(row.event_id),
    workflowId: row.workflow_id === null ? null : String(row.workflow_id),
    requestId: String(row.request_id),
    providerMessageId: row.provider_message_id === null ? null : String(row.provider_message_id),
    userReference: row.user_reference === null ? null : String(row.user_reference),
    deviceReference: row.device_reference === null ? null : String(row.device_reference),
    status: String(row.status),
    createdAt: new Date(row.created_at as string).toISOString(),
    updatedAt: new Date(row.updated_at as string).toISOString(),
  }
}

export interface RecordCorrelationInput {
  requestId: string
  eventId?: string | null
  workflowId?: string | null
  providerMessageId?: string | null
  userReference?: string | null
  deviceReference?: string | null
  status: string
}

export async function recordCorrelation(input: RecordCorrelationInput): Promise<void> {
  await ensureCorrelationSchema()
  const sql = getNeonClient()
  await sql`
    INSERT INTO communication_message_correlations (
      event_id, workflow_id, request_id, provider_message_id, user_reference, device_reference, status
    ) VALUES (
      ${input.eventId ?? null}, ${input.workflowId ?? null}, ${input.requestId}, ${input.providerMessageId ?? null},
      ${input.userReference ?? null}, ${input.deviceReference ?? null}, ${input.status}
    )
    ON CONFLICT (request_id) DO UPDATE SET
      provider_message_id = COALESCE(EXCLUDED.provider_message_id, communication_message_correlations.provider_message_id),
      status = EXCLUDED.status,
      updated_at = NOW()
  `
}

export async function updateCorrelationStatusByProviderMessageId(
  providerMessageId: string,
  status: string,
): Promise<void> {
  await ensureCorrelationSchema()
  const sql = getNeonClient()
  await sql`
    UPDATE communication_message_correlations
    SET status = ${status}, updated_at = NOW()
    WHERE provider_message_id = ${providerMessageId}
  `
}

export async function getCorrelationByRequestId(requestId: string): Promise<CorrelationRecord | null> {
  await ensureCorrelationSchema()
  const sql = getNeonClient()
  const rows = await sql`
    SELECT * FROM communication_message_correlations WHERE request_id = ${requestId} LIMIT 1
  ` as Record<string, unknown>[]
  return rows[0] ? mapRow(rows[0]) : null
}
