import { BriefcaseBusiness, House, Layers } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { useDialog } from '../../components/dialogs/useDialog'
import { activateHybridMode, getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'
import { resolveUsageMode } from '../../utils/usageMode'

type ActivationStatus = 'idle' | 'activating' | 'error'

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

  async function handleActivateHybrid() {
    const confirmed = await confirm({
      title: 'Activar uso Híbrido',
      message: 'Esta acción habilitará los espacios Personal y Profesional. No trasladará, duplicará ni modificará tus registros actuales.',
      confirmLabel: 'Activar uso Híbrido',
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
        title: 'Uso Híbrido activado',
        message: 'Ya puedes alternar entre Personal y Profesional desde el selector de la barra de navegación.',
      })
    } catch (error) {
      setStatus('error')
      setErrorMessage(
        error instanceof Error ? error.message : 'No se pudo activar el uso Híbrido.',
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

      {configuredMode === 'hybrid' ? (
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Layers className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">Uso Híbrido activo</h2>
            <p className="mt-1 text-sm text-slate-500">
              Tienes los espacios Personal y Profesional habilitados. Cambia entre ellos con el
              selector de la barra de navegación. Por ahora no es posible desactivar el uso
              Híbrido desde aquí.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
              {configuredMode === 'basic' ? (
                <House className="size-5" aria-hidden="true" />
              ) : (
                <BriefcaseBusiness className="size-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="font-semibold text-slate-950">
                Actualmente usas el espacio {configuredMode === 'basic' ? 'Personal' : 'Profesional'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {configuredMode === 'basic'
                  ? 'Activa también el espacio Profesional y cambia entre ambos sin reinstalar. Tus datos personales permanecerán intactos y el espacio Profesional comenzará vacío.'
                  : 'Activa también el espacio Personal y cambia entre ambos sin reinstalar. Tus datos profesionales permanecerán intactos y el espacio Personal comenzará vacío.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={status === 'activating'}
              onClick={handleActivateHybrid}
              type="button"
            >
              <Layers className="size-4" aria-hidden="true" />
              {status === 'activating' ? 'Activando...' : 'Activar uso Híbrido'}
            </button>
            {errorMessage && (
              <p className="text-sm font-medium text-red-600" role="status">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

export default SettingsUsageModePage
