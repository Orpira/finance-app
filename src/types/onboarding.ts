import type { CountryCode, CurrencyCode } from './settings'

/**
 * v1: bienvenida, preferencias, seguridad, tutorial (4 pasos, índices 0-3).
 * Si CURRENT_ONBOARDING_VERSION sube en el futuro, ver nota en onboardingService.ts
 * sobre usuarios que ya completaron una versión anterior.
 */
export const CURRENT_ONBOARDING_VERSION = 1

export type OnboardingStepId = 'welcome' | 'preferences' | 'security' | 'tutorial'

export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = [
  'welcome',
  'preferences',
  'security',
  'tutorial',
]

export const LAST_ONBOARDING_STEP_INDEX = ONBOARDING_STEP_ORDER.length - 1

export interface OnboardingState {
  completed: boolean
  completedAt?: string
  currentStep: number
  version: number
}

export interface AppPreferences {
  language: string
  countryCode: CountryCode
  currencyCode: CurrencyCode
  timeZone: string
  dateFormat: string
}
