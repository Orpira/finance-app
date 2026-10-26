import type { CountryCode } from './settings'

export type SeasonStayStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type SeasonStayCancellationReasonCode = 'user_cancelled' | 'season_closed'

export interface SeasonStay {
  id?: number
  earningPeriodId: number
  position: number
  city: string
  cityNormalized: string
  countryCode: CountryCode
  status: SeasonStayStatus
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartAt?: string
  actualEndAt?: string
  timeZone?: string
  locationSource: 'manual'
  createdAt: string
  updatedAt: string
  completedAt?: string
  cancelledAt?: string
  cancellationReasonCode?: SeasonStayCancellationReasonCode
  cancellationReason?: string
}

export interface SelectableSeasonStay {
  id: number
  earningPeriodId: number
  status: SeasonStayStatus
  city: string
  visitNumber: number
  label: string
  selectable: boolean
  selected: boolean
  disabledReason?: 'not_started' | 'cancelled' | 'outside_interval' | 'season_closed'
}
