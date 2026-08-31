import { describe, expect, it } from 'vitest'

import { DEFAULT_NOTIFICATION_PREFERENCES } from '../notificationDefaults'
import type { NotificationRepository } from '../notificationRepository'
import type { CopilotNotification, NotificationDeliveryState, NotificationPreferences } from '../types'
import { createNotificationDeliveryService } from './NotificationDeliveryService'
import type { AndroidDeliveryOutcome, InAppDeliveryOutcome, NotificationDeliveryAdapter } from './types'

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

function createFakeRepository(): NotificationRepository & { updates: Map<string, NotificationDeliveryState> } {
  const updates = new Map<string, NotificationDeliveryState>()
  return {
    updates,
    async create() {},
    async getById() {
      return undefined
    },
    async findBlockingByDedupKey() {
      return undefined
    },
    async list() {
      return []
    },
    async setStatus() {},
    async countByPrioritySince() {
      return 0
    },
    async countNonCriticalSince() {
      return 0
    },
    async updateDelivery(id, delivery) {
      updates.set(id, delivery)
    },
  }
}

function fakeInAppAdapter(): NotificationDeliveryAdapter<InAppDeliveryOutcome> {
  return {
    channel: 'in_app',
    async deliver() {
      return { deliveredAt: '2026-08-30T10:00:01.000Z' }
    },
  }
}

function fakeAndroidAdapter(outcome: AndroidDeliveryOutcome): NotificationDeliveryAdapter<AndroidDeliveryOutcome> {
  return {
    channel: 'android',
    async deliver() {
      return outcome
    },
  }
}

function preferences(overrides: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...overrides }
}

describe('createNotificationDeliveryService', () => {
  it('una notificación P1 con Android autorizado produce un único registro de delivery multicanal', async () => {
    const repository = createFakeRepository()
    const service = createNotificationDeliveryService({
      repository,
      getPreferences: async () => preferences(),
      inAppAdapter: fakeInAppAdapter(),
      androidAdapter: fakeAndroidAdapter({ status: 'delivered', nativeId: 42, deliveredAt: '2026-08-30T10:00:02.000Z' }),
    })

    const result = await service.deliver(notification())

    expect(result.channels).toEqual(['in_app', 'android'])
    expect(repository.updates.size).toBe(1)
    expect(repository.updates.get('n1')).toEqual({
      inApp: { deliveredAt: '2026-08-30T10:00:01.000Z' },
      android: { status: 'delivered', nativeId: 42, deliveredAt: '2026-08-30T10:00:02.000Z' },
    })
  })

  it('P2 con Android deshabilitado por defecto no invoca el adapter Android', async () => {
    const repository = createFakeRepository()
    let androidCalls = 0
    const service = createNotificationDeliveryService({
      repository,
      getPreferences: async () => preferences(),
      inAppAdapter: fakeInAppAdapter(),
      androidAdapter: {
        channel: 'android',
        async deliver() {
          androidCalls += 1
          return { status: 'delivered' }
        },
      },
    })

    const result = await service.deliver(notification({ priority: 'P2', action: undefined }))

    expect(result.channels).toEqual(['in_app'])
    expect(androidCalls).toBe(0)
    expect(repository.updates.get('n1')?.android).toBeUndefined()
  })

  it('permiso denegado en Android no lanza y queda reflejado en el estado de entrega', async () => {
    const repository = createFakeRepository()
    const service = createNotificationDeliveryService({
      repository,
      getPreferences: async () => preferences(),
      inAppAdapter: fakeInAppAdapter(),
      androidAdapter: fakeAndroidAdapter({ status: 'permission_denied' }),
    })

    await expect(service.deliver(notification())).resolves.toBeDefined()
    expect(repository.updates.get('n1')?.android).toEqual({ status: 'permission_denied' })
  })
})
