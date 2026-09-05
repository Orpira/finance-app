import { describe, expect, it } from 'vitest'

import {
  hasRecordsForUsageMode,
  isBasicMode,
  isHybridMode,
  isProfessionalMode,
  recordBelongsToUsageMode,
  requiresSeason,
  resolveActiveUsageMode,
  resolveRecordUsageMode,
  resolveUsageMode,
  usesEarningPercentage,
  usesProfessionalAgenda,
} from '../src/utils/usageMode'

describe('resolveUsageMode (raw/persisted value)', () => {
  it('preserves hybrid as-is instead of collapsing it', () => {
    expect(resolveUsageMode({ usageMode: 'hybrid' })).toBe('hybrid')
  })

  it('keeps normalizing basic/professional and their legacy aliases', () => {
    expect(resolveUsageMode({ usageMode: 'basic' })).toBe('basic')
    expect(resolveUsageMode({ usageMode: 'personal' })).toBe('basic')
    expect(resolveUsageMode({ usageMode: 'professional' })).toBe('professional')
    expect(resolveUsageMode({ usageMode: 'business' })).toBe('professional')
    expect(resolveUsageMode({ userType: 'basic' })).toBe('basic')
    expect(resolveUsageMode({ userType: 'basico' })).toBe('basic')
    expect(resolveUsageMode(undefined)).toBe('professional')
  })
})

describe('resolveActiveUsageMode (capability-gating value)', () => {
  it('matches resolveUsageMode for plain basic/professional installs', () => {
    expect(resolveActiveUsageMode({ usageMode: 'basic' })).toBe('basic')
    expect(resolveActiveUsageMode({ usageMode: 'professional' })).toBe('professional')
  })

  it('resolves hybrid installs to their activeContext', () => {
    expect(
      resolveActiveUsageMode({ usageMode: 'hybrid', activeContext: 'basic' }),
    ).toBe('basic')
    expect(
      resolveActiveUsageMode({ usageMode: 'hybrid', activeContext: 'professional' }),
    ).toBe('professional')
  })

  it('defaults hybrid installs without an activeContext to professional', () => {
    expect(resolveActiveUsageMode({ usageMode: 'hybrid' })).toBe('professional')
  })
})

describe('isProfessionalMode / isBasicMode / isHybridMode', () => {
  it('reflect the active context for hybrid installs, not the raw mode', () => {
    const hybridInBasic = { usageMode: 'hybrid' as const, activeContext: 'basic' as const }
    const hybridInProfessional = {
      usageMode: 'hybrid' as const,
      activeContext: 'professional' as const,
    }

    expect(isHybridMode(hybridInBasic)).toBe(true)
    expect(isHybridMode(hybridInProfessional)).toBe(true)

    expect(isBasicMode(hybridInBasic)).toBe(true)
    expect(isProfessionalMode(hybridInBasic)).toBe(false)

    expect(isBasicMode(hybridInProfessional)).toBe(false)
    expect(isProfessionalMode(hybridInProfessional)).toBe(true)
  })

  it('keep plain basic/professional installs unaffected', () => {
    expect(isHybridMode({ usageMode: 'basic' })).toBe(false)
    expect(isHybridMode({ usageMode: 'professional' })).toBe(false)
    expect(isBasicMode({ usageMode: 'basic' })).toBe(true)
    expect(isProfessionalMode({ usageMode: 'professional' })).toBe(true)
  })

  it('requiresSeason/usesEarningPercentage/usesProfessionalAgenda follow the active context', () => {
    const hybridInBasic = { usageMode: 'hybrid' as const, activeContext: 'basic' as const }
    const hybridInProfessional = {
      usageMode: 'hybrid' as const,
      activeContext: 'professional' as const,
    }

    expect(requiresSeason(hybridInBasic)).toBe(false)
    expect(usesEarningPercentage(hybridInBasic)).toBe(false)
    expect(usesProfessionalAgenda(hybridInBasic)).toBe(false)

    expect(requiresSeason(hybridInProfessional)).toBe(true)
    expect(usesEarningPercentage(hybridInProfessional)).toBe(true)
    expect(usesProfessionalAgenda(hybridInProfessional)).toBe(true)
  })
})

describe('resolveRecordUsageMode / recordBelongsToUsageMode', () => {
  it('never resolves a record as hybrid — falls back to season-based inference', () => {
    // A record can only ever be tagged 'basic' or 'professional'; if some
    // legacy/corrupt state carried 'hybrid' on a record, treat it like an
    // untagged record (infer from season linkage) rather than matching
    // nothing at all.
    const corruptRecord = { usageMode: 'hybrid' as never, earningPeriodId: 7 }
    expect(resolveRecordUsageMode(corruptRecord)).toBe('professional')

    const corruptRecordNoSeason = { usageMode: 'hybrid' as never }
    expect(resolveRecordUsageMode(corruptRecordNoSeason)).toBe('basic')
  })

  it('infers professional for records linked to a season, basic otherwise', () => {
    expect(resolveRecordUsageMode({ earningPeriodId: 1 })).toBe('professional')
    expect(resolveRecordUsageMode({ seasonPeriodId: 1 })).toBe('professional')
    expect(resolveRecordUsageMode({})).toBe('basic')
  })

  it('trusts an explicit basic/professional tag over season inference', () => {
    expect(
      resolveRecordUsageMode({ usageMode: 'basic', earningPeriodId: 1 }),
    ).toBe('basic')
  })

  it('recordBelongsToUsageMode/hasRecordsForUsageMode isolate by active mode', () => {
    const basicIncome = { usageMode: 'basic' as const }
    const professionalIncome = { usageMode: 'professional' as const, earningPeriodId: 1 }

    expect(recordBelongsToUsageMode(basicIncome, 'basic')).toBe(true)
    expect(recordBelongsToUsageMode(basicIncome, 'professional')).toBe(false)
    expect(recordBelongsToUsageMode(professionalIncome, 'professional')).toBe(true)
    expect(recordBelongsToUsageMode(professionalIncome, 'basic')).toBe(false)

    expect(hasRecordsForUsageMode([basicIncome, professionalIncome], 'basic')).toBe(true)
    expect(hasRecordsForUsageMode([professionalIncome], 'basic')).toBe(false)
  })
})
