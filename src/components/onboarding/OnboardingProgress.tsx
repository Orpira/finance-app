import { ONBOARDING_STEP_ORDER } from '../../types/onboarding'

interface OnboardingProgressProps {
  currentStep: number
}

export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <p
      aria-live="polite"
      className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
    >
      Paso {currentStep + 1} de {ONBOARDING_STEP_ORDER.length}
    </p>
  )
}
