import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  completeOnboarding,
  setOnboardingBackupRequested,
  setOnboardingStep,
} from '../../services/onboardingService'
import { ONBOARDING_STEP_ORDER } from '../../types/onboarding'
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

  if (stepId === 'usage') {
    return <UsageStep currentStep={currentStep} onNext={(step) => goToStep(step)} />
  }

  if (stepId === 'work-mode') {
    return <WorkModeStep currentStep={currentStep} onNext={() => goToStep(3)} />
  }

  if (stepId === 'season') {
    return <SeasonStep currentStep={currentStep} onNext={() => goToStep(4)} />
  }

  if (stepId === 'currency') {
    return <CurrencyStep currentStep={currentStep} onNext={() => goToStep(5)} />
  }

  if (stepId === 'security') {
    return (
      <SecurityStep
        currentStep={currentStep}
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
