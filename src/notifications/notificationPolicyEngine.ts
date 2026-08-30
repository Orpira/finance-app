import { isWithinQuietHours } from './quietHours'
import {
  frequencyLimitForPriority,
  MIN_NOTIFICATION_CONFIDENCE,
  NOTIFICATION_LIMITS,
} from './notificationLimits'
import type {
  CopilotNotification,
  NotificationCandidate,
  NotificationDecision,
  NotificationPolicyContext,
  NotificationPreferences,
  NotificationSuppressionReason,
} from './types'

function createFallbackId(): string {
  return `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isCategoryEnabled(
  candidate: NotificationCandidate,
  preferences: NotificationPreferences,
): boolean {
  if (candidate.priority === 'P0') return true
  if (candidate.source === 'agenda') return preferences.agendaNotificationsEnabled
  if (candidate.priority === 'P3') return preferences.periodicSummaryEnabled
  if (candidate.priority === 'P1') return preferences.importantAlertsEnabled
  return preferences.financialInsightsEnabled
}

function suppress(reason: NotificationSuppressionReason): NotificationDecision {
  return { decision: 'suppress', reason }
}

function defer(reason: NotificationSuppressionReason): NotificationDecision {
  return { decision: 'defer', reason }
}

export interface EvaluateNotificationCandidateOptions {
  createId?: () => string
}

/**
 * ADR-034 — the sole authority deciding whether a NotificationCandidate becomes a
 * CopilotNotification. Pure: no I/O, no Dexie access — NotificationService supplies
 * the context (preferences, dedup/cooldown lookup, today's counts) and persists the result.
 *
 * Fase 1 has no delivery queue: revalidate() therefore runs once, synchronously, standing in
 * for both the ADR's "sigue vigente" check and its separate "revalidar antes de entregar" step
 * (§11 vs §13 of the implementation doc) — there is no gap in time between the two in this design.
 */
export async function evaluateNotificationCandidate(
  candidate: NotificationCandidate,
  context: NotificationPolicyContext,
  options: EvaluateNotificationCandidateOptions = {},
): Promise<NotificationDecision> {
  const { preferences, now, activeByDedupKey } = context

  if (!preferences.copilotNotificationsEnabled) {
    return suppress('disabled')
  }

  if (!isCategoryEnabled(candidate, preferences)) {
    return suppress('category_disabled')
  }

  if (candidate.revalidate) {
    const stillValid = await candidate.revalidate()
    if (!stillValid) return suppress('stale')
  }

  if (candidate.expiresAt && now.getTime() > new Date(candidate.expiresAt).getTime()) {
    return suppress('expired')
  }

  if (candidate.priority === 'P1' && !candidate.action) {
    return suppress('invalid_action')
  }

  if (
    candidate.confidence !== undefined &&
    candidate.confidence < MIN_NOTIFICATION_CONFIDENCE
  ) {
    return suppress('low_confidence')
  }

  if (activeByDedupKey) {
    const isUnresolved =
      activeByDedupKey.status === 'new' ||
      activeByDedupKey.status === 'seen' ||
      activeByDedupKey.status === 'read'

    if (isUnresolved) return suppress('duplicate')

    const cooldownUntil = activeByDedupKey.cooldownUntil
    if (cooldownUntil && now.getTime() < new Date(cooldownUntil).getTime()) {
      return suppress('cooldown')
    }
  }

  if (candidate.priority !== 'P0') {
    const priorityLimit = frequencyLimitForPriority(candidate.priority)
    if (priorityLimit !== undefined && context.deliveredTodayForPriority >= priorityLimit) {
      return suppress('frequency_limit')
    }
    if (context.deliveredTodayNonCritical >= NOTIFICATION_LIMITS.NON_CRITICAL_PER_DAY) {
      return suppress('frequency_limit')
    }
  }

  if (candidate.priority !== 'P0' && isWithinQuietHours(now, preferences)) {
    return defer('quiet_hours')
  }

  const createId = options.createId ?? createFallbackId
  const notification: CopilotNotification = {
    id: createId(),
    type: candidate.type,
    priority: candidate.priority,
    source: candidate.source,
    title: candidate.title,
    message: candidate.message,
    reason: candidate.reason,
    confidence: candidate.confidence,
    action: candidate.action,
    dedupKey: candidate.dedupKey,
    createdAt: now.toISOString(),
    expiresAt: candidate.expiresAt,
    cooldownUntil: candidate.cooldownMs
      ? new Date(now.getTime() + candidate.cooldownMs).toISOString()
      : undefined,
    status: 'new',
    privacy: candidate.privacy ?? 'private',
    metadata: candidate.metadata,
  }

  return { decision: 'deliver', notification }
}
