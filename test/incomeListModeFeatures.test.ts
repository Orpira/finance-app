import { describe, expect, it } from 'vitest'

import { getIncomeListModeFeatures } from '../src/pages/Income/incomeListModeFeatures'

describe('income list features by usage mode', () => {
  it('hides additionals and operational statuses in personal mode', () => {
    expect(
      getIncomeListModeFeatures({ usageMode: 'basic', userType: 'basic' }),
    ).toEqual({
      showAdditionals: false,
      showOperationalStatus: false,
    })
  })

  it('keeps additionals and operational statuses in professional mode', () => {
    expect(
      getIncomeListModeFeatures({
        usageMode: 'professional',
        userType: 'primary',
      }),
    ).toEqual({
      showAdditionals: true,
      showOperationalStatus: true,
    })
  })
})