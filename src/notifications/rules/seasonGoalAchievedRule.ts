import type { NotificationCandidate } from '../types'
import { getActiveSeasonGoalSnapshot } from './seasonGoalShared'

/** ADR-034 Fase 1 §29 — "Meta alcanzada", emitted once per season (see NOTIFICATION_COOLDOWNS). */
export async function buildSeasonGoalAchievedCandidate(): Promise<NotificationCandidate | null> {
  const snapshot = await getActiveSeasonGoalSnapshot()
  if (!snapshot || !snapshot.progress.completed) return null

  const periodId = snapshot.period.id

  return {
    type: 'SEASON_GOAL_ACHIEVED',
    priority: 'P3',
    source: 'goal',
    title: 'Meta de temporada alcanzada',
    message: `Has alcanzado la Meta de temporada de ${snapshot.period.name}.`,
    dedupKey: `season-goal-achieved:${periodId}`,
    action: { label: 'Ver temporada', destination: `/temporadas/${periodId}` },
    privacy: 'generic',
  }
}
