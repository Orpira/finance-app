import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    createChannel: vi.fn(),
    schedule: vi.fn(),
    addListener: vi.fn(),
  },
}))

const { Capacitor } = await import('@capacitor/core')
const { LocalNotifications } = await import('@capacitor/local-notifications')
const { createAndroidNotificationDelivery } = await import('./AndroidNotificationDelivery')
const { DEFAULT_NOTIFICATION_PREFERENCES } = await import('../notificationDefaults')

import type { CopilotNotification } from '../types'

function notification(overrides: Partial<CopilotNotification> = {}): CopilotNotification {
  return {
    id: 'n1',
    type: 'SEASON_ENDING',
    priority: 'P1',
    source: 'season',
    title: 'Tu temporada requiere atención',
    message: 'msg',
    dedupKey: 'season-ending:1',
    createdAt: '2026-08-30T10:00:00.000Z',
    status: 'new',
    privacy: 'private',
    action: { label: 'Ver', destination: '/temporadas/1' },
    ...overrides,
  }
}

describe('AndroidNotificationDelivery', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web')
    vi.mocked(LocalNotifications.checkPermissions).mockReset()
    vi.mocked(LocalNotifications.createChannel).mockReset().mockResolvedValue(undefined)
    vi.mocked(LocalNotifications.schedule).mockReset().mockResolvedValue({ notifications: [] })
  })

  it('es no-op seguro fuera de Android (web/PWA)', async () => {
    const adapter = createAndroidNotificationDelivery()
    const result = await adapter.deliver(notification(), DEFAULT_NOTIFICATION_PREFERENCES)

    expect(result).toEqual({ status: 'not_requested' })
    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
  })

  it('permiso denegado no lanza y no programa nada', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'denied' })

    const adapter = createAndroidNotificationDelivery()
    const result = await adapter.deliver(notification(), DEFAULT_NOTIFICATION_PREFERENCES)

    expect(result).toEqual({ status: 'permission_denied' })
    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
  })

  it('permiso concedido programa la notificación con el channelId y extra correctos', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' })

    const adapter = createAndroidNotificationDelivery({ now: () => new Date('2026-08-30T10:00:02.000Z') })
    const result = await adapter.deliver(notification(), DEFAULT_NOTIFICATION_PREFERENCES)

    expect(result.status).toBe('delivered')
    expect(typeof result.nativeId).toBe('number')
    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)

    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0][0]
    expect(call.notifications[0].channelId).toBe('copilot-important')
    expect(call.notifications[0].extra).toEqual({ copilotNotificationId: 'n1', destination: '/temporadas/1' })
  })

  it('P0 usa el canal crítico', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' })

    const adapter = createAndroidNotificationDelivery()
    await adapter.deliver(notification({ priority: 'P0' }), DEFAULT_NOTIFICATION_PREFERENCES)

    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0][0]
    expect(call.notifications[0].channelId).toBe('copilot-critical')
  })

  it('no crashea si el plugin rechaza la promesa', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' })
    vi.mocked(LocalNotifications.schedule).mockRejectedValue(new Error('plugin no disponible'))

    const adapter = createAndroidNotificationDelivery()
    const result = await adapter.deliver(notification(), DEFAULT_NOTIFICATION_PREFERENCES)

    expect(result).toEqual({ status: 'failed' })
  })

  it('respeta la privacidad: showFinancialDetailsExternally=false produce contenido genérico', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'granted' })

    const adapter = createAndroidNotificationDelivery()
    await adapter.deliver(
      notification({ message: 'Meta actual: 1.830 € — Objetivo: 2.500 €' }),
      { ...DEFAULT_NOTIFICATION_PREFERENCES, showFinancialDetailsExternally: false },
    )

    const call = vi.mocked(LocalNotifications.schedule).mock.calls[0][0]
    expect(call.notifications[0].body).not.toMatch(/1830|2500|€/)
  })
})
