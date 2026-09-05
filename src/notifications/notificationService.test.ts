import { describe, expect, it } from 'vitest'

import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationDefaults'
import { createNotificationService } from './notificationService'
import type { NotificationRepository } from './notificationRepository'
import type { CopilotNotification, NotificationCandidate, NotificationStatus } from './types'

function createFakeRepository(initial: CopilotNotification[] = []): NotificationRepository & {
  rows: Map<string, CopilotNotification>
} {
  const rows = new Map(initial.map((row) => [row.id, row]))

  return {
    rows,
    async create(notification) {
      rows.set(notification.id, notification)
    },
    async getById(id) {
      return rows.get(id)
    },
    async findBlockingByDedupKey(dedupKey, now) {
      const matches = [...rows.values()].filter((row) => row.dedupKey === dedupKey)
      const mostRecent = matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      if (!mostRecent) return undefined
      if (['new', 'seen', 'read'].includes(mostRecent.status)) return mostRecent
      if (mostRecent.cooldownUntil && now.getTime() < new Date(mostRecent.cooldownUntil).getTime()) {
        return mostRecent
      }
      return undefined
    },
    async list() {
      return [...rows.values()]
    },
    async setStatus(id: string, status: NotificationStatus) {
      const existing = rows.get(id)
      if (existing) rows.set(id, { ...existing, status })
    },
    async countByPrioritySince() {
      return [...rows.values()].filter((row) => row.status !== 'suppressed').length
    },
    async countNonCriticalSince() {
      return [...rows.values()].filter((row) => row.status !== 'suppressed' && row.priority !== 'P0').length
    },
    async updateDelivery(id, delivery) {
      const existing = rows.get(id)
      if (existing) rows.set(id, { ...existing, delivery })
    },
  }
}

function candidate(overrides: Partial<NotificationCandidate> = {}): NotificationCandidate {
  return {
    type: 'SEASON_GOAL_RISK',
    priority: 'P2',
    source: 'goal',
    title: 'Meta de temporada',
    message: 'msg',
    dedupKey: 'season-goal-risk:1',
    ...overrides,
  }
}

describe('createNotificationService', () => {
  it('submitCandidate persiste una notificación entregada', async () => {
    const repository = createFakeRepository()
    const service = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    const decision = await service.submitCandidate(candidate())

    expect(decision.decision).toBe('deliver')
    expect(repository.rows.size).toBe(1)
  })

  it('submitCandidate no persiste nada cuando el Policy Engine suprime', async () => {
    const repository = createFakeRepository()
    const service = createNotificationService({
      repository,
      getPreferences: async () => ({ ...DEFAULT_NOTIFICATION_PREFERENCES, copilotNotificationsEnabled: false }),
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    const decision = await service.submitCandidate(candidate())

    expect(decision).toEqual({ decision: 'suppress', reason: 'disabled' })
    expect(repository.rows.size).toBe(0)
  })

  it('countUnread solo cuenta status=new', async () => {
    const repository = createFakeRepository([
      { id: 'a', type: 't', priority: 'P2', source: 'goal', title: 't', message: 'm', dedupKey: 'd1', createdAt: '2026-08-30T10:00:00.000Z', status: 'new', privacy: 'generic' },
      { id: 'b', type: 't', priority: 'P2', source: 'goal', title: 't', message: 'm', dedupKey: 'd2', createdAt: '2026-08-30T10:00:00.000Z', status: 'read', privacy: 'generic' },
    ])
    const service = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    expect(await service.countUnread()).toBe(1)
  })

  it('listNotifications expira automáticamente las notificaciones vencidas', async () => {
    const repository = createFakeRepository([
      {
        id: 'a',
        type: 't',
        priority: 'P2',
        source: 'goal',
        title: 't',
        message: 'm',
        dedupKey: 'd1',
        createdAt: '2026-08-29T10:00:00.000Z',
        expiresAt: '2026-08-29T11:00:00.000Z',
        status: 'new',
        privacy: 'generic',
      },
    ])
    const service = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    await service.listNotifications()
    expect(repository.rows.get('a')?.status).toBe('expired')
  })

  it('dismiss/markRead/markActed transicionan el estado', async () => {
    const repository = createFakeRepository([
      { id: 'a', type: 't', priority: 'P2', source: 'goal', title: 't', message: 'm', dedupKey: 'd1', createdAt: '2026-08-30T10:00:00.000Z', status: 'new', privacy: 'generic' },
    ])
    const service = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    await service.markSeen('a')
    expect(repository.rows.get('a')?.status).toBe('seen')

    await service.markRead('a')
    expect(repository.rows.get('a')?.status).toBe('read')

    await service.markActed('a')
    expect(repository.rows.get('a')?.status).toBe('acted')
  })

  it('Bloque 3: una notificación profesional (agenda/temporada) no aparece en Personal, pero no se borra', async () => {
    const repository = createFakeRepository([
      { id: 'a', type: 'SEASON_ENDING', priority: 'P1', source: 'season', title: 't', message: 'm', dedupKey: 'd1', createdAt: '2026-08-30T10:00:00.000Z', status: 'new', privacy: 'generic' },
      { id: 'b', type: 'AGENDA_PENDING_ACTION', priority: 'P2', source: 'agenda', title: 't', message: 'm', dedupKey: 'd2', createdAt: '2026-08-30T10:00:00.000Z', status: 'new', privacy: 'generic' },
    ])
    const service = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'basic' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    expect(await service.listNotifications()).toHaveLength(0)
    expect(await service.countUnread()).toBe(0)
    // Sigue existiendo en el repositorio: ocultar no es borrar.
    expect(repository.rows.size).toBe(2)
  })

  it('Bloque 3: volver a Profesional recupera las notificaciones vigentes sin recrearlas', async () => {
    const repository = createFakeRepository([
      { id: 'a', type: 'SEASON_ENDING', priority: 'P1', source: 'season', title: 't', message: 'm', dedupKey: 'd1', createdAt: '2026-08-30T10:00:00.000Z', status: 'new', privacy: 'generic' },
    ])
    const basicService = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'basic' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })
    const professionalService = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    expect(await basicService.listNotifications()).toHaveLength(0)
    const visibleAgain = await professionalService.listNotifications()
    expect(visibleAgain).toHaveLength(1)
    expect(visibleAgain[0].id).toBe('a')
  })

  it('dismiss transiciona a dismissed', async () => {
    const repository = createFakeRepository([
      { id: 'a', type: 't', priority: 'P2', source: 'goal', title: 't', message: 'm', dedupKey: 'd1', createdAt: '2026-08-30T10:00:00.000Z', status: 'new', privacy: 'generic' },
    ])
    const service = createNotificationService({
      repository,
      getPreferences: async () => DEFAULT_NOTIFICATION_PREFERENCES,
      getActiveUsageMode: async () => 'professional' as const,
      now: () => new Date('2026-08-30T12:00:00.000Z'),
    })

    await service.dismiss('a')
    expect(repository.rows.get('a')?.status).toBe('dismissed')
  })
})
