import { ArrowLeft, LockKeyhole, ShieldOff } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  changePin,
  removePin,
  setPin,
} from '../../services/pinService'
import { getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'
import { isValidPin } from '../../utils/pin'

type PinStatus = 'idle' | 'saving' | 'saved' | 'error'

export function SettingsSecurityPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [currentPin, setCurrentPin] = useState('')
  const [nextPin, setNextPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStatus, setPinStatus] = useState<PinStatus>('idle')
  const [pinMessage, setPinMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadSettings() {
      const currentSettings = await getSettings()

      if (isMounted) {
        setSettings(currentSettings)
      }
    }

    loadSettings()

    return () => {
      isMounted = false
    }
  }, [])

  async function handlePinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    if (!isValidPin(nextPin)) {
      setPinStatus('error')
      setPinMessage('El PIN debe tener entre 4 y 6 números.')
      return
    }

    if (nextPin !== confirmPin) {
      setPinStatus('error')
      setPinMessage('La confirmación no coincide.')
      return
    }

    setPinStatus('saving')
    setPinMessage('')

    try {
      const updatedSettings = settings.pinEnabled
        ? await changePin(currentPin, nextPin)
        : await setPin(nextPin)

      setSettings(updatedSettings)
      setCurrentPin('')
      setNextPin('')
      setConfirmPin('')
      setPinStatus('saved')
      setPinMessage(settings.pinEnabled ? 'PIN actualizado' : 'PIN activado')
    } catch (error) {
      setPinStatus('error')
      setPinMessage(
        error instanceof Error ? error.message : 'No se pudo guardar el PIN.',
      )
    }
  }

  async function handleDisablePin() {
    if (!settings) {
      return
    }

    setPinStatus('saving')
    setPinMessage('')

    try {
      const updatedSettings = await removePin(currentPin)

      setSettings(updatedSettings)
      setCurrentPin('')
      setNextPin('')
      setConfirmPin('')
      setPinStatus('saved')
      setPinMessage('PIN desactivado')
    } catch (error) {
      setPinStatus('error')
      setPinMessage(
        error instanceof Error ? error.message : 'No se pudo desactivar el PIN.',
      )
    }
  }

  function handlePinInput(value: string, onChange: (value: string) => void) {
    onChange(value.replace(/\D/g, '').slice(0, 6))
    setPinStatus('idle')
    setPinMessage('')
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
          to="/settings"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Configuración
        </Link>
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-emerald-700">Seguridad</p>
          <h1 className="text-2xl font-semibold text-slate-950">
            Acceso con PIN
          </h1>
        </div>
      </header>

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handlePinSubmit}
      >
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <LockKeyhole className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Seguridad
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {settings.pinEnabled ? 'PIN activo' : 'PIN desactivado'}
            </p>
          </div>
        </div>

        {settings.pinEnabled && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              PIN actual
            </span>
            <input
              autoComplete="current-password"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                handlePinInput(event.target.value, setCurrentPin)
              }
              pattern="[0-9]*"
              type="password"
              value={currentPin}
            />
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              {settings.pinEnabled ? 'Nuevo PIN' : 'PIN'}
            </span>
            <input
              autoComplete="new-password"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                handlePinInput(event.target.value, setNextPin)
              }
              pattern="[0-9]*"
              type="password"
              value={nextPin}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Confirmar PIN
            </span>
            <input
              autoComplete="new-password"
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                handlePinInput(event.target.value, setConfirmPin)
              }
              pattern="[0-9]*"
              type="password"
              value={confirmPin}
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={[
              'min-h-5 text-sm font-medium',
              pinStatus === 'error' ? 'text-red-600' : 'text-slate-500',
            ].join(' ')}
            role="status"
          >
            {pinMessage}
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            {settings.pinEnabled && (
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                disabled={pinStatus === 'saving' || currentPin.length < 4}
                onClick={handleDisablePin}
                type="button"
              >
                <ShieldOff className="size-4" aria-hidden="true" />
                Desactivar
              </button>
            )}

            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={pinStatus === 'saving'}
              type="submit"
            >
              <LockKeyhole className="size-4" aria-hidden="true" />
              {pinStatus === 'saving'
                ? 'Guardando'
                : settings.pinEnabled
                  ? 'Cambiar PIN'
                  : 'Activar PIN'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default SettingsSecurityPage
