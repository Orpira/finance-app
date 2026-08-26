import { neon } from '@neondatabase/serverless'

export class CanonicalIdentityError extends Error {
  constructor() {
    super('No se pudo resolver la identidad canónica del dispositivo.')
    this.name = 'CanonicalIdentityError'
  }
}

interface CanonicalIdentityRow {
  user_code: string
}

export async function resolveCanonicalUserCode(deviceCode: string): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new CanonicalIdentityError()

  const sql = neon(databaseUrl)
  let rows: CanonicalIdentityRow[]
  try {
    rows = await sql`
      SELECT DISTINCT ld.user_code
      FROM license_devices ld
      INNER JOIN licenses l ON l.license_key = ld.license_key
      WHERE ld.device_code = ${deviceCode}
        AND ld.status = 'active'
        AND ld.user_code IS NOT NULL
        AND BTRIM(ld.user_code) <> ''
        AND l.status = 'active'
        AND (l.expires_at IS NULL OR l.expires_at > NOW())
    ` as CanonicalIdentityRow[]
  } catch {
    throw new CanonicalIdentityError()
  }

  const userCodes = new Set(rows.map((row) => row.user_code))
  const [userCode] = userCodes
  if (userCodes.size !== 1 || !userCode) throw new CanonicalIdentityError()
  return userCode
}
