import { describe, expect, it } from 'vitest'

import { CURRENT_ONBOARDING_VERSION, LAST_ONBOARDING_STEP_INDEX } from '../src/types/onboarding'
import {
  createCompletedOnboardingState,
  createDefaultOnboardingState,
  formatDateWithPattern,
  pickFirstAvailableTutorialTarget,
  resolveInitialScreen,
  validateOnboardingPreferences,
  getOnboardingWorkModeSettings,
  resolveOnboardingEarningPercentage,
} from '../src/utils/onboarding'

describe('createDefaultOnboardingState', () => {
  it('starts uncompleted at step 0 on the current version', () => {
    expect(createDefaultOnboardingState()).toEqual({
      completed: false,
      currentStep: 0,
      version: CURRENT_ONBOARDING_VERSION,
    })
  })
})

describe('createCompletedOnboardingState', () => {
  it('marks completion at the last step with the given timestamp', () => {
    const completedAt = '2026-07-27T10:00:00.000Z'

    expect(createCompletedOnboardingState(completedAt)).toEqual({
      completed: true,
      completedAt,
      currentStep: LAST_ONBOARDING_STEP_INDEX,
      version: CURRENT_ONBOARDING_VERSION,
    })
  })
})

describe('resolveInitialScreen', () => {
  it('shows the splash screen while the app is not ready, regardless of other state', () => {
    expect(
      resolveInitialScreen({
        appIsReady: false,
        onboardingCompleted: true,
        securityEnabled: true,
        sessionUnlocked: true,
      }),
    ).toBe('splash')
  })

  it('shows onboarding when it has not been completed yet', () => {
    expect(
      resolveInitialScreen({
        appIsReady: true,
        onboardingCompleted: false,
        securityEnabled: false,
        sessionUnlocked: false,
      }),
    ).toBe('onboarding')
  })

  it('shows the lock screen once onboarding is done but the session is locked', () => {
    expect(
      resolveInitialScreen({
        appIsReady: true,
        onboardingCompleted: true,
        securityEnabled: true,
        sessionUnlocked: false,
      }),
    ).toBe('lock')
  })

  it('shows the main application when onboarding is done and there is nothing to unlock', () => {
    expect(
      resolveInitialScreen({
        appIsReady: true,
        onboardingCompleted: true,
        securityEnabled: false,
        sessionUnlocked: false,
      }),
    ).toBe('main')
  })

  it('shows the main application when onboarding is done and the session is already unlocked', () => {
    expect(
      resolveInitialScreen({
        appIsReady: true,
        onboardingCompleted: true,
        securityEnabled: true,
        sessionUnlocked: true,
      }),
    ).toBe('main')
  })
})

describe('validateOnboardingPreferences', () => {
  const validPreferences = {
    language: 'es',
    countryCode: 'ES',
    currencyCode: 'EUR',
    timeZone: 'Europe/Madrid',
    dateFormat: 'dd/MM/yyyy',
  }

  it('returns no errors when every field is filled', () => {
    expect(validateOnboardingPreferences(validPreferences)).toEqual({})
  })

  it('reports every blank field, one message per field', () => {
    const errors = validateOnboardingPreferences({
      language: '',
      countryCode: '  ',
      currencyCode: 'EUR',
      timeZone: 'Europe/Madrid',
      dateFormat: '',
    })

    expect(Object.keys(errors).sort()).toEqual(['countryCode', 'dateFormat', 'language'])
  })
})

describe('formatDateWithPattern', () => {
  it('formats a date with the dd/MM/yyyy pattern', () => {
    expect(formatDateWithPattern(new Date(2026, 6, 27), 'dd/MM/yyyy')).toBe('27/07/2026')
  })

  it('formats the same date with the yyyy-MM-dd pattern', () => {
    expect(formatDateWithPattern(new Date(2026, 6, 27), 'yyyy-MM-dd')).toBe('2026-07-27')
  })

  it('pads single-digit day and month', () => {
    expect(formatDateWithPattern(new Date(2026, 0, 5), 'dd/MM/yyyy')).toBe('05/01/2026')
  })
})

describe('pickFirstAvailableTutorialTarget', () => {
  it('returns the first candidate key present in the DOM snapshot', () => {
    expect(
      pickFirstAvailableTutorialTarget(['nav-agenda', 'nav-reports'], new Set(['nav-reports'])),
    ).toBe('nav-reports')
  })

  it('prefers earlier candidates when both are present', () => {
    expect(
      pickFirstAvailableTutorialTarget(
        ['nav-agenda', 'nav-reports'],
        new Set(['nav-agenda', 'nav-reports']),
      ),
    ).toBe('nav-agenda')
  })

  it('returns undefined when no candidate is present', () => {
    expect(
      pickFirstAvailableTutorialTarget(['pending-income-card'], new Set(['nav-income'])),
    ).toBeUndefined()
  })
})

describe('getOnboardingWorkModeSettings', () => {
  it.each(['minutes', 'hours'] as const)(
    'configura la unidad %s sin cambiar el método de cálculo financiero',
    (workedTimeUnit) => {
      expect(getOnboardingWorkModeSettings(workedTimeUnit)).toEqual({
        workedTimeUnit,
      })
    },
  )
})

describe('resolveOnboardingEarningPercentage', () => {
  it('conserva el porcentaje indicado cuando sí aplica', () => {
    expect(resolveOnboardingEarningPercentage(65, false)).toBe(65)
  })

  it('usa 100 % cuando el usuario indica que no aplica porcentaje', () => {
    expect(resolveOnboardingEarningPercentage(65, true)).toBe(100)
  })
})
