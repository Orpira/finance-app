import { getSettings } from '../services/settingsService'
import { DEFAULT_NOTIFICATION_PREFERENCES } from './notificationDefaults'
import { DEFAULT_COOLDOWN_MS, NOTIFICATION_COOLDOWNS } from './notificationLimits'
import { evaluateNotificationCandidate } from './notificationPolicyEngine'
import { createDexieNotificationRepository, type NotificationRepository } from './notificationRepository'
import type {
  CopilotNotification,
  NotificationCandidate,
  NotificationDecision,
  NotificationPolicyContext,
  NotificationPreferences,
} from './types'

export { DEFAULT_NOTIFICATION_PREFERENCES }

function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export interface NotificationServiceDeps {
  repository?: NotificationRepository
  getPreferences?: () => Promise<NotificationPreferences>
  now?: () => Date
}

export function createNotificationService(deps: NotificationServiceDeps = {}) {
  const repository = deps.repository ?? createDexieNotificationRepository()
  const getPreferences =
    deps.getPreferences ??
    (async () => (await getSettings()).notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES)
  const now = deps.now ?? (() => new Date())

  async function sweepExpired(currentTime: Date) {
    const all = await repository.list()
    const expired = all.filter(
      (notification) =>
        (notification.status === 'new' ||
          notification.status === 'seen' ||
          notification.status === 'read') &&
        notification.expiresAt &&
        currentTime.getTime() > new Date(notification.expiresAt).getTime(),
    )
    await Promise.all(expired.map((notification) => repository.setStatus(notification.id, 'expired')))
  }

  async function submitCandidate(candidate: NotificationCandidate): Promise<NotificationDecision> {
    const currentTime = now()
    const preferences = await getPreferences()
    const dayStart = startOfLocalDay(currentTime)

    const [activeByDedupKey, deliveredTodayForPriority, deliveredTodayNonCritical] = await Promise.all([
      repository.findBlockingByDedupKey(candidate.dedupKey, currentTime),
      repository.countByPrioritySince(candidate.priority, dayStart),
      repository.countNonCriticalSince(dayStart),
    ])

    const context: NotificationPolicyContext = {
      now: currentTime,
      preferences,
      activeByDedupKey,
      deliveredTodayForPriority,
      deliveredTodayNonCritical,
    }

    const cooldownMs =
      candidate.cooldownMs ?? NOTIFICATION_COOLDOWNS[candidate.type] ?? DEFAULT_COOLDOWN_MS

    const decision = await evaluateNotificationCandidate({ ...candidate, cooldownMs }, context)

    if (decision.decision === 'deliver') {
      await repository.create(decision.notification)
    } else {
      console.info(`[copilot-notifications] ${decision.decision}: ${candidate.type} (${decision.reason})`)
    }

    return decision
  }

  async function listNotifications(): Promise<CopilotNotification[]> {
    await sweepExpired(now())
    return repository.list()
  }

  async function countUnread(): Promise<number> {
    await sweepExpired(now())
    const all = await repository.list()
    return all.filter((notification) => notification.status === 'new').length
  }

  async function markSeen(id: string) {
    const notification = await repository.getById(id)
    if (notification?.status === 'new') await repository.setStatus(id, 'seen')
  }

  async function markRead(id: string) {
    await repository.setStatus(id, 'read')
  }

  async function dismiss(id: string) {
    await repository.setStatus(id, 'dismissed')
  }

  async function markActed(id: string) {
    await repository.setStatus(id, 'acted')
  }

  return {
    submitCandidate,
    listNotifications,
    countUnread,
    markSeen,
    markRead,
    dismiss,
    markActed,
  }
}

export type NotificationService = ReturnType<typeof createNotificationService>

let sharedService: NotificationService | undefined

/** App-wide singleton — rules and UI share the same repository/preferences wiring. */
export function getNotificationService(): NotificationService {
  if (!sharedService) sharedService = createNotificationService()
  return sharedService
}

export function notifyNotificationsChanged() {
  window.dispatchEvent(new CustomEvent('finance-app:notifications-changed'))
}
