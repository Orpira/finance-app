import { Copy, KeyRound, RefreshCw, ShieldAlert } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import {
  activateLicense,
  getDeviceCode,
} from '../../services/licenseService'

type LicenseScreenMode = 'activation' | 'expired' | 'clock-tampered'

interface LicenseActivationPageProps {
  mode?: LicenseScreenMode
  onActivated?: () => void | Promise<void>
  onRetry?: () => void | Promise<void>
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = value
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  document.execCommand('copy')
  textArea.remove()
}

export function LicenseActivationPage({
  mode = 'activation',
  onActivated,
  onRetry,
}: LicenseActivationPageProps) {
  const [deviceCode, setDeviceCode] = useState('Cargando...')
  const [activationCode, setActivationCode] = useState('')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [isActivating, setIsActivating] = useState(false)
  const [showRenewalForm, setShowRenewalForm] = useState(mode === 'activation')

  useEffect(() => {
    let mounted = true

    getDeviceCode()
      .then((code) => {
        if (mounted) setDeviceCode(code)
      })
      .catch(() => {
        if (mounted) {
          setDeviceCode('No disponible')
          setError('No se pudo generar el código de este dispositivo.')
        }
      })

    return () => {
      mounted = false
    }
  }, [])

  async function handleCopyDeviceCode() {
    try {
      await copyText(deviceCode)
      setStatusMessage('Código del dispositivo copiado.')
      setError('')
    } catch {
      setError('No se pudo copiar. Mantén pulsado el código para seleccionarlo.')
    }
  }

  async function handleActivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setStatusMessage('')
    setIsActivating(true)

    try {
      await activateLicense(activationCode)
      setStatusMessage('Licencia activada correctamente.')
      await onActivated?.()
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'No se pudo activar la licencia.',
      )
    } finally {
      setIsActivating(false)
    }
  }

  const isClockTampered = mode === 'clock-tampered'
  const isExpired = mode === 'expired'
  const handleActivationCodeChange = (value: string) => {
    setActivationCode(
      value.trimStart().startsWith('PB-LIC-V2.') ? value : value.toUpperCase(),
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4 py-8">
      <section className="flex w-full max-w-md flex-col gap-5 rounded-2xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div
            className={[
              'flex size-14 items-center justify-center rounded-full',
              isExpired || isClockTampered
                ? 'bg-amber-100 text-amber-700'
                : 'bg-emerald-100 text-emerald-700',
            ].join(' ')}
          >
            {isExpired || isClockTampered ? (
              <ShieldAlert className="size-7" aria-hidden="true" />
            ) : (
              <KeyRound className="size-7" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">
              Private Balance Demo
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              {isClockTampered
                ? 'Revisa la fecha del dispositivo'
                : isExpired
                  ? 'Licencia expirada'
                  : 'Activa este dispositivo'}
            </h1>
          </div>
        </div>

        {isClockTampered ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            La fecha del dispositivo parece haber sido modificada. Verifica la
            fecha y hora para continuar.
          </p>
        ) : isExpired ? (
          <p className="text-center text-sm leading-6 text-slate-600">
            Esta versión demo ha finalizado. Contacta al desarrollador para
            renovar tu acceso.
          </p>
        ) : (
          <p className="text-center text-sm leading-6 text-slate-600">
            Introduce un código de activación válido para utilizar la aplicación
            sin conexión.
          </p>
        )}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Código del dispositivo
          </p>
          <p className="mt-2 break-all font-mono text-lg font-bold tracking-wider text-slate-950">
            {deviceCode}
          </p>
          <button
            className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            disabled={deviceCode === 'Cargando...' || deviceCode === 'No disponible'}
            onClick={handleCopyDeviceCode}
            type="button"
          >
            <Copy className="size-4" aria-hidden="true" />
            Copiar código
          </button>
        </div>

        {isExpired && !showRenewalForm ? (
          <button
            className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={() => setShowRenewalForm(true)}
            type="button"
          >
            Ingresar nuevo código
          </button>
        ) : null}

        {showRenewalForm && !isClockTampered ? (
          <form className="flex flex-col gap-3" onSubmit={handleActivate}>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Código de activación
              </span>
              <input
                autoCapitalize="off"
                autoComplete="off"
                className="h-12 rounded-md border border-slate-300 bg-white px-3 font-mono text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => handleActivationCodeChange(event.target.value)}
                placeholder="PB-LIC-V2.payload.firma"
                required
                spellCheck={false}
                value={activationCode}
              />
            </label>
            <button
              className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isActivating || activationCode.trim().length === 0}
              type="submit"
            >
              {isActivating ? 'Activando...' : 'Activar'}
            </button>
          </form>
        ) : null}

        {isClockTampered ? (
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={() => onRetry?.()}
            type="button"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Volver a comprobar
          </button>
        ) : null}

        <p className="min-h-5 text-center text-sm font-medium text-red-700" role="alert">
          {error}
        </p>
        {statusMessage ? (
          <p className="text-center text-sm font-medium text-emerald-700" role="status">
            {statusMessage}
          </p>
        ) : null}
      </section>
    </main>
  )
}

export default LicenseActivationPage
