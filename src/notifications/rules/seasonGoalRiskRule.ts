import { SEASON_GOAL_RISK_GAP_POINTS } from '../notificationLimits'
import type { NotificationCandidate } from '../types'
import { elapsedPercentage, getActiveSeasonGoalSnapshot } from './seasonGoalShared'

/** ADR-034 Fase 1 §28 — "Meta en riesgo": projected pace lags materially behind elapsed season time. */
export async function buildSeasonGoalRiskCandidate(now = new Date()): Promise<NotificationCandidate | null> {
  const snapshot = await getActiveSeasonGoalSnapshot()
  if (!snapshot || snapshot.progress.completed) return null

  const expected = elapsedPercentage(snapshot.period, now)
  if (expected === undefined) return null

  const gap = expected - snapshot.progress.percentage
  if (gap < SEASON_GOAL_RISK_GAP_POINTS) return null

  const periodId = snapshot.period.id

  return {
    type: 'SEASON_GOAL_RISK',
    priority: 'P2',
    source: 'goal',
    title: 'Meta de temporada',
    message:
      'Con el ritmo actual, la proyección está por debajo de la Meta de temporada. Puedes revisar el progreso en Temporadas.',
    dedupKey: `season-goal-risk:${periodId}`,
    action: { label: 'Ver progreso', destination: `/temporadas/${periodId}` },
    privacy: 'generic',
    metadata: { percentage: snapshot.progress.percentage },
    revalidate: async () => {
      const current = await getActiveSeasonGoalSnapshot()
      if (!current || current.period.id !== periodId || current.progress.completed) return false
      const currentExpected = elapsedPercentage(current.period, new Date())
      if (currentExpected === undefined) return false
      return currentExpected - current.progress.percentage >= SEASON_GOAL_RISK_GAP_POINTS
    },
  }
}
