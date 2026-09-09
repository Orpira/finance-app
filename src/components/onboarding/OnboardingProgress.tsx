interface OnboardingProgressProps {
  stepNumber: number
  totalSteps: number
}

export function OnboardingProgress({ stepNumber, totalSteps }: OnboardingProgressProps) {
  return (
    <p
      aria-live="polite"
      aria-valuemax={totalSteps}
      aria-valuemin={1}
      aria-valuenow={stepNumber}
      className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300"
      role="progressbar"
    >
      Paso {stepNumber} de {totalSteps}
    </p>
  )
}
