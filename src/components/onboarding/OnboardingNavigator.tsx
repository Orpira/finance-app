import { useState } from 'react'

import { completeOnboarding, setOnboardingStep } from '../../services/onboardingService'
import { ONBOARDING_STEP_ORDER } from '../../types/onboarding'
import { PreferencesStep } from './steps/PreferencesStep'
import { SecurityStep } from './steps/SecurityStep'
import { WelcomeStep } from './steps/WelcomeStep'

interface OnboardingNavigatorProps {
  currentStep: number
  onAdvance: () => void
}

export function OnboardingNavigator({ currentStep, onAdvance }: OnboardingNavigatorProps) {
  const [isBusy, setIsBusy] = useState(false)

  async function goToStep(step: number) {
    setIsBusy(true)
    try {
      await setOnboardingStep(step)
      onAdvance()
    } finally {
      setIsBusy(false)
    }
  }

  async function skipToEnd() {
    setIsBusy(true)
    try {
      await completeOnboarding()
      onAdvance()
    } finally {
      setIsBusy(false)
    }
  }

  const stepId = ONBOARDING_STEP_ORDER[currentStep] ?? 'welcome'

  if (stepId === 'preferences') {
    return <PreferencesStep currentStep={currentStep} onNext={() => goToStep(2)} />
  }

  if (stepId === 'security') {
    return <SecurityStep currentStep={currentStep} onNext={() => goToStep(3)} />
  }

  return (
    <WelcomeStep
      currentStep={currentStep}
      isBusy={isBusy}
      onSkip={skipToEnd}
      onStart={() => goToStep(1)}
    />
  )
}
