import { getNeonClient } from '../../neonClient.js'

let schemaRequest: Promise<void> | undefined

async function ensureSchema() {
  const sql = getNeonClient()
  await sql`
    CREATE TABLE IF NOT EXISTS communication_service_windows (
      contact_reference TEXT PRIMARY KEY,
      last_inbound_at TIMESTAMPTZ NOT NULL
    )
  `
}

function ensureServiceWindowSchema() {
  if (!schemaRequest) {
    schemaRequest = ensureSchema().catch((error) => {
      schemaRequest = undefined
      throw error
    })
  }
  return schemaRequest
}

export async function getLastInboundAt(contactReference: string): Promise<string | null> {
  await ensureServiceWindowSchema()
  const sql = getNeonClient()
  const rows = await sql`
    SELECT last_inbound_at FROM communication_service_windows
    WHERE contact_reference = ${contactReference}
    LIMIT 1
  ` as { last_inbound_at: string }[]

  const row = rows[0]
  return row ? new Date(row.last_inbound_at).toISOString() : null
}

export async function setLastInboundAt(contactReference: string, timestamp: string): Promise<void> {
  await ensureServiceWindowSchema()
  const sql = getNeonClient()
  await sql`
    INSERT INTO communication_service_windows (contact_reference, last_inbound_at)
    VALUES (${contactReference}, ${timestamp})
    ON CONFLICT (contact_reference) DO UPDATE SET
      last_inbound_at = GREATEST(communication_service_windows.last_inbound_at, EXCLUDED.last_inbound_at)
  `
}
