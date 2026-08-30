import type { NotificationPreferences } from './types'

function minutesSinceLocalMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function parseTimeToMinutes(value: string): number | undefined {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return hours * 60 + minutes
}

/** ADR-034 §19 — supports ranges that cross midnight (e.g. 22:00–08:00). */
export function isWithinQuietHours(now: Date, preferences: NotificationPreferences): boolean {
  if (!preferences.quietHoursEnabled) return false

  const start = parseTimeToMinutes(preferences.quietHoursStart)
  const end = parseTimeToMinutes(preferences.quietHoursEnd)
  if (start === undefined || end === undefined || start === end) return false

  const current = minutesSinceLocalMidnight(now)

  if (start < end) {
    return current >= start && current < end
  }

  return current >= start || current < end
}
