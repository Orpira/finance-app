import { LockKeyhole } from 'lucide-react'
import { type FormEvent, type ReactNode, useEffect, useState } from 'react'

import { getSettings } from '../services/settingsService'
import { verifyPin } from '../services/pinService'

interface PinGateProps {
  children: ReactNode
}

type GateStatus = 'loading' | 'unlocked' | 'locked'

export function PinGate({ children }: PinGateProps) {
  const [status, setStatus] = useState<GateStatus>('loading')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    getSettings().then((settings) => {
      if (!isMounted) {
        return
      }

      setStatus(settings.pinEnabled && settings.pinHash ? 'locked' : 'unlocked')
    })

    return () => {
      isMounted = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    const isValid = await verifyPin(pin)

    if (isValid) {
      setStatus('unlocked')
      setPin('')
      return
    }

    setError('PIN incorrecto')
    setPin('')
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </div>
    )
  }

  if (status === 'unlocked') {
    return children
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
      <form
        className="flex w-full max-w-sm flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950">
              Ingrese PIN
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              La aplicación está bloqueada.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">PIN</span>
          <input
            autoComplete="current-password"
            autoFocus
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-center text-xl font-semibold tracking-[0.35em] text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            inputMode="numeric"
            maxLength={6}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
            pattern="[0-9]*"
            type="password"
            value={pin}
          />
        </label>

        <p className="min-h-5 text-center text-sm font-medium text-red-600">
          {error}
        </p>

        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={pin.length < 4}
          type="submit"
        >
          Desbloquear
        </button>
      </form>
    </main>
  )
}
