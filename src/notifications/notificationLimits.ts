import type { NotificationPriority } from './types'

/** ADR-034 §9 — daily caps per priority. P0 is exempt (checked separately). */
export const NOTIFICATION_LIMITS = {
  P1_PER_DAY: 3,
  P2_PER_DAY: 2,
  P3_PER_DAY: 1,
  NON_CRITICAL_PER_DAY: 5,
} as const

/** ADR-034 §10 — minimum time before the same dedupKey may notify again after being dismissed/expired. */
export const NOTIFICATION_COOLDOWNS: Record<string, number> = {
  SEASON_ENDING: 24 * 60 * 60 * 1000,
  SEASON_GOAL_RISK: 24 * 60 * 60 * 1000,
  // Effectively "once per season": no realistic season runs a full year.
  SEASON_GOAL_ACHIEVED: 365 * 24 * 60 * 60 * 1000,
  AGENDA_PENDING_ACTION: 24 * 60 * 60 * 1000,
}

export const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000

/** ADR-034 §8 — insights below this confidence never produce a proactive notification. */
export const MIN_NOTIFICATION_CONFIDENCE = 0.7

/** ADR-034 §12 — minimum deterioration (percentage points) to re-raise an already-active season-goal-risk notification. */
export const SEASON_GOAL_MATERIAL_CHANGE_POINTS = 15

/** ADR-034 §27 (Fase 1 §27) — days-remaining threshold for the "season ending soon" rule. */
export const SEASON_ENDING_WARNING_DAYS = 7

/**
 * Fase 1 §28 — a season is "at risk" when the elapsed-time percentage outpaces the
 * achieved-goal percentage by at least this many points. Deliberately generous to avoid
 * alarmism early in a season, when small samples make the projection noisy.
 */
export const SEASON_GOAL_RISK_GAP_POINTS = 20

export function frequencyLimitForPriority(priority: NotificationPriority): number | undefined {
  switch (priority) {
    case 'P1':
      return NOTIFICATION_LIMITS.P1_PER_DAY
    case 'P2':
      return NOTIFICATION_LIMITS.P2_PER_DAY
    case 'P3':
      return NOTIFICATION_LIMITS.P3_PER_DAY
    case 'P0':
      return undefined
  }
}
