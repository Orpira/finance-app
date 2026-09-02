import { BriefcaseBusiness, House } from 'lucide-react'
import { useState } from 'react'

import { configureOnboardingUsageMode } from '../../../services/onboardingService'
import type { UsageMode } from '../../../types/settings'
import { OnboardingLayout } from '../OnboardingLayout'

interface UsageStepProps {
  currentStep: number
  onNext: (step: number) => void
  onBack?: () => void
}

const usageOptions = [
  {
    complement: 'Controla tus ingresos y gastos personales de forma sencilla.',
    icon: House,
    label: 'Personal',
    tagline: 'Para tus finanzas del día a día.',
    value: 'basic' as const,
  },
  {
    complement: 'Gestiona jornadas o servicios, agenda, ingresos, gastos y objetivos.',
    icon: BriefcaseBusiness,
    label: 'Profesional',
    tagline: 'Para controlar tu trabajo y tus ganancias.',
    value: 'professional' as const,
  },
]

export function UsageStep({ currentStep, onNext, onBack }: UsageStepProps) {
  const [usageMode, setUsageMode] = useState<UsageMode | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function continueSetup() {
    if (!usageMode) {
      setError('Selecciona una opción para continuar.')
      return
    }

    setIsSaving(true)
    setError('')
    try {
      await configureOnboardingUsageMode(usageMode)
      onNext(usageMode === 'professional' ? 2 : 4)
    } catch {
      setError('No se pudo guardar tu selección.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      backDisabled={isSaving}
      currentStep={currentStep}
      description="Elige la opción que mejor se adapte a ti."
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
      onBack={onBack}
      title="¿Cómo vas a utilizar Private Balance?"
    >
      <fieldset className="grid gap-3">
        <legend className="sr-only">Selecciona cómo vas a utilizar Private Balance</legend>
        {usageOptions.map(({ complement, icon: Icon, label, tagline, value }) => (
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
                {tagline}
              </span>
              <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                {complement}
              </span>
            </span>
          </label>
        ))}
        <label className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-left opacity-60 dark:border-slate-700 dark:bg-slate-800">
          <input className="mt-1 size-4" disabled type="radio" />
          <span>
            <span className="block text-sm font-semibold">Profesional + Personal</span>
            <span className="mt-1 block text-xs text-slate-500">
              Gestiona por separado tus finanzas personales y profesionales.
            </span>
            <span className="mt-1 block text-xs font-medium text-slate-400 dark:text-slate-500">
              Próximamente
            </span>
          </span>
        </label>
      </fieldset>
      <p aria-live="polite" className="min-h-5 text-center text-sm text-red-600">{error}</p>
    </OnboardingLayout>
  )
}