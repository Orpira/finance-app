import { CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { getSettings } from '../../../services/settingsService'
import { OnboardingLayout } from '../OnboardingLayout'

interface FinishStepProps {
  currentStep: number
  isBusy: boolean
  onFinish: (openBackup: boolean) => void
  onBack?: () => void
}

export function FinishStep({ currentStep, isBusy, onFinish, onBack }: FinishStepProps) {
  const [backupRequested, setBackupRequested] = useState(false)

  useEffect(() => {
    getSettings().then((settings) => {
      setBackupRequested(settings.onboarding.backupRequested ?? false)
    })
  }, [])

  return (
    <OnboardingLayout
      backDisabled={isBusy}
      currentStep={currentStep}
      description="Private Balance está listo para utilizarse."
      footer={
        <>
          <button className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isBusy} onClick={() => onFinish(false)} type="button">
            {isBusy ? 'Finalizando...' : 'Comenzar'}
          </button>
          {backupRequested && (
            <button className="h-11 rounded-md text-sm font-semibold text-emerald-700 disabled:text-slate-300 dark:text-emerald-300" disabled={isBusy} onClick={() => onFinish(true)} type="button">
              Configurar copia de seguridad
            </button>
          )}
        </>
      }
      onBack={onBack}
      title="Configuración completada"
    >
      <CheckCircle2 className="mx-auto size-16 text-emerald-700" aria-hidden="true" />
    </OnboardingLayout>
  )
}