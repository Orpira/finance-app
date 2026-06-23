import type { CountryCode, CurrencyCode } from './settings'

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
  baseCurrency?: CurrencyCode
  notes?: string
  createdAt: string
  updatedAt?: string
  closedAt?: string
}

export type SeasonPeriod = EarningPeriod
