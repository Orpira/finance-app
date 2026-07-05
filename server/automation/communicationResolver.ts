import { neon } from '@neondatabase/serverless'

export interface ActiveCommunicationChannel {
  id: string
  userCode: string
  provider: string
  status: string
  instanceName?: string
  instanceId?: string
  phoneNumber?: string
  ownerJid?: string
  profileName?: string
  profilePhoto?: string
  connectedAt?: string
  lastSeenAt?: string
  preferences?: unknown
  providerMetadata?: unknown
}

interface CommunicationChannelRow {
  id: string | number
  user_code: string
  provider: string
  instance_name: string | null
  instance_id: string | null
  phone_number: string | null
  owner_jid: string | null
  profile_name: string | null
  profile_photo: string | null
  connected_at: string | null
  last_seen_at: string | null
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

function isMissingLicenseDevicesTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const databaseError = error as { code?: string; message?: string }
  return databaseError.code === '42P01' ||
    databaseError.message?.includes('license_devices') === true
}

export function normalizeCommunicationInstanceName(value: string | null) {
  return value?.replace(/^=+/, '').trim() || undefined
}

function mapCommunicationChannelRow(row: CommunicationChannelRow) {
  return {
    id: String(row.id),
    userCode: row.user_code,
    provider: row.provider,
    status: row.status,
    instanceName: normalizeCommunicationInstanceName(row.instance_name),
    instanceId: row.instance_id ?? undefined,
    phoneNumber: row.phone_number ?? undefined,
    ownerJid: row.owner_jid ?? undefined,
    profileName: row.profile_name ?? undefined,
    profilePhoto: row.profile_photo ?? undefined,
    connectedAt: row.connected_at ?? undefined,
    lastSeenAt: row.last_seen_at ?? undefined,
    preferences: row.preferences,
    providerMetadata: row.provider_metadata,
  }
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
      instance_id TEXT,
      phone_number TEXT,
      status TEXT NOT NULL DEFAULT 'not_configured'
        CHECK (status IN ('not_configured', 'pending', 'connecting', 'connected', 'disconnected', 'revoked', 'error')),
      preferences JSONB NOT NULL DEFAULT '{}',
      provider_metadata JSONB NOT NULL DEFAULT '{}',
      owner_jid TEXT,
      profile_name TEXT,
      profile_photo TEXT,
      connected_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ,
      UNIQUE (user_code, device_code, provider)
    )
  `

  await sql`
    ALTER TABLE communication_channels
      ADD COLUMN IF NOT EXISTS instance_id TEXT,
      ADD COLUMN IF NOT EXISTS owner_jid TEXT,
      ADD COLUMN IF NOT EXISTS profile_name TEXT,
      ADD COLUMN IF NOT EXISTS profile_photo TEXT,
      ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ
  `

  await sql`
    DO $$
    DECLARE
      legacy_constraint_name TEXT;
    BEGIN
      SELECT conname INTO legacy_constraint_name
      FROM pg_constraint
      WHERE conrelid = 'communication_channels'::regclass
        AND contype = 'u'
        AND pg_get_constraintdef(oid) ILIKE '%(user_code, provider, instance_name)%'
      LIMIT 1;

      IF legacy_constraint_name IS NOT NULL THEN
        EXECUTE format(
          'ALTER TABLE communication_channels DROP CONSTRAINT %I',
          legacy_constraint_name
        );
      END IF;
    END $$;
  `

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS communication_channels_user_device_provider_idx
      ON communication_channels (user_code, device_code, provider)
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
      SELECT id, user_code, provider, instance_name, instance_id, phone_number,
        owner_jid, profile_name, profile_photo, connected_at, last_seen_at,
        status, preferences, provider_metadata
      FROM communication_channels
      WHERE user_code = ${userCode}
        AND status = 'connected'
    ` as CommunicationChannelRow[]

    return rows.map(mapCommunicationChannelRow)
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
      SELECT id, user_code, provider, instance_name, instance_id, phone_number,
        owner_jid, profile_name, profile_photo, connected_at, last_seen_at,
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

    return mapCommunicationChannelRow(row)
  } catch (error) {
    if (isMissingCommunicationTable(error)) return null
    throw error
  }
}

export async function resolveUserCodeFromDeviceCode(deviceCode: string): Promise<string | null> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return null

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT user_code
      FROM license_devices
      WHERE device_code = ${deviceCode}
        AND status = 'active'
      ORDER BY last_seen_at DESC
      LIMIT 1
    ` as Array<{ user_code: string }>

    const row = rows[0]
    if (!row) return null

    return row.user_code
  } catch (error) {
    if (isMissingLicenseDevicesTable(error)) return null
    throw error
  }
}
