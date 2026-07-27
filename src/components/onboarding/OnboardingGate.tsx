import { type ReactNode, useEffect, useState } from 'react'

import { getOnboardingState } from '../../services/onboardingService'
import { ONBOARDING_STEP_ORDER, type OnboardingState } from '../../types/onboarding'
import { createCompletedOnboardingState } from '../../utils/onboarding'
import { OnboardingNavigator } from './OnboardingNavigator'
import { TutorialOverlay } from './TutorialOverlay'

interface OnboardingGateProps { children: ReactNode }

export function OnboardingGate({ children }: OnboardingGateProps) {
  const [state, setState] = useState<OnboardingState | 'loading'>('loading')

  function refresh() {
    return getOnboardingState()
      .then(setState)
      .catch(() => setState(createCompletedOnboardingState(new Date().toISOString())))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Cargando...
      </div>
    )
  }

  if (state.completed) {
    return children
  }

  const stepId = ONBOARDING_STEP_ORDER[state.currentStep] ?? 'welcome'

  if (stepId === 'tutorial') {
    return (
      <>
        {children}
        <TutorialOverlay onDone={refresh} />
      </>
    )
  }

  return <OnboardingNavigator currentStep={state.currentStep} onAdvance={refresh} />
}
