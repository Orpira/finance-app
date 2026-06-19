import type { CountryCode } from './settings'

export type EarningPeriodStatus = 'active' | 'closed'

export interface EarningPeriod {
  id?: number
  name: string
  percentage: number
  startDate: string
  endDate?: string
  status: EarningPeriodStatus
  country?: string
  countryCode?: CountryCode
  city?: string
  createdAt: string
  closedAt?: string
}
