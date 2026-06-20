import { type ReactNode, useCallback, useEffect, useState } from 'react'

import LicenseActivationPage from '../../pages/License/LicenseActivationPage'
import {
  getLicenseStatus,
  type LicenseAccessStatus,
} from '../../services/licenseService'

interface LicenseGuardProps {
  children: ReactNode
}

type GuardStatus = LicenseAccessStatus | 'loading' | 'error'

export function LicenseGuard({ children }: LicenseGuardProps) {
  const [status, setStatus] = useState<GuardStatus>('loading')

  const refreshLicense = useCallback(async () => {
    try {
      const result = await getLicenseStatus()
      setStatus(result.status)
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    const initialCheckId = window.setTimeout(refreshLicense, 0)

    const intervalId = window.setInterval(refreshLicense, 60_000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshLicense()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(initialCheckId)
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshLicense])

  if (status === 'active') {
    return children
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-sm font-medium text-slate-300">
        Comprobando licencia...
      </div>
    )
  }

  if (status === 'expired') {
    return (
      <LicenseActivationPage mode="expired" onActivated={refreshLicense} />
    )
  }

  if (status === 'clock-tampered') {
    return (
      <LicenseActivationPage
        mode="clock-tampered"
        onRetry={refreshLicense}
      />
    )
  }

  if (status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-slate-950">
            No se pudo comprobar la licencia
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Inténtalo de nuevo. Tus datos locales no se han modificado.
          </p>
          <button
            className="mt-5 h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white"
            onClick={refreshLicense}
            type="button"
          >
            Reintentar
          </button>
        </div>
      </main>
    )
  }

  return <LicenseActivationPage onActivated={refreshLicense} />
}
