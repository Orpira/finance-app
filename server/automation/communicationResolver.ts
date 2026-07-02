import { neon } from '@neondatabase/serverless'

export interface ActiveCommunicationChannel {
  id: string
  userCode: string
  channel: string
  status: string
  config?: unknown
}

interface CommunicationChannelRow {
  id: string | number
  user_code: string
  channel: string
  status: string
  config?: unknown
}

function isMissingCommunicationTable(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const databaseError = error as { code?: string; message?: string }
  return databaseError.code === '42P01' ||
    databaseError.message?.includes('communication_channels') === true
}

export async function resolveActiveCommunicationChannels(
  userCode: string,
): Promise<ActiveCommunicationChannel[]> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) return []

  try {
    const sql = neon(databaseUrl)
    const rows = await sql`
      SELECT id, user_code, channel, status, config
      FROM communication_channels
      WHERE user_code = ${userCode}
        AND status = 'active'
    ` as CommunicationChannelRow[]

    return rows.map((row) => ({
      id: String(row.id),
      userCode: row.user_code,
      channel: row.channel,
      status: row.status,
      config: row.config,
    }))
  } catch (error) {
    if (isMissingCommunicationTable(error)) return []
    throw error
  }
}

export async function resolveActiveWhatsappChannel(userCode: string) {
  const channels = await resolveActiveCommunicationChannels(userCode)
  return channels.find((channel) => channel.channel === 'whatsapp') ?? null
}
