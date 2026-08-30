import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  listCityOptions,
  resolveCityOption,
} from '../src/services/locationService'
import { fallbackCityOptions } from '../src/utils/countries'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('locationService', () => {
  it('devuelve el catálogo local sin depender de la red', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(listCityOptions()).resolves.toEqual(fallbackCityOptions)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('resuelve país y moneda local para una ciudad fuera del desplegable', async () => {
    await expect(resolveCityOption('Cardiff', 'ES')).resolves.toEqual({
      value: 'Cardiff',
      label: 'Cardiff',
      country: 'GB',
      currency: 'GBP',
    })
  })

  it('respeta el país elegido cuando el nombre de ciudad es ambiguo', async () => {
    await expect(resolveCityOption('Córdoba', 'ES')).resolves.toMatchObject({
      country: 'ES',
      currency: 'EUR',
    })
  })
})