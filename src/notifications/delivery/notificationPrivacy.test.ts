import { describe, expect, it } from 'vitest'

import { DEFAULT_NOTIFICATION_PREFERENCES } from '../notificationDefaults'
import type { CopilotNotification, NotificationPreferences } from '../types'
import { buildAndroidNotificationContent } from './notificationPrivacy'

function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...overrides }
}

function notification(overrides: Partial<CopilotNotification> = {}): CopilotNotification {
  return {
    id: 'n1',
    type: 'SEASON_GOAL_RISK',
    priority: 'P1',
    source: 'goal',
    title: 'Meta de temporada',
    message: 'Meta actual: 1.830 € — Objetivo: 2.500 €',
    dedupKey: 'season-goal-risk:1',
    createdAt: '2026-08-30T10:00:00.000Z',
    status: 'new',
    privacy: 'private',
    ...overrides,
  }
}

describe('buildAndroidNotificationContent', () => {
  it('showFinancialDetailsExternally=false produce contenido genérico sin importes', () => {
    const content = buildAndroidNotificationContent(notification(), preferences({ showFinancialDetailsExternally: false }))

    expect(content.title).toBe('Private Balance')
    expect(content.body).not.toMatch(/1830|2500|€/)
  })

  it('notification.privacy=private oculta el detalle aunque el flag global esté activo', () => {
    const content = buildAndroidNotificationContent(
      notification({ privacy: 'private' }),
      preferences({ showFinancialDetailsExternally: true }),
    )

    expect(content.body).not.toMatch(/1830|2500|€/)
  })

  it('P0 usa el texto genérico de situación crítica', () => {
    const content = buildAndroidNotificationContent(notification({ priority: 'P0' }), preferences())
    expect(content.body).toBe('Una situación requiere tu atención. Toca para revisar.')
  })

  it('showFinancialDetailsExternally=true y privacy permitido muestran el mensaje real', () => {
    const content = buildAndroidNotificationContent(
      notification({ privacy: 'user_allowed' }),
      preferences({ showFinancialDetailsExternally: true }),
    )

    expect(content.body).toBe('Meta actual: 1.830 € — Objetivo: 2.500 €')
  })
})
