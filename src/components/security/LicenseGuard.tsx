import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'

import { PinGate } from '../PinGate'
import { exportBackup } from '../../services/backupService'
import { refreshDeviceAccess } from '../../services/deviceAccessService'
import LicenseActivationPage from '../../pages/License/LicenseActivationPage'
import { getOrCreateDeviceIdentity } from '../../services/deviceIdentityService'
import {
  getLicenseStatus,
  type LicenseAccessStatus,
} from '../../services/licenseService'
import { deriveTrialState, runTrialFlow } from '../../services/trialFlow'
import { attemptFreeTrial } from '../../services/trialService'

interface LicenseGuardProps {
  children: ReactNode
}

type GuardStatus = LicenseAccessStatus | 'loading' | 'error' | 'denied' | 'offline-expired'

export function LicenseGuard({ children }: LicenseGuardProps) {
  const [status, setStatus] = useState<GuardStatus>('loading')

  const checking = useRef(false)
  const [backupMessage, setBackupMessage] = useState('')

  const refreshLicense = useCallback(async () => {
    if (checking.current) return
    checking.current = true
    try {
      const identity = await getOrCreateDeviceIdentity()
      let result = await getLicenseStatus()

      // Instalación nueva sin ninguna licencia local: intentar un trial de
      // 7 días de forma silenciosa, sin mostrar nada al usuario. Si el
      // dispositivo ya tiene un trial vigente, el servidor lo REACTIVA
      // (nunca un 409 en bucle); solo un trial ya expirado o un reloj
      // manipulado terminan mostrando pantalla. Reintentos acotados: nunca
      // más de 2 llamadas por refresh, nunca bucle silencioso.
      if (deriveTrialState(result) === 'eligible') {
        const trialResult = await runTrialFlow(() => attemptFreeTrial(identity))
        console.info('[trial] resultado del auto-inicio', trialResult)

        if (trialResult.state === 'trial-active') {
          result = await getLicenseStatus()
        } else if (trialResult.state === 'trial-expired') {
          setStatus('expired')
          return
        } else if (trialResult.state === 'clock-tampered') {
          setStatus('clock-tampered')
          return
        } else {
          setStatus('error')
          return
        }
      }

      if (result.status === 'active' && result.license) {
        const access = await refreshDeviceAccess(result.license, identity)
        if (access !== 'allowed') {
          setStatus(access)
          return
        }
      }
      setStatus(result.status)
    } catch {
      setStatus('error')
    } finally {
      checking.current = false
    }
  }, [])

  useEffect(() => {
    const initialCheckId = window.setTimeout(refreshLicense, 0)

    const intervalId = window.setInterval(refreshLicense, 60_000)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshLicense()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', refreshLicense)

    return () => {
      window.clearTimeout(initialCheckId)
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', refreshLicense)
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

  if (status === 'denied' || status === 'offline-expired') {
    return (
      <PinGate>
        <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-xl">
            <h1 className="text-xl font-semibold text-slate-950">
              {status === 'denied' ? 'Acceso del dispositivo suspendido' : 'Conéctate para renovar el acceso'}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Puedes guardar un respaldo local de tus datos y volver a comprobar el permiso.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" type="button" onClick={refreshLicense}>
                Reintentar
              </button>
              <button
                className="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-950"
                type="button"
                onClick={async () => {
                  try {
                    await exportBackup()
                    setBackupMessage('Respaldo exportado.')
                  } catch {
                    setBackupMessage('No se pudo exportar el respaldo.')
                  }
                }}
              >
                Exportar respaldo
              </button>
            </div>
            <p aria-live="polite" className="mt-2 text-sm text-slate-600">{backupMessage}</p>
          </div>
        </main>
      </PinGate>
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
