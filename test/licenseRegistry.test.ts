import { describe, it, expect, beforeEach, vi } from 'vitest'

type MockSqlResponseFactory = (...args: unknown[]) => unknown

interface MockSqlFunction {
  (...args: unknown[]): Promise<unknown> | unknown
  query: () => Promise<unknown[]>
  _nextResponse: unknown
}

// Mock @neondatabase/serverless neon function
vi.mock('@neondatabase/serverless', () => {
  const sqlFunction = ((...args: unknown[]) => {
    const nextResponse = sqlFunction._nextResponse

    if (typeof nextResponse === 'function') {
      return (nextResponse as MockSqlResponseFactory)(...args)
    }

    return Promise.resolve(nextResponse)
  }) as MockSqlFunction

  sqlFunction.query = async () => []
  sqlFunction._nextResponse = []

  return {
    neon: () => sqlFunction,
  }
})

import {
  AUTHORIZE_DEVICE_FUNCTION_SQL,
  BACKFILL_DEVICE_USER_CODES_FROM_LICENSES_SQL,
  BACKFILL_FROM_COMMUNICATION_CHANNELS_SQL,
  BACKFILL_LICENSE_USER_CODES_FROM_DEVICES_SQL,
  authorizeLicenseDevice,
} from '../server/licenseDeviceRegistry'

const DUMMY_DB_URL = 'postgresql://user:pass@localhost/db'

beforeEach(() => {
  process.env.DATABASE_URL = DUMMY_DB_URL
})

describe('License registry - authorization flow', () => {
  it('un dispositivo nuevo se registra con user_code y timestamps', () => {
    expect(AUTHORIZE_DEVICE_FUNCTION_SQL).toMatch(
      /INSERT INTO license_devices\s*\([\s\S]*?user_code,[\s\S]*?status,[\s\S]*?created_at,[\s\S]*?updated_at/s,
    )
    expect(AUTHORIZE_DEVICE_FUNCTION_SQL).toMatch(
      /VALUES\s*\([\s\S]*?current_license_user_code,[\s\S]*?'active',[\s\S]*?NOW\(\),[\s\S]*?NOW\(\)/s,
    )
  })

  it('un dispositivo existente completa user_code únicamente cuando está NULL', () => {
    expect(AUTHORIZE_DEVICE_FUNCTION_SQL).toMatch(
      /UPDATE license_devices SET\s*user_code = current_license_user_code,[\s\S]*?AND user_code IS NULL/s,
    )
  })

  it('nunca sobrescribe un user_code existente con otro distinto', () => {
    expect(AUTHORIZE_DEVICE_FUNCTION_SQL).not.toContain(
      'user_code = COALESCE(p_user_code, user_code)',
    )
    expect(AUTHORIZE_DEVICE_FUNCTION_SQL).toContain('AND user_code IS NULL')
  })

  it('la migración automática solo repara user_code incompletos con fuentes conocidas', () => {
    expect(BACKFILL_DEVICE_USER_CODES_FROM_LICENSES_SQL).toContain(
      'device.user_code IS NULL',
    )
    expect(BACKFILL_DEVICE_USER_CODES_FROM_LICENSES_SQL).toContain(
      'license.user_code IS NOT NULL',
    )
    expect(BACKFILL_LICENSE_USER_CODES_FROM_DEVICES_SQL).toContain(
      'HAVING COUNT(DISTINCT user_code) = 1',
    )
    expect(BACKFILL_FROM_COMMUNICATION_CHANNELS_SQL).toContain(
      "to_regclass('public.communication_channels')",
    )
    expect(BACKFILL_FROM_COMMUNICATION_CHANNELS_SQL).toContain(
      'device.user_code IS NULL',
    )
  })

  it('Caso 1: Licencia multi - Primer dispositivo debe registrar', async () => {
    const sql = (await import('@neondatabase/serverless')).neon(
  DUMMY_DB_URL,
) as unknown as MockSqlFunction
    sql._nextResponse = [
      {
        license_status: 'active',
        device_status: 'active',
        device_authorization: 'registered',
        active_devices: 1,
        max_devices: 3,
      },
    ]

    const result = await authorizeLicenseDevice({
      licenseKey: 'k1',
      userCode: 'u1',
      deviceCode: 'PB-DEVICE-1',
      deviceName: 'd1',
      platform: 'web',
      licenseType: 'monthly',
      expiresAt: new Date().toISOString(),
      devicePolicy: 'multi',
    })

    expect(result.deviceAuthorization).toBe('registered')
    expect(result.activeDevices).toBe(1)
  })

  it('Caso 2/3: Segundo y tercer dispositivo deben registrar', async () => {
    const sql = (await import('@neondatabase/serverless')).neon(
  DUMMY_DB_URL,
) as unknown as MockSqlFunction

    sql._nextResponse = [
      { license_status: 'active', device_status: 'active', device_authorization: 'registered', active_devices: 2, max_devices: 3 },
    ]
    const r2 = await authorizeLicenseDevice({
      licenseKey: 'k1', userCode: 'u1', deviceCode: 'PB-DEVICE-2', deviceName: 'd2', platform: 'web', licenseType: 'monthly', expiresAt: new Date().toISOString(), devicePolicy: 'multi',
    })
    expect(r2.deviceAuthorization).toBe('registered')

    sql._nextResponse = [
      { license_status: 'active', device_status: 'active', device_authorization: 'registered', active_devices: 3, max_devices: 3 },
    ]
    const r3 = await authorizeLicenseDevice({
      licenseKey: 'k1', userCode: 'u1', deviceCode: 'PB-DEVICE-3', deviceName: 'd3', platform: 'web', licenseType: 'monthly', expiresAt: new Date().toISOString(), devicePolicy: 'multi',
    })
    expect(r3.deviceAuthorization).toBe('registered')
    expect(r3.activeDevices).toBe(3)
  })

  it('Caso 4: Cuarto dispositivo debe responder "Límite de dispositivos alcanzado."', async () => {
    const sql = (await import('@neondatabase/serverless')).neon(
  DUMMY_DB_URL,
) as unknown as MockSqlFunction
    // Simulate function returning no device_authorization (limit reached)
    sql._nextResponse = [
      { license_status: 'active', device_status: null, device_authorization: null, active_devices: 3, max_devices: 3 },
    ]

    await expect(
      authorizeLicenseDevice({
        licenseKey: 'k1', userCode: 'u1', deviceCode: 'PB-DEVICE-4', deviceName: 'd4', platform: 'web', licenseType: 'monthly', expiresAt: new Date().toISOString(), devicePolicy: 'multi',
      }),
    ).rejects.toMatchObject({ code: 'device-limit-reached' })
  })

  it('Caso 5: Licencia single - Segundo dispositivo debe responder "Esta licencia pertenece a otro dispositivo." via verifySignedLicenseForDevice', async () => {
    const server = await import('../server/automationSecurity')
    const singleDeviceLicense = 'PB-LIC-V2.eyJhcHAiOiJwcml2YXRlLWJhbGFuY2UiLCJ2ZXJzaW9uIjoyLCJkZXZpY2VDb2RlIjoiUEItREVWSUNFLUFBQUFBQUFBLUFBQUEtNEFBQS04QUFBLUFBQUFBQUFBQUFBQSIsImxpY2Vuc2VUeXBlIjoibGlmZXRpbWUiLCJpc3N1ZWRBdCI6IjIwMjYtMDctMDJUMjE6Mzg6NDUuNDkyWiIsImV4cGlyZXNBdCI6bnVsbCwiZmVhdHVyZXMiOlsiY29yZSIsImJhY2t1cCIsInJlcG9ydHMiXSwiZGV2aWNlUG9saWN5Ijoic2luZ2xlIn0.d6l8VX9RD_VvnUosJ597H0KQzpRg6Xye-klIIPPPwII2Ceio_Ag5H9eYxsms7VvBqfbttVHGQvDQUooc3BpzKA'

    expect(() => server.verifySignedLicenseForDevice(
      singleDeviceLicense,
      'PB-DEVICE-BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB',
    )).toThrow('Esta licencia pertenece a otro dispositivo.')
  })

  it('Caso 6: Dispositivo revocado debe responder "Este dispositivo está revocado."', async () => {
    const sql = (await import('@neondatabase/serverless')).neon(
  DUMMY_DB_URL,
) as unknown as MockSqlFunction
    sql._nextResponse = [
      { license_status: 'active', device_status: 'revoked', device_authorization: null, active_devices: 1, max_devices: 3 },
    ]

    await expect(
      authorizeLicenseDevice({
        licenseKey: 'k1', userCode: 'u1', deviceCode: 'PB-DEVICE-R', deviceName: 'dR', platform: 'web', licenseType: 'monthly', expiresAt: new Date().toISOString(), devicePolicy: 'multi',
      }),
    ).rejects.toMatchObject({ code: 'device-revoked' })
  })

  it('Caso 7: Licencia revocada debe responder "La licencia está revocada."', async () => {
    const sql = (await import('@neondatabase/serverless')).neon(
  DUMMY_DB_URL,
) as unknown as MockSqlFunction
    sql._nextResponse = [
      { license_status: 'revoked', device_status: null, device_authorization: null, active_devices: 0, max_devices: 3 },
    ]

    await expect(
      authorizeLicenseDevice({
        licenseKey: 'k1', userCode: 'u1', deviceCode: 'PB-DEVICE-X', deviceName: 'dX', platform: 'web', licenseType: 'monthly', expiresAt: new Date().toISOString(), devicePolicy: 'multi',
      }),
    ).rejects.toMatchObject({ code: 'license-revoked' })
  })
})
