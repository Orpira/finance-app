import { BriefcaseBusiness, Check, House } from 'lucide-react'
import { useState } from 'react'

import { configureOnboardingUsageMode } from '../../../services/onboardingService'
import { getNextOnboardingStepIndex } from '../../../types/onboarding'
import type { UsageMode } from '../../../types/settings'
import { OnboardingLayout } from '../OnboardingLayout'

interface UsageStepProps {
  stepNumber: number
  totalSteps: number
  onNext: (step: number) => void
  onBack?: () => void
}

const usageOptions = [
  {
    description: 'Controla tus ingresos, gastos, wallets y metas personales.',
    icon: House,
    label: 'Mis finanzas personales',
    value: 'basic' as const,
  },
  {
    description: 'Gestiona servicios, agenda, ingresos, gastos y objetivos de tu actividad profesional.',
    icon: BriefcaseBusiness,
    label: 'Mi actividad profesional',
    value: 'professional' as const,
  },
]

export function UsageStep({ stepNumber, totalSteps, onNext, onBack }: UsageStepProps) {
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
      onNext(getNextOnboardingStepIndex('usage', usageMode))
    } catch {
      setError('No se pudo guardar tu selección.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      backDisabled={isSaving}
      stepNumber={stepNumber}
      totalSteps={totalSteps}
      description="Elige el espacio con el que quieres comenzar."
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
      title="¿Qué quieres gestionar primero?"
    >
      <div aria-label="Espacio inicial" className="grid gap-3" role="radiogroup">
        {usageOptions.map(({ description, icon: Icon, label, value }) => {
          const isSelected = usageMode === value

          return (
            <button
              aria-checked={isSelected}
              aria-selected={isSelected}
              className={[
                'flex min-h-24 w-full cursor-pointer items-start gap-3 rounded-md border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900',
                isSelected
                  ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 dark:border-slate-700',
              ].join(' ')}
              key={value}
              onClick={() => {
                setUsageMode(value)
                setError('')
              }}
              role="radio"
              type="button"
            >
              <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden="true">
                {isSelected ? (
                  <Check className="size-5 stroke-[3] text-emerald-700" />
                ) : null}
              </span>
              <Icon className="mt-0.5 size-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                  {description}
                </span>
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Podrás activar el otro espacio más adelante sin perder tus datos.
      </p>
      <p aria-live="polite" className="min-h-5 text-center text-sm text-red-600">{error}</p>
    </OnboardingLayout>
  )
}
