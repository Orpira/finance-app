import { type ReactNode, useEffect, useState } from 'react'

import { getOnboardingState } from '../../services/onboardingService'
import type { OnboardingState } from '../../types/onboarding'
import { OnboardingNavigator } from './OnboardingNavigator'

interface OnboardingGateProps { children: ReactNode }

export function OnboardingGate({ children }: OnboardingGateProps) {
  const [state, setState] = useState<OnboardingState | 'error' | 'loading'>('loading')

  function refresh() {
    return getOnboardingState()
      .then(setState)
      .catch(() => setState('error'))
  }

  useEffect(() => {
    refresh()
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Cargando...
      </div>
    )
  }

  if (state === 'error') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center dark:bg-slate-950">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          No se pudo cargar la configuración inicial.
        </p>
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white"
          onClick={() => {
            setState('loading')
            void refresh()
          }}
          type="button"
        >
          Reintentar
        </button>
      </main>
    )
  }

  if (state.completed) {
    return children
  }

  return <OnboardingNavigator currentStep={state.currentStep} onAdvance={refresh} />
}
