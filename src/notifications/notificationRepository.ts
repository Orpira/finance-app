import { db } from '../database/db'
import type { CopilotNotification, NotificationPriority, NotificationStatus } from './types'

export interface NotificationRepository {
  create(notification: CopilotNotification): Promise<void>
  getById(id: string): Promise<CopilotNotification | undefined>
  /** Most recent record for dedupKey that is either unresolved or still within its cooldown. */
  findBlockingByDedupKey(dedupKey: string, now: Date): Promise<CopilotNotification | undefined>
  list(): Promise<CopilotNotification[]>
  setStatus(id: string, status: NotificationStatus): Promise<void>
  countByPrioritySince(priority: NotificationPriority, since: Date): Promise<number>
  countNonCriticalSince(since: Date): Promise<number>
}

const UNRESOLVED_STATUSES: NotificationStatus[] = ['new', 'seen', 'read']

export function createDexieNotificationRepository(
  database: Pick<typeof db, 'notifications'> = db,
): NotificationRepository {
  return {
    async create(notification) {
      await database.notifications.add(notification)
    },

    async getById(id) {
      return database.notifications.get(id)
    },

    async findBlockingByDedupKey(dedupKey, now) {
      const candidates = await database.notifications
        .where('dedupKey')
        .equals(dedupKey)
        .toArray()

      if (candidates.length === 0) return undefined

      const mostRecent = candidates.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

      if (UNRESOLVED_STATUSES.includes(mostRecent.status)) return mostRecent

      if (mostRecent.cooldownUntil && now.getTime() < new Date(mostRecent.cooldownUntil).getTime()) {
        return mostRecent
      }

      return undefined
    },

    async list() {
      const all = await database.notifications.toArray()
      return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    async setStatus(id, status) {
      await database.notifications.update(id, { status })
    },

    async countByPrioritySince(priority, since) {
      const all = await database.notifications
        .where('createdAt')
        .aboveOrEqual(since.toISOString())
        .toArray()
      return all.filter(
        (notification) => notification.priority === priority && notification.status !== 'suppressed',
      ).length
    },

    async countNonCriticalSince(since) {
      const all = await database.notifications
        .where('createdAt')
        .aboveOrEqual(since.toISOString())
        .toArray()
      return all.filter(
        (notification) => notification.priority !== 'P0' && notification.status !== 'suppressed',
      ).length
    },
  }
}
