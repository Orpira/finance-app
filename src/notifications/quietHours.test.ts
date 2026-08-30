import { describe, expect, it } from 'vitest'

import { isWithinQuietHours } from './quietHours'
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationDefaults'

describe('isWithinQuietHours', () => {
  it('devuelve false cuando el horario silencioso está desactivado', () => {
    expect(
      isWithinQuietHours(new Date('2026-08-30T23:00:00'), {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        quietHoursEnabled: false,
      }),
    ).toBe(false)
  })

  it('detecta un rango que cruza medianoche (22:00–08:00)', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: true,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    }

    expect(isWithinQuietHours(new Date('2026-08-30T23:30:00'), preferences)).toBe(true)
    expect(isWithinQuietHours(new Date('2026-08-31T07:00:00'), preferences)).toBe(true)
    expect(isWithinQuietHours(new Date('2026-08-31T09:00:00'), preferences)).toBe(false)
    expect(isWithinQuietHours(new Date('2026-08-30T12:00:00'), preferences)).toBe(false)
  })

  it('detecta un rango dentro del mismo día (13:00–14:00)', () => {
    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      quietHoursEnabled: true,
      quietHoursStart: '13:00',
      quietHoursEnd: '14:00',
    }

    expect(isWithinQuietHours(new Date('2026-08-30T13:30:00'), preferences)).toBe(true)
    expect(isWithinQuietHours(new Date('2026-08-30T15:00:00'), preferences)).toBe(false)
  })
})
