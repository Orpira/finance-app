import { BriefcaseBusiness, House } from 'lucide-react'
import { useState } from 'react'

import { configureOnboardingUsageMode } from '../../../services/onboardingService'
import type { UsageMode } from '../../../types/settings'
import { OnboardingLayout } from '../OnboardingLayout'

interface UsageStepProps {
  currentStep: number
  onNext: (step: number) => void
}

const usageOptions = [
  {
    description: 'Ingresos y gastos personales, sin temporadas.',
    icon: House,
    label: 'Personal',
    value: 'basic' as const,
  },
  {
    description: 'Actividad, agenda, temporadas y reportes profesionales.',
    icon: BriefcaseBusiness,
    label: 'Profesional',
    value: 'professional' as const,
  },
]

export function UsageStep({ currentStep, onNext }: UsageStepProps) {
  const [usageMode, setUsageMode] = useState<UsageMode | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function continueSetup() {
    if (!usageMode) {
      setError('Selecciona un tipo de uso.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await configureOnboardingUsageMode(usageMode)
      onNext(usageMode === 'professional' ? 2 : 4)
    } catch {
      setError('No se pudo guardar el tipo de uso.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      description="Elige el espacio que vas a utilizar."
      footer={
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
          disabled={isSaving || !usageMode}
          onClick={continueSetup}
          type="button"
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      }
      title="Tipo de uso"
    >
      <fieldset className="grid gap-3">
        <legend className="sr-only">Selecciona el tipo de uso</legend>
        {usageOptions.map(({ description, icon: Icon, label, value }) => (
          <label
            className={[
              'flex cursor-pointer items-start gap-3 rounded-md border p-4 text-left',
              usageMode === value
                ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-slate-200 dark:border-slate-700',
            ].join(' ')}
            key={value}
          >
            <input
              checked={usageMode === value}
              className="mt-1 size-4 accent-emerald-700"
              name="usage-mode"
              onChange={() => setUsageMode(value)}
              type="radio"
            />
            <Icon className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {description}
              </span>
            </span>
          </label>
        ))}
        <div className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-left opacity-60 dark:border-slate-700 dark:bg-slate-800">
          <input className="mt-1 size-4" disabled type="radio" />
          <span>
            <span className="block text-sm font-semibold">Profesional + Personal</span>
            <span className="mt-1 block text-xs text-slate-500">Próximamente</span>
          </span>
        </div>
      </fieldset>
      <p aria-live="polite" className="min-h-5 text-center text-sm text-red-600">{error}</p>
    </OnboardingLayout>
  )
}