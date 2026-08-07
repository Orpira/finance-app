import { OnboardingLayout } from '../OnboardingLayout'

interface WelcomeStepProps {
  currentStep: number
  isBusy: boolean
  onStart: () => void
}

export function WelcomeStep({ currentStep, isBusy, onStart }: WelcomeStepProps) {
  return (
    <OnboardingLayout
      currentStep={currentStep}
      description="Tus finanzas. Tu privacidad. Tu control."
      footer={
        <>
          <button
            className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
            disabled={isBusy}
            onClick={onStart}
            type="button"
          >
            Comenzar
          </button>
        </>
      }
      title="Private Balance"
    >
      <img
        alt=""
        aria-hidden="true"
        className="mx-auto size-24 object-contain"
        src="/Favicon_512.png"
      />
    </OnboardingLayout>
  )
}
