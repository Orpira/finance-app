import { neon } from '@neondatabase/serverless'

export interface ActiveCommunicationChannel {
  id: string
  userCode: string
  provider: string
  status: string
  instanceName?: string
  phoneNumber?: string
  preferences?: unknown
  providerMetadata?: unknown
}

interface CommunicationChannelRow {
  id: string | number
  user_code: string
  provider: string
  instance_name: string | null
  phone_number: string | null
  status: string
  preferences: unknown
  provider_metadata: unknown
}

function isMissingCommunicationTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const databaseError = error as { code?: string; message?: string }
  return databaseError.code === '42P01' ||
    databaseError.message?.includes('communication_channels') === true
}

export async function ensureCommunicationSchema() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return

  const sql = neon(databaseUrl)

  await sql`
    CREATE TABLE IF NOT EXISTS communication_channels (
      id BIGSERIAL PRIMARY KEY,
      user_code TEXT NOT NULL,
      device_code TEXT,
      provider TEXT NOT NULL
        CHECK (provider IN ('whatsapp', 'email', 'telegram', 'signal', 'sms')),
      instance_name TEXT,
      phone_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'connected', 'disconnected', 'revoked', 'error')),
      preferences JSONB NOT NULL DEFAULT '{}',
      provider_metadata JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ,
      UNIQUE (user_code, provider, instance_name)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS communication_channels_user_provider_idx
      ON communication_channels (user_code, provider)
  `

  await sql`
    CREATE INDEX IF NOT EXISTS communication_channels_status_idx
      ON communication_channels (status)
  `
}

export async function resolveActiveCommunicationChannels(
  userCode: string,
): Promise<ActiveCommunicationChannel[]> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return []

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT id, user_code, provider, instance_name, phone_number,
        status, preferences, provider_metadata
      FROM communication_channels
      WHERE user_code = ${userCode}
        AND status = 'connected'
    ` as CommunicationChannelRow[]

    return rows.map((row) => ({
      id: String(row.id),
      userCode: row.user_code,
      provider: row.provider,
      status: row.status,
      instanceName: row.instance_name ?? undefined,
      phoneNumber: row.phone_number ?? undefined,
      preferences: row.preferences,
      providerMetadata: row.provider_metadata,
    }))
  } catch (error) {
    if (isMissingCommunicationTable(error)) return []
    throw error
  }
}

export async function resolveActiveWhatsappChannel(userCode: string) {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return null

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT id, user_code, provider, instance_name, phone_number,
        status, preferences, provider_metadata
      FROM communication_channels
      WHERE user_code = ${userCode}
        AND provider = 'whatsapp'
        AND status = 'connected'
      ORDER BY updated_at DESC
      LIMIT 1
    ` as CommunicationChannelRow[]

    const row = rows[0]
    if (!row) return null

    return {
      id: String(row.id),
      userCode: row.user_code,
      provider: row.provider,
      status: row.status,
      instanceName: row.instance_name ?? undefined,
      phoneNumber: row.phone_number ?? undefined,
      preferences: row.preferences,
      providerMetadata: row.provider_metadata,
    }
  } catch (error) {
    if (isMissingCommunicationTable(error)) return null
    throw error
  }
}
