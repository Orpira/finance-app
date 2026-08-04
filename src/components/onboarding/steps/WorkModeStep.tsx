import { Clock3 } from 'lucide-react'
import { useState } from 'react'

import type { WorkedTimeUnit } from '../../../catalogs/incomeCalculationMethods'
import { configureOnboardingWorkMode } from '../../../services/onboardingService'
import { OnboardingLayout } from '../OnboardingLayout'

interface WorkModeStepProps {
  currentStep: number
  onNext: () => void
}

export function WorkModeStep({ currentStep, onNext }: WorkModeStepProps) {
  const [unit, setUnit] = useState<WorkedTimeUnit | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function continueSetup() {
    if (!unit) return
    setIsSaving(true)
    setError('')
    try {
      await configureOnboardingWorkMode(unit)
      onNext()
    } catch {
      setError('No se pudo guardar la modalidad de trabajo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      description="Esta unidad se aplicará al registro y a los reportes de actividad."
      footer={
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
          disabled={isSaving || !unit}
          onClick={continueSetup}
          type="button"
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      }
      title="¿Cómo deseas registrar tu actividad?"
    >
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="sr-only">Modalidad de trabajo</legend>
        {([
          ['minutes', 'Por minutos'],
          ['hours', 'Por horas'],
        ] as const).map(([value, label]) => (
          <label
            className={[
              'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border p-3 text-center',
              unit === value
                ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : 'border-slate-200 dark:border-slate-700',
            ].join(' ')}
            key={value}
          >
            <Clock3 className="size-6 text-emerald-700" aria-hidden="true" />
            <input
              checked={unit === value}
              className="sr-only"
              name="work-mode"
              onChange={() => setUnit(value)}
              type="radio"
            />
            <span className="text-sm font-semibold">{label}</span>
          </label>
        ))}
      </fieldset>
      <p aria-live="polite" className="min-h-5 text-center text-sm text-red-600">{error}</p>
    </OnboardingLayout>
  )
}