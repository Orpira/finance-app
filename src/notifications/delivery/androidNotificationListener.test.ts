import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn(() => 'android') },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { addListener: vi.fn() },
}))

const markActed = vi.fn()
const notifyNotificationsChanged = vi.fn()

vi.mock('../notificationService', () => ({
  getNotificationService: () => ({ markActed }),
  notifyNotificationsChanged,
}))

const { Capacitor } = await import('@capacitor/core')
const { LocalNotifications } = await import('@capacitor/local-notifications')
const { registerAndroidNotificationTapListener } = await import('./androidNotificationListener')

type TapHandler = (event: { notification: { extra?: Record<string, unknown> } }) => Promise<void>

describe('registerAndroidNotificationTapListener', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    markActed.mockReset()
    notifyNotificationsChanged.mockReset()
    vi.mocked(LocalNotifications.addListener).mockReset()
  })

  it('es no-op fuera de Android', async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue('web')
    const onNavigate = vi.fn()

    await registerAndroidNotificationTapListener(onNavigate)

    expect(LocalNotifications.addListener).not.toHaveBeenCalled()
  })

  it('destino válido: marca acted y navega', async () => {
    let handler: TapHandler = async () => {}
    vi.mocked(LocalNotifications.addListener).mockImplementation((_event, callback) => {
      handler = callback as TapHandler
      return Promise.resolve({ remove: vi.fn() })
    })

    const onNavigate = vi.fn()
    await registerAndroidNotificationTapListener(onNavigate)

    await handler({ notification: { extra: { copilotNotificationId: 'n1', destination: '/temporadas/1' } } })

    expect(markActed).toHaveBeenCalledWith('n1')
    expect(notifyNotificationsChanged).toHaveBeenCalled()
    expect(onNavigate).toHaveBeenCalledWith('/temporadas/1')
  })

  it('destino inválido: marca acted pero no navega', async () => {
    let handler: TapHandler = async () => {}
    vi.mocked(LocalNotifications.addListener).mockImplementation((_event, callback) => {
      handler = callback as TapHandler
      return Promise.resolve({ remove: vi.fn() })
    })

    const onNavigate = vi.fn()
    await registerAndroidNotificationTapListener(onNavigate)

    await handler({ notification: { extra: { copilotNotificationId: 'n1', destination: 'javascript:alert(1)' } } })

    expect(markActed).toHaveBeenCalledWith('n1')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('sin copilotNotificationId no hace nada', async () => {
    let handler: TapHandler = async () => {}
    vi.mocked(LocalNotifications.addListener).mockImplementation((_event, callback) => {
      handler = callback as TapHandler
      return Promise.resolve({ remove: vi.fn() })
    })

    const onNavigate = vi.fn()
    await registerAndroidNotificationTapListener(onNavigate)

    await handler({ notification: { extra: {} } })

    expect(markActed).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
