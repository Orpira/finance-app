import { describe, expect, it } from 'vitest'

import { DEFAULT_NOTIFICATION_PREFERENCES } from '../notificationDefaults'
import type { NotificationPreferences, NotificationPriority } from '../types'
import { resolveNotificationChannels } from './notificationChannelPolicy'

function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...overrides }
}

describe('resolveNotificationChannels', () => {
  it('P0 llega a in_app y android por defecto', () => {
    expect(resolveNotificationChannels('P0', preferences())).toEqual(['in_app', 'android'])
  })

  it('P1 llega a in_app y android por defecto', () => {
    expect(resolveNotificationChannels('P1', preferences())).toEqual(['in_app', 'android'])
  })

  it('P2 permanece solo in_app por defecto', () => {
    expect(resolveNotificationChannels('P2', preferences())).toEqual(['in_app'])
  })

  it('P3 permanece solo in_app por defecto', () => {
    expect(resolveNotificationChannels('P3', preferences())).toEqual(['in_app'])
  })

  it('androidNotificationsEnabled=false bloquea Android para cualquier prioridad, incluida P0', () => {
    const prefs = preferences({ androidNotificationsEnabled: false })
    const priorities: NotificationPriority[] = ['P0', 'P1', 'P2', 'P3']
    for (const priority of priorities) {
      expect(resolveNotificationChannels(priority, prefs)).toEqual(['in_app'])
    }
  })

  it('androidActionRequiredEnabled=false bloquea Android solo para P1', () => {
    const prefs = preferences({ androidActionRequiredEnabled: false })
    expect(resolveNotificationChannels('P1', prefs)).toEqual(['in_app'])
    expect(resolveNotificationChannels('P0', prefs)).toEqual(['in_app', 'android'])
  })

  it('androidFinancialInsightsEnabled=true habilita Android para P2', () => {
    const prefs = preferences({ androidFinancialInsightsEnabled: true })
    expect(resolveNotificationChannels('P2', prefs)).toEqual(['in_app', 'android'])
  })

  it('androidSummaryEnabled=true habilita Android para P3', () => {
    const prefs = preferences({ androidSummaryEnabled: true })
    expect(resolveNotificationChannels('P3', prefs)).toEqual(['in_app', 'android'])
  })
})
