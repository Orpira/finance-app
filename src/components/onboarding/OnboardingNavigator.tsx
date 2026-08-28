import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  completeOnboarding,
  setOnboardingBackupRequested,
  setOnboardingStep,
} from '../../services/onboardingService'
import { getSettings } from '../../services/settingsService'
import { ONBOARDING_STEP_ORDER, type OnboardingStepId } from '../../types/onboarding'
import type { UsageMode } from '../../types/settings'
import { CurrencyStep } from './steps/CurrencyStep'
import { FinishStep } from './steps/FinishStep'
import { SecurityStep } from './steps/SecurityStep'
import { SeasonStep } from './steps/SeasonStep'
import { UsageStep } from './steps/UsageStep'
import { WelcomeStep } from './steps/WelcomeStep'
import { WorkModeStep } from './steps/WorkModeStep'

interface OnboardingNavigatorProps {
  currentStep: number
  onAdvance: () => void
}

export function OnboardingNavigator({ currentStep, onAdvance }: OnboardingNavigatorProps) {
  const navigate = useNavigate()
  const [isBusy, setIsBusy] = useState(false)
  const [usageMode, setUsageMode] = useState<UsageMode | null>(null)

  useEffect(() => {
    let isMounted = true

    getSettings().then((settings) => {
      if (isMounted) setUsageMode(settings.usageMode)
    })

    return () => {
      isMounted = false
    }
  }, [currentStep])

  async function goToStep(step: number) {
    setIsBusy(true)
    try {
      await setOnboardingStep(step)
      onAdvance()
    } finally {
      setIsBusy(false)
    }
  }

  async function finish(openBackup: boolean) {
    setIsBusy(true)
    try {
      await completeOnboarding()
      if (openBackup) navigate('/settings/backup', { replace: true })
      onAdvance()
    } finally {
      setIsBusy(false)
    }
  }

  // El modo personal salta 'work-mode' y 'season': 'currency' vuelve
  // directo a 'usage' en ese caso, en vez de a 'season'.
  function getPreviousStep(stepId: OnboardingStepId): number | undefined {
    switch (stepId) {
      case 'usage':
        return 0
      case 'work-mode':
        return 1
      case 'season':
        return 2
      case 'currency':
        return usageMode === 'professional' ? 3 : 1
      case 'security':
        return 4
      case 'finish':
        return 5
      default:
        return undefined
    }
  }

  const stepId = ONBOARDING_STEP_ORDER[currentStep] ?? 'welcome'
  const previousStep = getPreviousStep(stepId)
  const onBack = previousStep === undefined ? undefined : () => goToStep(previousStep)

  if (stepId === 'usage') {
    return <UsageStep currentStep={currentStep} onBack={onBack} onNext={(step) => goToStep(step)} />
  }

  if (stepId === 'work-mode') {
    return <WorkModeStep currentStep={currentStep} onBack={onBack} onNext={() => goToStep(3)} />
  }

  if (stepId === 'season') {
    return <SeasonStep currentStep={currentStep} onBack={onBack} onNext={() => goToStep(4)} />
  }

  if (stepId === 'currency') {
    return <CurrencyStep currentStep={currentStep} onBack={onBack} onNext={() => goToStep(5)} />
  }

  if (stepId === 'security') {
    return (
      <SecurityStep
        currentStep={currentStep}
        onBack={onBack}
        onNext={async (backupRequested) => {
          await setOnboardingBackupRequested(backupRequested)
          await goToStep(6)
        }}
      />
    )
  }

  if (stepId === 'finish') {
    return (
      <FinishStep
        currentStep={currentStep}
        isBusy={isBusy}
        onBack={onBack}
        onFinish={finish}
      />
    )
  }

  return (
    <WelcomeStep
      currentStep={currentStep}
      isBusy={isBusy}
      onStart={() => goToStep(1)}
    />
  )
}
