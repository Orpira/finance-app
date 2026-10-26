import type { CountryCode } from './settings'

export type TravelDestinationKind = 'city' | 'place'

/** Historical, manually confirmed destination for one record. */
export interface TravelDestination {
  kind: TravelDestinationKind
  label: string
  city?: string
  cityNormalized?: string
  countryCode?: CountryCode
  source: 'manual'
}
