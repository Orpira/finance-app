import { describe, expect, it } from 'vitest'

import { createDexieNotificationRepository } from './notificationRepository'
import type { CopilotNotification } from './types'

function createFakeNotificationsTable(initial: CopilotNotification[] = []) {
  const rows = new Map(initial.map((row) => [row.id, row]))

  function whereField(field: 'dedupKey' | 'createdAt') {
    return {
      equals(value: string) {
        return { toArray: async () => [...rows.values()].filter((row) => row[field] === value) }
      },
      aboveOrEqual(value: string) {
        return { toArray: async () => [...rows.values()].filter((row) => row[field] >= value) }
      },
    }
  }

  return {
    async add(notification: CopilotNotification) {
      rows.set(notification.id, notification)
    },
    async get(id: string) {
      return rows.get(id)
    },
    where(field: 'dedupKey' | 'createdAt') {
      return whereField(field)
    },
    async update(id: string, changes: Partial<CopilotNotification>) {
      const existing = rows.get(id)
      if (existing) rows.set(id, { ...existing, ...changes })
    },
    async toArray() {
      return [...rows.values()]
    },
  }
}

function notification(overrides: Partial<CopilotNotification> = {}): CopilotNotification {
  return {
    id: 'n1',
    type: 'SEASON_GOAL_RISK',
    priority: 'P2',
    source: 'goal',
    title: 'Meta de temporada',
    message: 'msg',
    dedupKey: 'season-goal-risk:1',
    createdAt: '2026-08-30T10:00:00.000Z',
    status: 'new',
    privacy: 'generic',
    ...overrides,
  }
}

describe('createDexieNotificationRepository', () => {
  it('findBlockingByDedupKey devuelve la más reciente si sigue sin resolver', async () => {
    const table = createFakeNotificationsTable([
      notification({ id: 'a', createdAt: '2026-08-30T09:00:00.000Z', status: 'dismissed' }),
      notification({ id: 'b', createdAt: '2026-08-30T10:00:00.000Z', status: 'seen' }),
    ])
    const repo = createDexieNotificationRepository({ notifications: table } as never)

    const blocking = await repo.findBlockingByDedupKey('season-goal-risk:1', new Date('2026-08-30T11:00:00.000Z'))
    expect(blocking?.id).toBe('b')
  })

  it('findBlockingByDedupKey devuelve undefined si la más reciente está descartada y fuera de cooldown', async () => {
    const table = createFakeNotificationsTable([
      notification({
        id: 'a',
        createdAt: '2026-08-30T09:00:00.000Z',
        status: 'dismissed',
        cooldownUntil: '2026-08-30T09:30:00.000Z',
      }),
    ])
    const repo = createDexieNotificationRepository({ notifications: table } as never)

    const blocking = await repo.findBlockingByDedupKey('season-goal-risk:1', new Date('2026-08-30T11:00:00.000Z'))
    expect(blocking).toBeUndefined()
  })

  it('countByPrioritySince ignora las suprimidas', async () => {
    const table = createFakeNotificationsTable([
      notification({ id: 'a', priority: 'P2', status: 'new', createdAt: '2026-08-30T10:00:00.000Z' }),
      notification({ id: 'b', priority: 'P2', status: 'suppressed', createdAt: '2026-08-30T10:00:00.000Z' }),
      notification({ id: 'c', priority: 'P1', status: 'new', createdAt: '2026-08-30T10:00:00.000Z' }),
    ])
    const repo = createDexieNotificationRepository({ notifications: table } as never)

    const count = await repo.countByPrioritySince('P2', new Date('2026-08-30T00:00:00.000Z'))
    expect(count).toBe(1)
  })

  it('setStatus actualiza el estado persistido', async () => {
    const table = createFakeNotificationsTable([notification({ id: 'a' })])
    const repo = createDexieNotificationRepository({ notifications: table } as never)

    await repo.setStatus('a', 'dismissed')
    const updated = await repo.getById('a')
    expect(updated?.status).toBe('dismissed')
  })
})
