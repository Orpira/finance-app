import type { CountryCode, CurrencyCode, UsageMode } from './settings'

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

// 'work-mode' y 'season' solo aplican al recorrido Profesional/Híbrido; con
// Personal (o mientras aún no se elige modo) quedan fuera del itinerario
// efectivo. Punto único de verdad para "PASO X DE Y" y para la navegación
// Atrás/Continuar, evitando condicionales duplicados en cada pantalla.
export function getVisibleOnboardingSteps(usageMode: UsageMode | null): OnboardingStepId[] {
  return ONBOARDING_STEP_ORDER.filter((stepId) => {
    if (stepId === 'work-mode' || stepId === 'season') {
      return usageMode === 'professional' || usageMode === 'hybrid'
    }
    return true
  })
}

export function getOnboardingStepPosition(
  stepId: OnboardingStepId,
  usageMode: UsageMode | null,
): { stepNumber: number; totalSteps: number } {
  const visibleSteps = getVisibleOnboardingSteps(usageMode)
  const index = visibleSteps.indexOf(stepId)

  return { stepNumber: (index === -1 ? 0 : index) + 1, totalSteps: visibleSteps.length }
}

export function getPreviousOnboardingStepIndex(
  stepId: OnboardingStepId,
  usageMode: UsageMode | null,
): number | undefined {
  const visibleSteps = getVisibleOnboardingSteps(usageMode)
  const visibleIndex = visibleSteps.indexOf(stepId)

  if (visibleIndex <= 0) return undefined

  return ONBOARDING_STEP_ORDER.indexOf(visibleSteps[visibleIndex - 1])
}

export function getNextOnboardingStepIndex(
  stepId: OnboardingStepId,
  usageMode: UsageMode | null,
): number {
  const visibleSteps = getVisibleOnboardingSteps(usageMode)
  const nextId = visibleSteps[visibleSteps.indexOf(stepId) + 1]

  return ONBOARDING_STEP_ORDER.indexOf(nextId ?? stepId)
}

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
