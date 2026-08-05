import { Calculator, Clock3 } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import {
  INCOME_CALCULATION_METHODS,
  type IncomeCalculationMethod,
} from '../../../catalogs/incomeCalculationMethods'
import { configureOnboardingIncomeCalculationMethod } from '../../../services/onboardingService'
import { OnboardingLayout } from '../OnboardingLayout'

interface WorkModeStepProps {
  currentStep: number
  onNext: () => void
}

export function WorkModeStep({ currentStep, onNext }: WorkModeStepProps) {
  const [method, setMethod] = useState<IncomeCalculationMethod | null>(null)
  const [hourlyRate, setHourlyRate] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const parsedHourlyRate = Number(hourlyRate)
  const hourlyRateIsValid =
    method !== 'hourly_workday' ||
    (hourlyRate.trim() !== '' &&
      Number.isFinite(parsedHourlyRate) &&
      parsedHourlyRate > 0)

  async function continueSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!method || !hourlyRateIsValid) return
    setIsSaving(true)
    setError('')
    try {
      await configureOnboardingIncomeCalculationMethod(
        method,
        method === 'hourly_workday' ? parsedHourlyRate : undefined,
      )
      onNext()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'No se pudo guardar el método de cálculo del ingreso.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      currentStep={currentStep}
      description="Define el formulario predeterminado para tus nuevos ingresos."
      footer={
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
          disabled={isSaving || !method || !hourlyRateIsValid}
          form="onboarding-income-method-form"
          type="submit"
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      }
      title="Método de cálculo del ingreso"
    >
      <form
        className="grid gap-4"
        id="onboarding-income-method-form"
        onSubmit={continueSetup}
      >
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="sr-only">Selecciona el método de cálculo del ingreso</legend>
          {INCOME_CALCULATION_METHODS.map(({ code, label }) => {
            const Icon = code === 'service_duration' ? Clock3 : Calculator

            return (
              <label
                className={[
                  'flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border p-3 text-center',
                  method === code
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : 'border-slate-200 dark:border-slate-700',
                ].join(' ')}
                key={code}
              >
                <Icon className="size-6 text-emerald-700" aria-hidden="true" />
                <input
                  checked={method === code}
                  className="sr-only"
                  name="income-calculation-method"
                  onChange={() => setMethod(code)}
                  type="radio"
                />
                <span className="text-sm font-semibold">{label}</span>
              </label>
            )
          })}
        </fieldset>

        {method === 'hourly_workday' ? (
          <label className="grid gap-1.5 text-left">
            <span className="text-sm font-medium">Valor por hora</span>
            <input
              aria-describedby="onboarding-hourly-rate-help"
              autoFocus
              className="h-11 rounded-md border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-950"
              inputMode="decimal"
              min="0.01"
              name="hourly-rate"
              onChange={(event) => setHourlyRate(event.target.value)}
              required
              step="0.01"
              type="number"
              value={hourlyRate}
            />
            <span
              className="text-xs text-slate-500 dark:text-slate-400"
              id="onboarding-hourly-rate-help"
            >
              Se aplicará en la moneda principal que elijas más adelante.
            </span>
          </label>
        ) : null}

        <p aria-live="polite" className="min-h-5 text-center text-sm text-red-600">{error}</p>
      </form>
    </OnboardingLayout>
  )
}