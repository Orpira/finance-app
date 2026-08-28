import { type FormEvent, useState } from 'react'

import { saveInitialSeasonDraft } from '../../../services/onboardingService'
import { getTodayInputDate } from '../../../utils/currency'
import { resolveOnboardingEarningPercentage } from '../../../utils/onboarding'
import { OnboardingLayout } from '../OnboardingLayout'

interface SeasonStepProps {
  currentStep: number
  onNext: () => void
  onBack?: () => void
}

function defaultPlannedEndDate() {
  const date = new Date()
  date.setMonth(date.getMonth() + 3)
  return date.toLocaleDateString('en-CA')
}

export function SeasonStep({ currentStep, onNext, onBack }: SeasonStepProps) {
  const [name, setName] = useState('Primera temporada')
  const [startDate, setStartDate] = useState(getTodayInputDate())
  const [plannedEndDate, setPlannedEndDate] = useState(defaultPlannedEndDate)
  const [economicGoal, setEconomicGoal] = useState('')
  const [earningPercentage, setEarningPercentage] = useState('50')
  const [percentageNotApplicable, setPercentageNotApplicable] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await saveInitialSeasonDraft({
        name,
        startDate,
        plannedEndDate,
        economicGoal: Number(economicGoal),
        earningPercentage: resolveOnboardingEarningPercentage(
          Number(earningPercentage),
          percentageNotApplicable,
        ),
      })
      onNext()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo guardar la temporada.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <OnboardingLayout
      backDisabled={isSaving}
      currentStep={currentStep}
      description="La fecha prevista es informativa; la temporada solo se cerrará cuando tú lo indiques."
      footer={
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
          disabled={isSaving}
          form="onboarding-season-form"
          type="submit"
        >
          {isSaving ? 'Guardando...' : 'Continuar'}
        </button>
      }
      onBack={onBack}
      title="Primera temporada"
    >
      <form className="grid gap-4 text-left" id="onboarding-season-form" onSubmit={handleSubmit}>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Nombre de la temporada</span>
          <input className="h-11 rounded-md border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setName(event.target.value)} required value={name} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Inicio</span>
            <input className="h-11 min-w-0 rounded-md border border-slate-300 px-2 dark:border-slate-700 dark:bg-slate-950" onChange={(event) => setStartDate(event.target.value)} required type="date" value={startDate} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Finalización prevista</span>
            <input className="h-11 min-w-0 rounded-md border border-slate-300 px-2 dark:border-slate-700 dark:bg-slate-950" min={startDate} onChange={(event) => setPlannedEndDate(event.target.value)} required type="date" value={plannedEndDate} />
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Meta económica</span>
          <input className="h-11 rounded-md border border-slate-300 px-3 dark:border-slate-700 dark:bg-slate-950" min="0.01" onChange={(event) => setEconomicGoal(event.target.value)} required step="0.01" type="number" value={economicGoal} />
        </label>
        <div className="grid gap-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Porcentaje de ganancia</span>
            <div className="flex items-center gap-3">
              <input
                className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:disabled:bg-slate-800"
                disabled={percentageNotApplicable}
                max="100"
                min="0"
                onChange={(event) => setEarningPercentage(event.target.value)}
                required={!percentageNotApplicable}
                step="0.01"
                type="number"
                value={percentageNotApplicable ? '100' : earningPercentage}
              />
              <span className="text-sm font-semibold text-slate-500">%</span>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-md border border-slate-200 p-3 dark:border-slate-700">
            <input
              checked={percentageNotApplicable}
              className="size-5 accent-emerald-700"
              onChange={(event) => setPercentageNotApplicable(event.target.checked)}
              type="checkbox"
            />
            <span className="text-sm font-medium">No aplica porcentaje, usar 100 %</span>
          </label>
        </div>
        <p aria-live="polite" className="min-h-5 text-center text-sm text-red-600">{error}</p>
      </form>
    </OnboardingLayout>
  )
}