// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceIdentity } from '../types/deviceIdentity'
import type { AppLicense } from '../types/license'
import { assertDeviceMayWrite, refreshDeviceAccess } from './deviceAccessService'
import {
  authorizeSignedLicenseDevice,
  DeviceAccessDeniedError,
} from './licenseAuthorizationService'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'android' },
}))
vi.mock('./licenseAuthorizationService', () => ({
  authorizeSignedLicenseDevice: vi.fn(),
  DeviceAccessDeniedError: class extends Error {},
}))

const authorize = vi.mocked(authorizeSignedLicenseDevice)
const identity = { deviceCode: 'test-device' } as DeviceIdentity
const license: AppLicense = {
  id: 'current',
  deviceCode: identity.deviceCode,
  activationCode: 'test-code',
  licenseKey: 'test-license',
  licenseType: 'lifetime',
  licenseVersion: 2,
  status: 'active',
  createdAt: '',
  updatedAt: '',
}
const authorization = {
  licenseKey: 'test-license',
  deviceAuthorization: 'existing' as const,
  activeDevices: 1,
  maxDevices: 3,
  validForMs: 60_000,
}
const start = Date.UTC(2026, 10, 7)

beforeEach(() => {
  localStorage.clear()
  authorize.mockReset()
  vi.spyOn(Date, 'now').mockReturnValue(start)
})

describe('permiso de uso Android', () => {
  it('permite trabajar offline hasta el límite devuelto por el servidor', async () => {
    authorize.mockResolvedValueOnce(authorization)
    expect(await refreshDeviceAccess(license, identity)).toBe('allowed')
    authorize.mockRejectedValue(new Error('sin red'))
    vi.mocked(Date.now).mockReturnValue(start + 59_999)
    expect(await refreshDeviceAccess(license, identity)).toBe('allowed')
    vi.mocked(Date.now).mockReturnValue(start + 60_000)
    expect(() => assertDeviceMayWrite()).toThrow()
    expect(await refreshDeviceAccess(license, identity)).toBe('offline-expired')
  })

  it('descarta el permiso al revocar y puede renovarlo al restaurar el acceso', async () => {
    authorize.mockResolvedValueOnce(authorization)
    expect(await refreshDeviceAccess(license, identity)).toBe('allowed')
    authorize.mockRejectedValueOnce(new DeviceAccessDeniedError())
    expect(await refreshDeviceAccess(license, identity)).toBe('denied')
    expect(() => assertDeviceMayWrite()).toThrow()
    authorize.mockRejectedValueOnce(new Error('sin red'))
    expect(await refreshDeviceAccess(license, identity)).toBe('offline-expired')
    authorize.mockResolvedValueOnce(authorization)
    expect(await refreshDeviceAccess(license, identity)).toBe('allowed')
  })

  it('no reutiliza el permiso de otra licencia ni amplía el plazo ante un fallo', async () => {
    authorize.mockResolvedValueOnce(authorization)
    await refreshDeviceAccess(license, identity)
    authorize.mockRejectedValueOnce(new Error('sin red'))
    expect(await refreshDeviceAccess({ ...license, licenseKey: 'other' }, identity))
      .toBe('offline-expired')
  })
})
