import type { CountryCode, CurrencyCode } from './settings'

/**
 * v2: bienvenida, tipo de uso, modalidad profesional, primera temporada,
 * moneda, seguridad y finalización.
 */
export const CURRENT_ONBOARDING_VERSION = 2

export type OnboardingStepId =
  | 'welcome'
  | 'usage'
  | 'work-mode'
  | 'season'
  | 'currency'
  | 'security'
  | 'finish'

export const ONBOARDING_STEP_ORDER: readonly OnboardingStepId[] = [
  'welcome',
  'usage',
  'work-mode',
  'season',
  'currency',
  'security',
  'finish',
]

export const LAST_ONBOARDING_STEP_INDEX = ONBOARDING_STEP_ORDER.length - 1

export interface OnboardingState {
  backupRequested?: boolean
  completed: boolean
  completedAt?: string
  currentStep: number
  initialSeason?: InitialSeasonDraft
  version: number
}

export interface InitialSeasonDraft {
  economicGoal?: number
  earningPercentage: number
  name: string
  plannedEndDate?: string
  startDate: string
}

export interface AppPreferences {
  language: string
  countryCode: CountryCode
  currencyCode: CurrencyCode
  timeZone: string
  dateFormat: string
}
