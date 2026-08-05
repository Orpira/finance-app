import type { EarningPeriod } from '../types/earningPeriod'

const RECENT_SEASONS_LIMIT = 2

export type SeasonOverviewState =
  | { kind: 'active'; active: EarningPeriod }
  | { kind: 'history'; recent: EarningPeriod[]; remaining: EarningPeriod[] }
  | { kind: 'empty' }

function closedAtValue(period: EarningPeriod) {
  return period.closedAt ?? period.endDate ?? period.startDate
}

export function getSeasonOverviewState(
  active: EarningPeriod | null,
  closed: readonly EarningPeriod[],
): SeasonOverviewState {
  if (active) return { kind: 'active', active }
  if (closed.length === 0) return { kind: 'empty' }

  const ordered = [...closed].sort((left, right) =>
    closedAtValue(right).localeCompare(closedAtValue(left)),
  )

  return {
    kind: 'history',
    recent: ordered.slice(0, RECENT_SEASONS_LIMIT),
    remaining: ordered.slice(RECENT_SEASONS_LIMIT),
  }
}
