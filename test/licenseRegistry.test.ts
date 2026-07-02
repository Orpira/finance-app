import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @neondatabase/serverless neon function
vi.mock('@neondatabase/serverless', () => {
  // sqlFunction will return the nextResponse when used as a template tag
  const sqlFunction = (...args: any[]) => {
    // args[0] is an array of template strings when used as tag
    const fn: any = sqlFunction
    const next = fn._nextResponse
    if (typeof next === 'function') return next(...args)
    return Promise.resolve(next)
  }
  sqlFunction.query = async () => []
  sqlFunction._nextResponse = []
  return { neon: () => sqlFunction }
})

import { authorizeLicenseDevice, LicenseRegistryError } from '../server/licenseDeviceRegistry'

const DUMMY_DB_URL = 'postgresql://user:pass@localhost/db'

beforeEach(() => {
  process.env.DATABASE_URL = DUMMY_DB_URL
})

describe('License registry - authorization flow', () => {
  it('Caso 1: Licencia multi - Primer dispositivo debe registrar', async () => {
    const sql: any = (await import('@neondatabase/serverless')).neon()
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
    const sql: any = (await import('@neondatabase/serverless')).neon()

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
    const sql: any = (await import('@neondatabase/serverless')).neon()
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
    const sql: any = (await import('@neondatabase/serverless')).neon()
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
    const sql: any = (await import('@neondatabase/serverless')).neon()
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
