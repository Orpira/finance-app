import type { ActiveContext, UsageMode, UserType } from '../types/settings'
import type { FinancialGoal } from '../types/financialGoal'

type SettingsWithLegacyMode = {
  usageMode?: UsageMode | 'personal' | 'business'
  userType?: UserType | 'principal' | 'basico' | 'professional'
}

type SettingsWithActiveContext = SettingsWithLegacyMode & {
  activeContext?: ActiveContext
}

/**
 * Normalizes the *configured* usage mode as stored in settings, tolerating
 * legacy aliases. Unlike `resolveActiveUsageMode`, this never collapses
 * `'hybrid'` — it is the source of truth for persistence (`normalizeSettings`,
 * `updateSettings`, Dexie migrations) and must round-trip `'hybrid'` as-is.
 */
export function resolveUsageMode(settings?: SettingsWithLegacyMode): UsageMode {
  if (settings?.usageMode === 'hybrid') {
    return 'hybrid'
  }

  if (settings?.usageMode === 'basic' || settings?.usageMode === 'personal') {
    return 'basic'
  }

  if (
    settings?.usageMode === 'professional' ||
    settings?.usageMode === 'business'
  ) {
    return 'professional'
  }

  if (settings?.userType === 'basic' || settings?.userType === 'basico') {
    return 'basic'
  }

  return 'professional'
}

/**
 * Resolves the workspace that currently governs capability checks, record
 * filtering and calculations — i.e. what the rest of the app should treat
 * as "the" usage mode right now. For `'basic'`/`'professional'` installs
 * this is identical to `resolveUsageMode`; for `'hybrid'` installs it
 * resolves to whichever workspace (`activeContext`) the user has selected,
 * defaulting to `'professional'` if that is somehow missing.
 *
 * Use this (directly or via `isProfessionalMode`/`isBasicMode`/etc.) for any
 * decision about what to show, filter or calculate. Use `resolveUsageMode`
 * only when you need the raw configured value (persistence, onboarding,
 * Settings display).
 */
export function resolveActiveUsageMode(
  settings?: SettingsWithActiveContext,
): 'basic' | 'professional' {
  const usageMode = resolveUsageMode(settings)

  if (usageMode === 'hybrid') {
    return settings?.activeContext === 'basic' ? 'basic' : 'professional'
  }

  return usageMode
}

export function toLegacyUserType(usageMode: UsageMode): UserType {
  return usageMode === 'basic' ? 'basic' : 'primary'
}

export function isProfessionalMode(settings?: SettingsWithActiveContext) {
  return resolveActiveUsageMode(settings) === 'professional'
}

export function isBasicMode(settings?: SettingsWithActiveContext) {
  return resolveActiveUsageMode(settings) === 'basic'
}

export function isHybridMode(settings?: SettingsWithLegacyMode) {
  return resolveUsageMode(settings) === 'hybrid'
}

// Ver también usageCapabilities.ts:canUseCapability — la matriz central
// tipada que documenta, en un solo lugar, que estas capacidades son
// exclusivamente profesionales. Estos alias siguen siendo la forma de
// consultarlo en la mayoría de los ~50 sitios existentes (formularios,
// rutas, servicios, exportaciones, asistente): ambos leen la misma
// resolución (resolveActiveUsageMode).
export const requiresSeason = isProfessionalMode
export const usesEarningPercentage = isProfessionalMode
export const usesProfessionalAgenda = isProfessionalMode

export interface UsageModeRecord {
  usageMode?: UsageMode
  earningPeriodId?: number
  seasonPeriodId?: number
}

/**
 * Old records are inferred safely: records linked to a season are professional;
 * records that never had a season belong to basic mode.
 *
 * `usageMode` here must be an *active* mode (`'basic'` | `'professional'`,
 * as produced by `resolveActiveUsageMode`), never the raw `'hybrid'` value —
 * no record is ever tagged `'hybrid'`, so comparing against it would always
 * return false.
 */
export function recordBelongsToUsageMode(
  record: UsageModeRecord,
  usageMode: 'basic' | 'professional',
) {
  return resolveRecordUsageMode(record) === usageMode
}

export function hasRecordsForUsageMode(
  records: readonly UsageModeRecord[],
  usageMode: 'basic' | 'professional',
) {
  return records.some((record) => recordBelongsToUsageMode(record, usageMode))
}

export function resolveRecordUsageMode(
  record: UsageModeRecord,
): 'basic' | 'professional' {
  if (record.usageMode === 'basic' || record.usageMode === 'professional') {
    return record.usageMode
  }

  const hasSeason =
    record.earningPeriodId !== undefined || record.seasonPeriodId !== undefined

  return hasSeason ? 'professional' : 'basic'
}

export function financialGoalBelongsToUsageMode(
  goal: Pick<FinancialGoal, 'usageMode'>,
  usageMode: 'basic' | 'professional',
) {
  return goal.usageMode === usageMode
}
