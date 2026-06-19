import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { LockKeyhole, RotateCcw } from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { resetLocalAppForPinRecovery } from '../services/securityRecoveryService'
import { getSettings } from '../services/settingsService'
import { verifyPin } from '../services/pinService'

interface PinGateProps { children: ReactNode }
type GateStatus = 'loading' | 'unlocked' | 'locked'

const INACTIVITY_MS = 2 * 60 * 1000
const LAST_ACTIVITY_KEY = 'finance-app:last-activity-at'

export function PinGate({ children }: PinGateProps) {
  const [status, setStatus] = useState<GateStatus>('loading')
  const [pinEnabled, setPinEnabled] = useState(false)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [showRecovery, setShowRecovery] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const lastActivity = useRef(0)

  const lock = useCallback(() => {
    if (pinEnabled) {
      setStatus('locked')
      setPin('')
    }
  }, [pinEnabled])

  const registerActivity = useCallback(() => {
    if (status !== 'unlocked') return
    lastActivity.current = Date.now()
    localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity.current))
  }, [status])

  useEffect(() => {
    let mounted = true
    lastActivity.current = Date.now()
    getSettings().then((settings) => {
      if (!mounted) return
      const enabled = Boolean(settings.pinEnabled && settings.pinHash)
      setPinEnabled(enabled)
      setStatus(enabled ? 'locked' : 'unlocked')
    })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!pinEnabled) return

    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart']
    events.forEach((event) => window.addEventListener(event, registerActivity, { passive: true }))
    const timer = window.setInterval(() => {
      if (status === 'unlocked' && Date.now() - lastActivity.current >= INACTIVITY_MS) lock()
    }, 5_000)

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
        return
      }
      const stored = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? lastActivity.current)
      if (Date.now() - stored >= INACTIVITY_MS) lock()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    let removeNativeListener: (() => void) | undefined
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()))
          lock()
        }
      }).then((listener) => { removeNativeListener = () => listener.remove() })
    }

    return () => {
      events.forEach((event) => window.removeEventListener(event, registerActivity))
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibility)
      removeNativeListener?.()
    }
  }, [lock, pinEnabled, registerActivity, status])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (await verifyPin(pin)) {
      lastActivity.current = Date.now()
      localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivity.current))
      setStatus('unlocked')
      setPin('')
      return
    }
    setError('PIN incorrecto')
    setPin('')
  }

  async function handleSecureReset() {
    if (resetConfirmation !== 'BORRAR') return
    await resetLocalAppForPinRecovery()
    window.location.replace('/')
  }

  if (status === 'loading') return <div className="flex min-h-dvh items-center justify-center bg-slate-50 text-sm text-slate-500">Cargando...</div>
  if (status === 'unlocked') return children

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <form className="flex w-full max-w-sm flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900" onSubmit={handleSubmit}>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><LockKeyhole className="size-6" /></div>
          <div><h1 className="text-xl font-semibold text-slate-950 dark:text-white">Ingresa tu PIN</h1><p className="mt-1 text-sm text-slate-500">La aplicación está bloqueada.</p></div>
        </div>
        <label className="flex flex-col gap-2"><span className="text-sm font-medium text-slate-700 dark:text-slate-300">PIN</span><input autoComplete="current-password" autoFocus className="h-12 rounded-md border border-slate-300 bg-white px-3 text-center text-xl font-semibold tracking-[0.35em] text-slate-950 outline-none focus:border-emerald-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white" inputMode="numeric" maxLength={6} onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))} pattern="[0-9]*" type="password" value={pin} /></label>
        <p className="min-h-5 text-center text-sm font-medium text-red-600">{error}</p>
        <button className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white disabled:bg-slate-300" disabled={pin.length < 4} type="submit">Desbloquear</button>
        <button className="text-sm font-semibold text-emerald-700" onClick={() => setShowRecovery((value) => !value)} type="button">¿Olvidaste tu PIN?</button>
        {showRecovery ? (
          <aside className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
            <p className="font-semibold">Restablecimiento local seguro</p>
            <p className="mt-2 leading-5">Esta app no usa una cuenta remota. Para impedir que otra persona evite el PIN, la única recuperación segura elimina todos los datos locales y crea una app nueva.</p>
            <label className="mt-3 flex flex-col gap-2"><span>Escribe <strong>BORRAR</strong> para confirmar:</span><input className="h-10 rounded-md border border-amber-300 bg-white px-3" onChange={(event) => setResetConfirmation(event.target.value)} value={resetConfirmation} /></label>
            <button className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-red-700 px-3 font-semibold text-white disabled:bg-slate-300" disabled={resetConfirmation !== 'BORRAR'} onClick={handleSecureReset} type="button"><RotateCcw className="size-4" />Borrar datos y restablecer</button>
          </aside>
        ) : null}
      </form>
    </main>
  )
}
