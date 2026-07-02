import { neon } from '@neondatabase/serverless'

export type LicenseDevicePlatform = 'web' | 'android' | 'ios' | 'unknown'

export interface LicenseRegistryInput {
  licenseKey: string
  userCode?: string
  deviceCode: string
  deviceName?: string
  platform?: LicenseDevicePlatform
  licenseType: string
  expiresAt: string | null
  devicePolicy: 'multi' | 'single'
}

export interface LicenseDeviceAuthorization {
  licenseKey: string
  deviceAuthorization: 'existing' | 'registered'
  activeDevices: number
  maxDevices: number
}

export class LicenseRegistryError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'database-unavailable'
      | 'license-revoked'
      | 'device-revoked'
      | 'device-limit-reached',
  ) {
    super(message)
  }
}

let schemaRequest: Promise<void> | undefined

const AUTHORIZE_DEVICE_FUNCTION_SQL = `
  CREATE OR REPLACE FUNCTION authorize_license_device(
    p_license_key TEXT,
    p_user_code TEXT,
    p_device_code TEXT,
    p_device_name TEXT,
    p_platform TEXT,
    p_license_type TEXT,
    p_expires_at TIMESTAMPTZ,
    p_device_policy TEXT,
    p_max_devices INTEGER
  )
  RETURNS TABLE (
    license_status TEXT,
    device_status TEXT,
    device_authorization TEXT,
    active_devices INTEGER,
    max_devices INTEGER
  )
  LANGUAGE plpgsql
  AS $$
  DECLARE
    current_license_status TEXT;
    current_device_status TEXT;
    configured_max_devices INTEGER;
    current_active_devices INTEGER;
  BEGIN
    INSERT INTO licenses (
      license_key,
      user_code,
      license_type,
      expires_at,
      device_policy,
      max_devices
    ) VALUES (
      p_license_key,
      p_user_code,
      p_license_type,
      p_expires_at,
      p_device_policy,
      p_max_devices
    )
    ON CONFLICT (license_key) DO UPDATE SET
      user_code = COALESCE(licenses.user_code, EXCLUDED.user_code),
      license_type = EXCLUDED.license_type,
      expires_at = EXCLUDED.expires_at,
      device_policy = EXCLUDED.device_policy,
      max_devices = EXCLUDED.max_devices,
      updated_at = NOW();

    SELECT status, licenses.max_devices
      INTO current_license_status, configured_max_devices
    FROM licenses
    WHERE license_key = p_license_key
    FOR UPDATE;

    IF current_license_status = 'revoked' THEN
      RETURN QUERY SELECT
        current_license_status, NULL::TEXT, NULL::TEXT, 0, configured_max_devices;
      RETURN;
    END IF;

    SELECT status
      INTO current_device_status
    FROM license_devices
    WHERE license_key = p_license_key
      AND device_code = p_device_code;

    IF FOUND THEN
      IF current_device_status = 'active' THEN
        UPDATE license_devices SET
          user_code = COALESCE(p_user_code, user_code),
          device_name = COALESCE(p_device_name, device_name),
          platform = p_platform,
          last_seen_at = NOW()
        WHERE license_key = p_license_key
          AND device_code = p_device_code;
      END IF;

      SELECT COUNT(*)::INTEGER INTO current_active_devices
      FROM license_devices
      WHERE license_key = p_license_key
        AND status = 'active';

      RETURN QUERY SELECT
        current_license_status,
        current_device_status,
        CASE WHEN current_device_status = 'active' THEN 'existing' ELSE NULL END,
        current_active_devices,
        configured_max_devices;
      RETURN;
    END IF;

    SELECT COUNT(*)::INTEGER INTO current_active_devices
    FROM license_devices
    WHERE license_key = p_license_key
      AND status = 'active';

    IF current_active_devices >= configured_max_devices THEN
      RETURN QUERY SELECT
        current_license_status, NULL::TEXT, NULL::TEXT,
        current_active_devices, configured_max_devices;
      RETURN;
    END IF;

    INSERT INTO license_devices (
      license_key,
      user_code,
      device_code,
      device_name,
      platform
    ) VALUES (
      p_license_key,
      p_user_code,
      p_device_code,
      p_device_name,
      p_platform
    );

    RETURN QUERY SELECT
      current_license_status, 'active'::TEXT, 'registered'::TEXT,
      current_active_devices + 1, configured_max_devices;
  END;
  $$
`

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) {
    throw new LicenseRegistryError(
      'El registro de licencias no está configurado.',
      'database-unavailable',
    )
  }
  return databaseUrl
}

function getConfiguredDeviceLimit() {
  const value = Number(process.env.MAX_DEVICES_PER_LICENSE ?? 3)
  return Number.isInteger(value) && value >= 1 && value <= 50 ? value : 3
}

async function ensureSchema() {
  const sql = neon(getDatabaseUrl())

  await sql`
    CREATE TABLE IF NOT EXISTS licenses (
      license_key TEXT PRIMARY KEY,
      user_code TEXT,
      license_type TEXT NOT NULL,
      expires_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
      device_policy TEXT NOT NULL DEFAULT 'multi'
        CHECK (device_policy IN ('multi', 'single')),
      max_devices INTEGER NOT NULL DEFAULT 3 CHECK (max_devices >= 1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS license_devices (
      id BIGSERIAL PRIMARY KEY,
      license_key TEXT NOT NULL REFERENCES licenses(license_key) ON DELETE CASCADE,
      user_code TEXT,
      device_code TEXT NOT NULL,
      device_name TEXT,
      platform TEXT NOT NULL DEFAULT 'unknown',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'revoked')),
      UNIQUE (license_key, device_code)
    )
  `

  await sql`
    CREATE INDEX IF NOT EXISTS license_devices_active_idx
      ON license_devices (license_key, status)
  `

  await sql.query(AUTHORIZE_DEVICE_FUNCTION_SQL)
}

function ensureLicenseRegistrySchema() {
  if (!schemaRequest) {
    schemaRequest = ensureSchema().catch((error) => {
      schemaRequest = undefined
      throw error
    })
  }
  return schemaRequest
}

interface AuthorizationRow {
  license_status: 'active' | 'revoked'
  device_status: 'active' | 'revoked' | null
  device_authorization: 'existing' | 'registered' | null
  active_devices: number
  max_devices: number
}

export async function authorizeLicenseDevice(
  input: LicenseRegistryInput,
): Promise<LicenseDeviceAuthorization> {
  await ensureLicenseRegistrySchema()

  const sql = neon(getDatabaseUrl())
  const maxDevices = input.devicePolicy === 'single'
    ? 1
    : getConfiguredDeviceLimit()
  const rows = await sql`
    SELECT * FROM authorize_license_device(
      ${input.licenseKey},
      ${input.userCode ?? null},
      ${input.deviceCode},
      ${input.deviceName ?? null},
      ${input.platform ?? 'unknown'},
      ${input.licenseType},
      ${input.expiresAt},
      ${input.devicePolicy},
      ${maxDevices}
    )
  ` as AuthorizationRow[]

  const result = rows[0]
  if (!result) {
    throw new LicenseRegistryError(
      'No se pudo consultar el registro de licencias.',
      'database-unavailable',
    )
  }
  if (result.license_status === 'revoked') {
    throw new LicenseRegistryError('La licencia está revocada.', 'license-revoked')
  }
  if (result.device_status === 'revoked') {
    throw new LicenseRegistryError(
      'Este dispositivo está revocado para la licencia.',
      'device-revoked',
    )
  }
  if (!result.device_authorization) {
    throw new LicenseRegistryError(
      'Límite de dispositivos alcanzado',
      'device-limit-reached',
    )
  }

  return {
    licenseKey: input.licenseKey,
    deviceAuthorization: result.device_authorization,
    activeDevices: result.active_devices,
    maxDevices: result.max_devices,
  }
}
