import { neon } from '@neondatabase/serverless'

const [action, deviceCode, licenseKey, days, ...extra] = process.argv.slice(2)
const usage = `Uso:
  node scripts/manage-device-access.mjs list CODIGO_EQUIPO
  node scripts/manage-device-access.mjs set-days CODIGO_EQUIPO HUELLA_LICENCIA DIAS
  node scripts/manage-device-access.mjs revoke CODIGO_EQUIPO HUELLA_LICENCIA
  node scripts/manage-device-access.mjs restore CODIGO_EQUIPO HUELLA_LICENCIA

Configura DATABASE_URL en el entorno de administración antes de ejecutar.`

async function main() {
  if (action === '--help' || action === undefined) {
    console.log(usage)
    return
  }

  const dayCount = Number(days)
  const validDeviceCode = /^PB-(?:[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}|DEVICE-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/i
  if (!validDeviceCode.test(deviceCode ?? '') || extra.length ||
    !['list', 'set-days', 'revoke', 'restore'].includes(action) ||
    (action === 'list' ? licenseKey !== undefined : !/^[a-f0-9]{64}$/.test(licenseKey ?? '')) ||
    (action === 'set-days'
      ? !/^\d+$/.test(days ?? '') || dayCount < 1 || dayCount > 3650
      : days !== undefined)) {
    console.error(usage)
    process.exitCode = 2
    return
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error('Configura DATABASE_URL en el entorno de administración.')
    process.exitCode = 2
    return
  }

  const sql = neon(process.env.DATABASE_URL)
  if (action === 'list') {
    const rows = await sql`
      SELECT license_key, device_code, platform, status, access_ends_at, last_seen_at
      FROM license_devices WHERE device_code = ${deviceCode}
      ORDER BY last_seen_at DESC
    `
    console.table(rows)
    return
  }

  const rows = await sql`
    UPDATE license_devices
    SET status = CASE WHEN ${action} = 'revoke' THEN 'revoked' ELSE 'active' END,
        access_ends_at = CASE
          WHEN ${action} = 'set-days' THEN NOW() + ${action === 'set-days' ? dayCount : 0}::integer * INTERVAL '24 hours'
          WHEN ${action} = 'restore' THEN NULL
          ELSE access_ends_at
        END,
        updated_at = NOW()
    WHERE device_code = ${deviceCode} AND license_key = ${licenseKey}
      AND (${action} <> 'set-days' OR status = 'active')
    RETURNING device_code, status, access_ends_at
  `
  if (rows.length !== 1) {
    console.error('No se modificó ningún equipo. Revisa la huella, el código y el estado.')
    process.exitCode = 1
    return
  }
  console.table(rows)
}

main().catch(() => {
  console.error('No se pudo completar la operación. Verifica la conexión a Neon y la migración 008.')
  process.exitCode = 1
})
