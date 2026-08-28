import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { OnboardingProgress } from './OnboardingProgress'

interface OnboardingLayoutProps {
  currentStep: number
  title: string
  description?: string
  children?: ReactNode
  footer: ReactNode
  onBack?: () => void
  backDisabled?: boolean
}

export function OnboardingLayout({
  currentStep,
  title,
  description,
  children,
  footer,
  onBack,
  backDisabled,
}: OnboardingLayoutProps) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950"
      style={{
        paddingTop: 'max(env(safe-area-inset-top), 1rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)',
      }}
    >
      <div className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <OnboardingProgress currentStep={currentStep} />
        {onBack ? (
          <button
            className="inline-flex min-h-9 w-fit items-center gap-1.5 self-start rounded-md text-sm font-semibold text-emerald-700 transition hover:text-emerald-800 disabled:text-slate-300 dark:text-emerald-300 dark:hover:text-emerald-200"
            disabled={backDisabled}
            onClick={onBack}
            type="button"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            <span>Atrás</span>
          </button>
        ) : null}
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-950 dark:text-white">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        {children}
        <div className="flex flex-col gap-2">{footer}</div>
      </div>
    </main>
  )
}
