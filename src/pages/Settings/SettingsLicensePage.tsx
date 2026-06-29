import { BadgeCheck, Copy, KeyRound, ShieldCheck } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { clearAutomationAuthorization } from '../../services/automationHubService'
import { scheduleAutomationOutboxFlush } from '../../services/automationOutboxService'
import {
  getDeviceCode,
  getLicenseStatus,
} from '../../services/licenseService'
import {
  activateSignedLicense,
  verifySignedLicense,
} from '../../services/signedLicenseService'
import type { AppLicense, LicenseType } from '../../types/license'
import { copyText } from '../../utils/clipboard'

const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  demo: 'Demo',
  monthly: 'Mensual',
  annual: 'Anual',
  lifetime: 'Vitalicia',
}

type UpdateStatus = 'idle' | 'validating' | 'saving' | 'saved' | 'error'

function formatExpirationDate(expirationDate?: string) {
  if (!expirationDate) {
    return 'Sin vencimiento'
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
  }).format(new Date(expirationDate))
}

export function SettingsLicensePage() {
  const [license, setLicense] = useState<AppLicense | null>(null)
  const [deviceCode, setDeviceCode] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [loading, setLoading] = useState(true)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true

    Promise.all([getDeviceCode(), getLicenseStatus()])
      .then(([currentDeviceCode, result]) => {
        if (!mounted) return
        setDeviceCode(currentDeviceCode)
        setLicense(result.license ?? null)
      })
      .catch(() => {
        if (!mounted) return
        setUpdateStatus('error')
        setMessage('No se pudo consultar la licencia de este dispositivo.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  async function handleCopyDeviceCode() {
    try {
      await copyText(deviceCode)
      setUpdateStatus('idle')
      setMessage('Código del dispositivo copiado.')
    } catch {
      setUpdateStatus('error')
      setMessage('No se pudo copiar el código del dispositivo.')
    }
  }

  async function handleUpdateLicense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalizedCode = activationCode.trim().replace(/\s+/g, '')

    if (!normalizedCode.startsWith('PB-LIC-V2.')) {
      setUpdateStatus('error')
      setMessage('Introduce una licencia firmada que comience por PB-LIC-V2.')
      return
    }

    setUpdateStatus('validating')
    setMessage('Validando firma y dispositivo...')

    try {
      const validation = await verifySignedLicense(normalizedCode, deviceCode)
      const action = license?.licenseVersion === 2 ? 'reemplazar' : 'actualizar'
      const confirmed = window.confirm(
        `Se va a ${action} la licencia actual por una licencia V2 ${LICENSE_TYPE_LABELS[validation.licenseType].toLowerCase()}.\n\nLos ingresos, egresos, citas, temporadas y configuraciones no se modificarán. ¿Deseas continuar?`,
      )

      if (!confirmed) {
        setUpdateStatus('idle')
        setMessage('Actualización cancelada. La licencia actual no cambió.')
        return
      }

      setUpdateStatus('saving')
      setMessage('Guardando licencia segura...')
      const updatedLicense = await activateSignedLicense(normalizedCode)

      clearAutomationAuthorization()
      scheduleAutomationOutboxFlush()
      setLicense(updatedLicense)
      setActivationCode('')
      setUpdateStatus('saved')
      setMessage(
        'Licencia V2 activada. Tus datos financieros permanecen intactos y Automation Hub ya puede autorizar este dispositivo.',
      )
    } catch (error) {
      setUpdateStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'No se pudo actualizar la licencia.',
      )
    }
  }

  if (loading) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">
          Consultando licencia...
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Seguridad"
        title="Licencia"
      />

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <BadgeCheck className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">
              Licencia actual
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {license
                ? `${LICENSE_TYPE_LABELS[license.licenseType]} · Versión ${license.licenseVersion}`
                : 'No disponible'}
            </p>
          </div>
        </div>

        {license && (
          <dl className="mt-5 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">
                Estado
              </dt>
              <dd className="mt-1 font-semibold text-emerald-700">Activa</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">
                Vencimiento
              </dt>
              <dd className="mt-1 font-medium text-slate-800">
                {formatExpirationDate(license.expirationDate)}
              </dd>
            </div>
          </dl>
        )}

        {license?.licenseVersion === 1 && (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            Esta licencia V1 permite usar la aplicación, pero no puede
            autenticarse en Automation Hub. Actualízala a una licencia firmada
            V2 para habilitar canales de comunicación y automatizaciones.
          </p>
        )}
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">
              Código del dispositivo
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              La licencia V2 debe generarse específicamente para este código.
            </p>
          </div>
        </div>
        <p className="mt-4 break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-base font-bold tracking-wider text-slate-950">
          {deviceCode}
        </p>
        <button
          className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          disabled={!deviceCode}
          onClick={handleCopyDeviceCode}
          type="button"
        >
          <Copy className="size-4" aria-hidden="true" />
          Copiar código
        </button>
      </article>

      <form
        className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        onSubmit={handleUpdateLicense}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">
              {license?.licenseVersion === 1
                ? 'Actualizar a licencia V2'
                : 'Reemplazar licencia V2'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Solo se reemplaza la activación. Ningún registro financiero forma
              parte de esta operación.
            </p>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">
            Código de licencia firmado
          </span>
          <textarea
            autoCapitalize="off"
            autoComplete="off"
            className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => {
              setActivationCode(event.target.value)
              setUpdateStatus('idle')
              setMessage('')
            }}
            placeholder="PB-LIC-V2.payload.firma"
            required
            spellCheck={false}
            value={activationCode}
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p
            className={[
              'text-sm font-medium',
              updateStatus === 'error'
                ? 'text-red-700'
                : updateStatus === 'saved'
                  ? 'text-emerald-700'
                  : 'text-slate-500',
            ].join(' ')}
            role={updateStatus === 'error' ? 'alert' : 'status'}
          >
            {message}
          </p>
          <button
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              !deviceCode ||
              activationCode.trim().length === 0 ||
              updateStatus === 'validating' ||
              updateStatus === 'saving'
            }
            type="submit"
          >
            <ShieldCheck className="size-4" aria-hidden="true" />
            {updateStatus === 'validating'
              ? 'Validando'
              : updateStatus === 'saving'
                ? 'Actualizando'
                : 'Actualizar licencia'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default SettingsLicensePage
