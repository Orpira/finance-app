import { afterEach, describe, expect, it, vi } from 'vitest'

import { unregisterStaleServiceWorkers } from './staleServiceWorkerCleanup'

function fakeSessionStorage() {
  const store = new Map<string, string>()

  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('unregisterStaleServiceWorkers', () => {
  it('does nothing when there is no serviceWorker support', async () => {
    vi.stubGlobal('navigator', {})

    await expect(unregisterStaleServiceWorkers()).resolves.toBeUndefined()
  })

  it('does nothing when there are no active registrations', async () => {
    const reload = vi.fn()
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([]), controller: null },
    })
    vi.stubGlobal('window', { location: { reload } })

    await unregisterStaleServiceWorkers()

    expect(reload).not.toHaveBeenCalled()
  })

  it('unregisters every stale registration and clears cache storage', async () => {
    const unregisterA = vi.fn().mockResolvedValue(true)
    const unregisterB = vi.fn().mockResolvedValue(true)
    const cacheDelete = vi.fn().mockResolvedValue(true)
    const reload = vi.fn()

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi
          .fn()
          .mockResolvedValue([{ unregister: unregisterA }, { unregister: unregisterB }]),
        controller: null,
      },
    })
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['workbox-precache-v1', 'other-cache']),
      delete: cacheDelete,
    })
    vi.stubGlobal('window', { location: { reload } })

    await unregisterStaleServiceWorkers()

    expect(unregisterA).toHaveBeenCalledTimes(1)
    expect(unregisterB).toHaveBeenCalledTimes(1)
    expect(cacheDelete).toHaveBeenCalledWith('workbox-precache-v1')
    expect(cacheDelete).toHaveBeenCalledWith('other-cache')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads the page once when a stale service worker was already controlling it', async () => {
    const reload = vi.fn()

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]),
        controller: {},
      },
    })
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() })
    vi.stubGlobal('window', { location: { reload } })
    vi.stubGlobal('sessionStorage', fakeSessionStorage())

    await unregisterStaleServiceWorkers()

    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads more than once per tab, even if a controller is detected again', async () => {
    const reload = vi.fn()
    const session = fakeSessionStorage()

    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]),
        controller: {},
      },
    })
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() })
    vi.stubGlobal('window', { location: { reload } })
    vi.stubGlobal('sessionStorage', session)

    // Simulates a page that keeps re-registering a stray service worker on every load:
    // the reload guard must stop the second run from reloading again.
    await unregisterStaleServiceWorkers()
    await unregisterStaleServiceWorkers()
    await unregisterStaleServiceWorkers()

    expect(reload).toHaveBeenCalledTimes(1)
  })
})
