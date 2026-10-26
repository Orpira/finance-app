export interface SeasonRevisionBase {
  id?: number
  earningPeriodId: number
  sequence: number
  recordedAt: string
  reason?: string
}

export interface SeasonMigrationBaselineRevision extends SeasonRevisionBase {
  kind: 'migration_baseline'
  source: 'migration_baseline'
  previousValue: null
  nextValue: { plannedEndDate?: string; economicGoal?: number }
}

export interface SeasonPlannedEndRevision extends SeasonRevisionBase {
  kind: 'planned_end_date_revised'
  source: 'season_creation' | 'user_extension' | 'user_correction'
  previousValue: string | null
  nextValue: string
}

export interface SeasonEconomicGoalRevision extends SeasonRevisionBase {
  kind: 'economic_goal_revised'
  source: 'season_creation' | 'user_revision'
  previousValue: number | null
  nextValue: number
}

export interface SeasonStayCorrectionSnapshot {
  city: string
  countryCode: CountryCode
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartAt?: string
  actualEndAt?: string
  timeZone?: string
}

export interface SeasonStayCorrectionRevision extends SeasonRevisionBase {
  kind: 'season_stay_corrected'
  source: 'user_correction'
  seasonStayId: number
  previousValue: SeasonStayCorrectionSnapshot
  nextValue: SeasonStayCorrectionSnapshot
}

export type SeasonRevision =
  | SeasonMigrationBaselineRevision
  | SeasonPlannedEndRevision
  | SeasonEconomicGoalRevision
  | SeasonStayCorrectionRevision
import type { CountryCode } from './settings'

