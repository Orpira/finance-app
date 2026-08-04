import { type FormEvent, useState } from 'react'

import { configureOnboardingCurrency } from '../../../services/onboardingService'
import type { CurrencyCode } from '../../../types/settings'
import { currencies } from '../../../utils/countries'
import { OnboardingLayout } from '../OnboardingLayout'

interface CurrencyStepProps {
  currentStep: number
  onNext: () => void
}

export function CurrencyStep({ currentStep, onNext }: CurrencyStepProps) {
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await configureOnboardingCurrency(currency)
      onNext()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la moneda.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      description="Se usará de forma predeterminada en importes, temporadas y reportes."
      footer={
        <button className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={isSaving} form="onboarding-currency-form" type="submit">
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      }
      title="Moneda principal"
    >
      <form id="onboarding-currency-form" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-left">
          <span className="text-sm font-medium">Moneda de trabajo</span>
          <select className="h-12 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setCurrency(event.target.value as CurrencyCode)} value={currency}>
            {currencies.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <p aria-live="polite" className="mt-4 min-h-5 text-center text-sm text-red-600">{error}</p>
      </form>
    </OnboardingLayout>
  )
}