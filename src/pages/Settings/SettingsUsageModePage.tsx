import { BriefcaseBusiness, Check, House, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { useDialog } from '../../components/dialogs/useDialog'
import {
  activateHybridMode,
  deactivateUsageSpace,
  getSettings,
} from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'
import type { ActiveContext } from '../../types/settings'
import { resolveUsageMode } from '../../utils/usageMode'

type ActivationStatus = 'idle' | 'activating' | `deactivating-${ActiveContext}` | 'error'

export function SettingsUsageModePage() {
  const { confirm, alert } = useDialog()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [status, setStatus] = useState<ActivationStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    getSettings().then((currentSettings) => {
      if (isMounted) setSettings(currentSettings)
    })

    return () => {
      isMounted = false
    }
  }, [])

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  const configuredMode = resolveUsageMode(settings)

  async function handleActivateSecondSpace() {
    const secondSpace = configuredMode === 'basic' ? 'Profesional' : 'Personal'
    const confirmed = await confirm({
      title: `Activar espacio ${secondSpace.toLowerCase()}`,
      message: `Se habilitará el espacio ${secondSpace} sin trasladar, duplicar ni modificar los registros de tu espacio actual.`,
      confirmLabel: `Activar espacio ${secondSpace.toLowerCase()}`,
      confirmTone: 'primary',
    })

    if (!confirmed) return

    setStatus('activating')
    setErrorMessage('')

    try {
      const updatedSettings = await activateHybridMode()
      setSettings(updatedSettings)
      setStatus('idle')
      await alert({
        type: 'success',
        title: `Espacio ${secondSpace} activado`,
        message: 'Ya puedes alternar entre Personal y Profesional desde el selector de la barra de navegación.',
      })
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : `No se pudo activar el espacio ${secondSpace}.`,
      )
    }
  }

  async function handleDeactivateSpace(space: ActiveContext, label: string) {
    const confirmed = await confirm({
      title: `Desactivar espacio ${label.toLowerCase()}`,
      message: `El espacio ${label} dejará de estar visible, pero todos sus datos se conservarán. Podrás activarlo de nuevo más adelante.`,
      confirmLabel: `Desactivar espacio ${label.toLowerCase()}`,
      confirmTone: 'primary',
    })

    if (!confirmed) return

    setStatus(`deactivating-${space}`)
    setErrorMessage('')

    try {
      const updatedSettings = await deactivateUsageSpace(space)
      setSettings(updatedSettings)
      setStatus('idle')
      await alert({
        type: 'success',
        title: `Espacio ${label} desactivado`,
        message: 'Tus datos se han conservado y estarán disponibles cuando vuelvas a activar el espacio.',
      })
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : `No se pudo desactivar el espacio ${label}.`,
      )
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Configuración"
        title="Espacios de uso"
      />

      <p className="text-sm text-slate-500">
        Cada espacio mantiene sus datos y funciones por separado.
      </p>

      <div className="grid gap-4">
        {([
          { mode: 'basic' as const, label: 'Personal', icon: House, description: 'Gestiona tus finanzas personales.' },
          { mode: 'professional' as const, label: 'Profesional', icon: BriefcaseBusiness, description: 'Gestiona tu actividad profesional.' },
        ]).map(({ mode, label, icon: Icon, description }) => {
          const isEnabled = configuredMode === mode || configuredMode === 'hybrid'
          return (
            <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" key={mode}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold text-slate-950">{label}</h2>
                    {isEnabled && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Check className="size-4" aria-hidden="true" /> Activo
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{description}</p>
                  {!isEnabled && (
                    <button
                      className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                      disabled={status === 'activating'}
                      onClick={handleActivateSecondSpace}
                      type="button"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      {status === 'activating' ? 'Activando...' : `Activar espacio ${label.toLowerCase()}`}
                    </button>
                  )}
                  {configuredMode === 'hybrid' && (
                    <button
                      className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={status !== 'idle' && status !== 'error'}
                      onClick={() => handleDeactivateSpace(mode, label)}
                      type="button"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                      {status === `deactivating-${mode}`
                        ? 'Desactivando...'
                        : `Desactivar espacio ${label.toLowerCase()}`}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {configuredMode === 'hybrid' && (
        <p className="text-sm text-slate-500">
          Cambia entre Personal y Profesional desde el selector de la barra de navegación.
        </p>
      )}
      {errorMessage && (
        <p className="text-sm font-medium text-red-600" role="status">{errorMessage}</p>
      )}
    </section>
  )
}

export default SettingsUsageModePage
