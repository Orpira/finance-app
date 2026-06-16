import type { ClosedLocationSeason, CountryCode } from '../types/settings'

interface LocationRecord {
  city?: string
  country?: string
}

function normalizeCity(city?: string) {
  return city?.trim().toLocaleLowerCase('es') ?? ''
}

export function isLocationSeasonClosed(
  record: LocationRecord,
  closedLocationSeasons: ClosedLocationSeason[] = [],
) {
  if (!record.country) {
    return false
  }

  return closedLocationSeasons.some(
    (season) =>
      season.country === (record.country as CountryCode) &&
      normalizeCity(season.city) === normalizeCity(record.city),
  )
}
