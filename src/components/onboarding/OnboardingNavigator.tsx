import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  completeOnboarding,
  setOnboardingBackupRequested,
  setOnboardingStep,
} from '../../services/onboardingService'
import { getSettings } from '../../services/settingsService'
import {
  getOnboardingStepPosition,
  getPreviousOnboardingStepIndex,
  ONBOARDING_STEP_ORDER,
} from '../../types/onboarding'
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

  const stepId = ONBOARDING_STEP_ORDER[currentStep] ?? 'welcome'
  const { stepNumber, totalSteps } = getOnboardingStepPosition(stepId, usageMode)
  const previousStep = getPreviousOnboardingStepIndex(stepId, usageMode)
  const onBack = previousStep === undefined ? undefined : () => goToStep(previousStep)

  if (stepId === 'usage') {
    return (
      <UsageStep
        stepNumber={stepNumber}
        totalSteps={totalSteps}
        onBack={onBack}
        onNext={(step) => goToStep(step)}
      />
    )
  }

  const showHybridBanner = usageMode === 'hybrid'

  if (stepId === 'work-mode') {
    return <WorkModeStep stepNumber={stepNumber} totalSteps={totalSteps} onBack={onBack} onNext={() => goToStep(3)} showHybridBanner={showHybridBanner} />
  }

  if (stepId === 'season') {
    return <SeasonStep stepNumber={stepNumber} totalSteps={totalSteps} onBack={onBack} onNext={() => goToStep(4)} showHybridBanner={showHybridBanner} />
  }

  if (stepId === 'currency') {
    return <CurrencyStep stepNumber={stepNumber} totalSteps={totalSteps} onBack={onBack} onNext={() => goToStep(5)} showHybridBanner={showHybridBanner} />
  }

  if (stepId === 'security') {
    return (
      <SecurityStep
        stepNumber={stepNumber}
        totalSteps={totalSteps}
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
        stepNumber={stepNumber}
        totalSteps={totalSteps}
        isBusy={isBusy}
        onBack={onBack}
        onFinish={finish}
      />
    )
  }

  return (
    <WelcomeStep
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      isBusy={isBusy}
      onStart={() => goToStep(1)}
    />
  )
}
