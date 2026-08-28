import { ShieldCheck } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { getSettings } from '../../../services/settingsService'
import { setPin } from '../../../services/pinService'
import { isValidPin } from '../../../utils/pin'
import { OnboardingLayout } from '../OnboardingLayout'

interface SecurityStepProps {
  currentStep: number
  onNext: (backupRequested: boolean) => void | Promise<void>
  onBack?: () => void
}

export function SecurityStep({ currentStep, onNext, onBack }: SecurityStepProps) {
  const [pinAlreadyConfigured, setPinAlreadyConfigured] = useState<boolean | null>(null)
  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [backupRequested, setBackupRequested] = useState(false)

  useEffect(() => {
    let mounted = true

    getSettings().then((settings) => {
      if (mounted) setPinAlreadyConfigured(Boolean(settings.pinEnabled && settings.pinHash))
    })

    return () => {
      mounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!isValidPin(pin)) {
      setError('El PIN debe tener entre 4 y 6 números.')
      return
    }

    if (pin !== confirmPin) {
      setError('El PIN y la confirmación no coinciden.')
      return
    }

    setIsSaving(true)
    try {
      await setPin(pin)
      await onNext(backupRequested)
    } catch {
      setError('No se pudo guardar el PIN. Inténtalo de nuevo.')
    } finally {
      setIsSaving(false)
    }
  }

  if (pinAlreadyConfigured === null) {
    return (
      <OnboardingLayout currentStep={currentStep} footer={null} onBack={onBack} title="Seguridad">
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">Cargando...</p>
      </OnboardingLayout>
    )
  }

  if (pinAlreadyConfigured) {
    return (
      <OnboardingLayout
        currentStep={currentStep}
        description="Ya tienes un PIN configurado para desbloquear la app."
        footer={
          <button
            className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white"
            onClick={() => onNext(backupRequested)}
            type="button"
          >
            Continuar
          </button>
        }
        onBack={onBack}
        title="Seguridad lista"
      >
        <div className="flex justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="size-6" aria-hidden="true" />
          </span>
        </div>
      </OnboardingLayout>
    )
  }

  return (
    <OnboardingLayout
      backDisabled={isSaving}
      currentStep={currentStep}
      description="Protege el acceso a tus datos con un PIN. El desbloqueo biométrico no está disponible todavía en esta versión."
      footer={
        <>
          <button
            className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300"
            disabled={isSaving || pin.length < 4 || confirmPin.length < 4}
            form="onboarding-security-form"
            type="submit"
          >
            {isSaving ? 'Guardando...' : 'Guardar PIN'}
          </button>
          <button
            className="h-11 rounded-md text-sm font-semibold text-emerald-700 disabled:text-slate-300 dark:text-emerald-300"
            disabled={isSaving}
            onClick={() => onNext(backupRequested)}
            type="button"
          >
            Configurar más tarde
          </button>
        </>
      }
      onBack={onBack}
      title="Configura tu PIN"
    >
      <form
        className="flex flex-col gap-4 text-left"
        id="onboarding-security-form"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">PIN (4 a 6 números)</span>
          <input
            autoComplete="new-password"
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-center text-xl font-semibold tracking-[0.35em] text-slate-950 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ''))}
            pattern="[0-9]*"
            type="password"
            value={pin}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Confirma el PIN</span>
          <input
            autoComplete="new-password"
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-center text-xl font-semibold tracking-[0.35em] text-slate-950 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ''))}
            pattern="[0-9]*"
            type="password"
            value={confirmPin}
          />
        </label>
        <p aria-live="polite" className="min-h-5 text-center text-sm font-medium text-red-600">{error}</p>
      </form>
      <label className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-left dark:border-slate-700">
        <input
          checked={backupRequested}
          className="mt-0.5 size-5 accent-emerald-700"
          onChange={(event) => setBackupRequested(event.target.checked)}
          type="checkbox"
        />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
            Configurar copia de seguridad
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            Al finalizar podrás conectar Google Drive y definir una clave de cifrado.
          </span>
        </span>
      </label>
    </OnboardingLayout>
  )
}
