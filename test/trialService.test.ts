import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DeviceIdentity } from '../src/types/deviceIdentity'

vi.mock('../src/services/apiBaseUrl', () => ({
  getPrivateBalanceApiUrl: (path: string) => `https://test.local${path}`,
}))

vi.mock('../src/services/signedLicenseService', () => ({
  activateSignedLicense: vi.fn(),
}))

import { activateSignedLicense } from '../src/services/signedLicenseService'
import { attemptFreeTrial } from '../src/services/trialService'

const identity: DeviceIdentity = {
  id: 'current',
  userCode: 'PB-USER-abc123',
  deviceCode: 'PB-DEVICE-abc123',
  platform: 'web',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function jsonResponse(ok: boolean, status: number, body: unknown) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response
}

function unparseableResponse(ok: boolean, status: number) {
  return {
    ok,
    status,
    json: () => Promise.reject(new Error('invalid json')),
  } as Response
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
  vi.mocked(activateSignedLicense).mockReset()
})

describe('attemptFreeTrial', () => {
  it('concede el trial y activa la licencia con la MISMA identidad recibida', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(true, 200, {
        activationCode: 'PB-LIC-V2.payload.sig',
        expiresAt: '2026-01-08T00:00:00.000Z',
      }),
    )
    const grantedLicense = { id: 'current', status: 'active' } as never
    vi.mocked(activateSignedLicense).mockResolvedValue(grantedLicense)

    const outcome = await attemptFreeTrial(identity)

    expect(outcome).toEqual({ outcome: 'granted', license: grantedLicense })
    expect(activateSignedLicense).toHaveBeenCalledWith(
      'PB-LIC-V2.payload.sig',
      identity,
    )
    expect(fetch).toHaveBeenCalledWith(
      'https://test.local/api/trial-start',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          deviceCode: identity.deviceCode,
          userCode: identity.userCode,
          platform: identity.platform,
        }),
      }),
    )
  })

  it('devuelve already-used en 409 y no intenta activar nada', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(false, 409, { error: 'ya usado' }))

    const outcome = await attemptFreeTrial(identity)

    expect(outcome).toEqual({ outcome: 'already-used' })
    expect(activateSignedLicense).not.toHaveBeenCalled()
  })

  it('devuelve server-error con status y detail cuando el servidor rechaza', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(false, 500, { error: 'boom' }))

    const outcome = await attemptFreeTrial(identity)

    expect(outcome).toEqual({
      outcome: 'server-error',
      status: 500,
      detail: 'boom',
    })
  })

  it('cae a un detail genérico si el body de error no es JSON parseable', async () => {
    vi.mocked(fetch).mockResolvedValue(unparseableResponse(false, 400))

    const outcome = await attemptFreeTrial(identity)

    expect(outcome).toMatchObject({ outcome: 'server-error', status: 400 })
    if (outcome.outcome === 'server-error') {
      expect(outcome.detail).toBe('No se pudo iniciar la prueba gratuita.')
    }
  })

  it('devuelve network-error si el fetch rechaza (sin conexión)', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    const outcome = await attemptFreeTrial(identity)

    expect(outcome).toMatchObject({ outcome: 'network-error' })
    if (outcome.outcome === 'network-error') {
      expect(outcome.detail).toContain('Failed to fetch')
    }
    expect(activateSignedLicense).not.toHaveBeenCalled()
  })

  it('devuelve activation-error si el servidor concede el trial pero la activación local falla', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(true, 200, {
        activationCode: 'PB-LIC-V2.payload.sig',
        expiresAt: '2026-01-08T00:00:00.000Z',
      }),
    )
    vi.mocked(activateSignedLicense).mockRejectedValue(
      new Error('La firma digital de la licencia no es válida.'),
    )

    const outcome = await attemptFreeTrial(identity)

    expect(outcome).toMatchObject({ outcome: 'activation-error' })
    if (outcome.outcome === 'activation-error') {
      expect(outcome.detail).toBe('La firma digital de la licencia no es válida.')
    }
  })
})
