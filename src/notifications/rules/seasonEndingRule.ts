import { getActiveEarningPeriod } from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'
import { SEASON_ENDING_WARNING_DAYS } from '../notificationLimits'
import type { NotificationCandidate } from '../types'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function daysRemaining(period: Pick<EarningPeriod, 'plannedEndDate'>, now: Date): number | undefined {
  if (!period.plannedEndDate) return undefined
  // plannedEndDate se persiste como ISO completo ("...T23:59:59.999Z", ver earningPeriodService.ts);
  // slice(0, 10) evita concatenar una hora sobre un timestamp que ya la incluye.
  const end = new Date(`${period.plannedEndDate.slice(0, 10)}T23:59:59`).getTime()
  return Math.ceil((end - now.getTime()) / MS_PER_DAY)
}

/** ADR-034 Fase 1 §27 — "Fin de temporada próximo". Reuses getActiveEarningPeriod as the single source of truth. */
export async function buildSeasonEndingCandidate(now = new Date()): Promise<NotificationCandidate | null> {
  const period = await getActiveEarningPeriod()
  if (!period?.id || period.status !== 'active') return null

  const remaining = daysRemaining(period, now)
  if (remaining === undefined || remaining < 0 || remaining > SEASON_ENDING_WARNING_DAYS) return null

  const periodId = period.id

  return {
    type: 'SEASON_ENDING',
    priority: 'P1',
    source: 'season',
    title: 'Tu temporada termina pronto',
    message:
      remaining === 0
        ? `${period.name} termina hoy.`
        : `${period.name} termina en ${remaining} día${remaining === 1 ? '' : 's'}.`,
    dedupKey: `season-ending:${periodId}`,
    action: { label: 'Ver temporada', destination: `/temporadas/${periodId}` },
    privacy: 'generic',
    revalidate: async () => {
      const current = await getActiveEarningPeriod()
      if (!current?.id || current.id !== periodId || current.status !== 'active') return false
      const currentRemaining = daysRemaining(current, new Date())
      return currentRemaining !== undefined && currentRemaining >= 0 && currentRemaining <= SEASON_ENDING_WARNING_DAYS
    },
  }
}
