import type {
  ClosedLocationSeason,
  ReopenedLocationSeason,
} from '../types/settings'

interface LocationRecord {
  city?: string
  country?: string
  dateTime?: string
}

function normalizeCity(city?: string) {
  return city?.trim().toLocaleLowerCase('es') ?? ''
}

function isSameLocation(
  first: LocationRecord,
  second: LocationRecord,
) {
  return (
    first.country === second.country &&
    normalizeCity(first.city) === normalizeCity(second.city)
  )
}

export function isLocationSeasonClosed(
  record: LocationRecord,
  closedLocationSeasons: ClosedLocationSeason[] = [],
  reopenedLocationSeasons: ReopenedLocationSeason[] = [],
) {
  if (!record.country) {
    return false
  }

  if (closedLocationSeasons.some((season) => isSameLocation(season, record))) {
    return true
  }

  if (!record.dateTime) {
    return false
  }

  const appointmentTime = new Date(record.dateTime).getTime()

  return reopenedLocationSeasons.some((season) => {
    const reopenedTime = new Date(season.reopenedAt).getTime()

    return (
      isSameLocation(season, record) &&
      Number.isFinite(appointmentTime) &&
      Number.isFinite(reopenedTime) &&
      appointmentTime <= reopenedTime
    )
  })
}

export function reopenLocationSeason(
  location: LocationRecord,
  closedLocationSeasons: ClosedLocationSeason[] = [],
  reopenedLocationSeasons: ReopenedLocationSeason[] = [],
  reopenedAt = new Date().toISOString(),
) {
  if (!location.country) {
    return { closedLocationSeasons, reopenedLocationSeasons }
  }

  const seasonsToReopen = closedLocationSeasons.filter((season) =>
    isSameLocation(season, location),
  )

  return {
    closedLocationSeasons: closedLocationSeasons.filter(
      (season) => !isSameLocation(season, location),
    ),
    reopenedLocationSeasons: [
      ...reopenedLocationSeasons,
      ...seasonsToReopen.map((season) => ({ ...season, reopenedAt })),
    ],
  }
}
