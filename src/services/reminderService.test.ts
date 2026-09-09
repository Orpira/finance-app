import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}))

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    createChannel: vi.fn(),
    registerActionTypes: vi.fn(),
    addListener: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
    checkExactNotificationSetting: vi.fn(),
    changeExactNotificationSetting: vi.fn(),
    getPending: vi.fn(),
    cancel: vi.fn(),
    schedule: vi.fn(),
  },
}))

const { Capacitor } = await import('@capacitor/core')
const { LocalNotifications } = await import('@capacitor/local-notifications')
const { scheduleAppointmentReminders } = await import('./reminderService')

import type { Appointment } from '../types/appointment'

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 1,
    dateTime: '2099-01-01T10:00:00.000Z',
    duration: 60,
    expectedAmount: 0,
    currency: 'EUR',
    reminders: [{ id: 'r1', amount: 15, unit: 'minutes', type: 'local' }],
    completed: false,
    ...overrides,
  }
}

describe('scheduleAppointmentReminders', () => {
  beforeEach(() => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true)
    vi.mocked(Capacitor.getPlatform).mockReturnValue('android')
    vi.mocked(LocalNotifications.createChannel).mockReset().mockResolvedValue(undefined)
    vi.mocked(LocalNotifications.registerActionTypes).mockReset().mockResolvedValue(undefined)
    vi.mocked(LocalNotifications.checkPermissions).mockReset().mockResolvedValue({ display: 'granted' })
    vi.mocked(LocalNotifications.requestPermissions).mockReset()
    vi.mocked(LocalNotifications.checkExactNotificationSetting)
      .mockReset()
      .mockResolvedValue({ exact_alarm: 'granted' })
    vi.mocked(LocalNotifications.changeExactNotificationSetting)
      .mockReset()
      .mockResolvedValue({ exact_alarm: 'granted' })
    vi.mocked(LocalNotifications.getPending).mockReset().mockResolvedValue({ notifications: [] })
    vi.mocked(LocalNotifications.cancel).mockReset().mockResolvedValue(undefined)
    vi.mocked(LocalNotifications.schedule).mockReset().mockResolvedValue({ notifications: [] })
  })

  it('programa el recordatorio cuando el permiso de notificaciones y el de alarma exacta están concedidos', async () => {
    await scheduleAppointmentReminders(appointment())

    expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1)
  })

  it('lanza un error explícito y no programa nada si falta el permiso de alarma exacta en Android', async () => {
    vi.mocked(LocalNotifications.checkExactNotificationSetting).mockResolvedValue({ exact_alarm: 'denied' })

    await expect(scheduleAppointmentReminders(appointment())).rejects.toThrow(
      /Alarmas y recordatorios/,
    )

    expect(LocalNotifications.changeExactNotificationSetting).toHaveBeenCalledTimes(1)
    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
  })

  it('lanza un error si el permiso de notificaciones está denegado', async () => {
    vi.mocked(LocalNotifications.checkPermissions).mockResolvedValue({ display: 'denied' })

    await expect(scheduleAppointmentReminders(appointment())).rejects.toThrow(
      /Permiso de notificaciones denegado/,
    )

    expect(LocalNotifications.schedule).not.toHaveBeenCalled()
  })
})
