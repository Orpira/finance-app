import type { UsageMode, UserType } from '../types/settings'

type SettingsWithLegacyMode = {
  usageMode?: UsageMode | 'personal' | 'business'
  userType?: UserType | 'principal' | 'basico' | 'professional'
}

export function resolveUsageMode(settings?: SettingsWithLegacyMode): UsageMode {
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

export function toLegacyUserType(usageMode: UsageMode): UserType {
  return usageMode === 'basic' ? 'basic' : 'primary'
}

export function isProfessionalMode(settings?: SettingsWithLegacyMode) {
  return resolveUsageMode(settings) === 'professional'
}

export function isBasicMode(settings?: SettingsWithLegacyMode) {
  return resolveUsageMode(settings) === 'basic'
}

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
 */
export function recordBelongsToUsageMode(
  record: UsageModeRecord,
  usageMode: UsageMode,
) {
  return resolveRecordUsageMode(record) === usageMode
}

export function resolveRecordUsageMode(record: UsageModeRecord): UsageMode {
  if (record.usageMode) return record.usageMode

  const hasSeason =
    record.earningPeriodId !== undefined || record.seasonPeriodId !== undefined

  return hasSeason ? 'professional' : 'basic'
}
