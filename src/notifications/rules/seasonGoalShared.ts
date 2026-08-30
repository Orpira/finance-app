import {
  getActiveEarningPeriod,
  getSeasonGoalProgress,
  getSeasonStatistics,
  type SeasonGoalProgress,
} from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'

export interface ActiveSeasonGoalSnapshot {
  period: EarningPeriod & { id: number }
  progress: SeasonGoalProgress
}

/**
 * Single source of truth for "how is the active season's goal doing" used by both
 * seasonGoalRiskRule and seasonGoalAchievedRule — reuses getSeasonStatistics/
 * getSeasonGoalProgress exactly as SeasonDetailPage/HomePage do (ADR-034 §26: never
 * duplicate the Meta calculation).
 */
export async function getActiveSeasonGoalSnapshot(): Promise<ActiveSeasonGoalSnapshot | null> {
  const period = await getActiveEarningPeriod()
  if (!period?.id || period.status !== 'active') return null

  const stats = await getSeasonStatistics(period.id)
  const progress = getSeasonGoalProgress(period, {
    netIncome: stats.realGain,
    expenses: stats.expenses,
    result: stats.netGain,
  })

  if (!progress) return null

  return { period: { ...period, id: period.id }, progress }
}

export function elapsedPercentage(period: Pick<EarningPeriod, 'startDate' | 'plannedEndDate'>, now: Date): number | undefined {
  if (!period.plannedEndDate) return undefined
  const start = new Date(`${period.startDate}T00:00:00`).getTime()
  const end = new Date(`${period.plannedEndDate}T23:59:59`).getTime()
  const total = end - start
  if (total <= 0) return undefined
  return Math.min(Math.max(((now.getTime() - start) / total) * 100, 0), 100)
}
