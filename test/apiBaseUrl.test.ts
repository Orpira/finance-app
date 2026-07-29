import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn(() => false) },
}))

import { Capacitor } from '@capacitor/core'
import { getPrivateBalanceApiUrl } from '../src/services/apiBaseUrl'

function setLocation(origin: string) {
  vi.stubGlobal('location', { origin })
}

beforeEach(() => {
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('getPrivateBalanceApiUrl', () => {
  it('en nativo siempre usa VITE_API_BASE_URL, sin importar el origin', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    vi.stubEnv('VITE_API_BASE_URL', 'https://private-balance.orpira.es')
    setLocation('capacitor://localhost')

    expect(getPrivateBalanceApiUrl('/api/trial-start')).toBe(
      'https://private-balance.orpira.es/api/trial-start',
    )
  })

  it('en web local con VITE_API_BASE_URL seteada, la usa', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://private-balance.orpira.es')
    setLocation('http://localhost:3000')

    expect(getPrivateBalanceApiUrl('/api/license-activate')).toBe(
      'https://private-balance.orpira.es/api/license-activate',
    )
  })

  it('en web local sin VITE_API_BASE_URL seteada, cae al origin local', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    setLocation('http://127.0.0.1:3000')

    expect(getPrivateBalanceApiUrl('/api/trial-start')).toBe(
      'http://127.0.0.1:3000/api/trial-start',
    )
  })

  it('en un origin de producción, ignora VITE_API_BASE_URL y usa el origin actual', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://otra-cosa.orpira.es')
    setLocation('https://private-balance.orpira.es')

    expect(getPrivateBalanceApiUrl('/api/license-activate')).toBe(
      'https://private-balance.orpira.es/api/license-activate',
    )
  })

  it('trial-start y license-activate siempre resuelven a la misma base', () => {
    const scenarios: Array<[boolean, string, string]> = [
      [true, 'https://private-balance.orpira.es', 'capacitor://localhost'],
      [false, 'https://private-balance.orpira.es', 'http://localhost:3000'],
      [false, '', 'http://localhost:3000'],
      [false, 'https://otra-cosa.orpira.es', 'https://private-balance.orpira.es'],
    ]

    for (const [isNative, configuredApiUrl, origin] of scenarios) {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(isNative)
      vi.stubEnv('VITE_API_BASE_URL', configuredApiUrl)
      setLocation(origin)

      const trialBase = getPrivateBalanceApiUrl('/api/trial-start').replace(
        '/api/trial-start',
        '',
      )
      const activateBase = getPrivateBalanceApiUrl(
        '/api/license-activate',
      ).replace('/api/license-activate', '')

      expect(trialBase).toBe(activateBase)
    }
  })
})
