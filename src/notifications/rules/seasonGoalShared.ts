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
  const parseBoundary = (value: string, endOfCivilDay: boolean) => {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
    const instant = Date.parse(dateOnly
      ? `${value}T${endOfCivilDay ? '23:59:59.999' : '00:00:00.000'}Z`
      : value)
    return Number.isFinite(instant) ? instant : undefined
  }
  const start = parseBoundary(period.startDate, false)
  const end = parseBoundary(period.plannedEndDate, true)
  const current = now.getTime()
  if (start === undefined || end === undefined || !Number.isFinite(current)) return undefined
  const total = end - start
  if (total <= 0) return undefined
  return Math.min(Math.max(((current - start) / total) * 100, 0), 100)
}
