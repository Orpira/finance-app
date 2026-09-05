import {
  BadgeCheck,
  Bell,
  Building2,
  ChevronRight,
  Layers,
  Stethoscope,
  LockKeyhole,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'
import { resolveActiveUsageMode } from '../../utils/usageMode'

const settingsLinks = [
  {
    description: 'Nombre, ubicación, monedas, porcentaje y tasas.',
    href: '/settings/business',
    icon: Building2,
    label: 'Datos generales',
  },
  {
    description: 'Consulta o actualiza la licencia segura del dispositivo.',
    href: '/settings/license',
    icon: BadgeCheck,
    label: 'Licencia',
    },
  {
    description: 'Gestiona por separado las categorías de ingresos y egresos personales.',
    href: '/settings/categories',
    icon: Layers,
    label: 'Categorías',
    // Personal-only feature: never surfaced while the active context is Profesional.
    restrictToUsageMode: 'basic' as const,
  },
  {
    description: 'Activar, cambiar o desactivar el PIN de acceso.',
    href: '/settings/security',
    icon: LockKeyhole,
    label: 'Seguridad',
  },
  {
    description: 'Comprueba el estado local y genera un archivo seguro para soporte.',
    href: '/settings/diagnostics',
    icon: Stethoscope,
    label: 'Diagnóstico local',
  },
  {
    description: 'Activa o desactiva los avisos proactivos del Copiloto y el horario silencioso.',
    href: '/settings/notifications',
    icon: Bell,
    label: 'Notificaciones',
  },
  {
    description: 'Activa el uso Híbrido o consulta tus espacios Personal y Profesional.',
    href: '/settings/usage-mode',
    icon: Layers,
    label: 'Espacios de uso',
  },
]

export function SettingsPage() {
  const [usageMode, setUsageMode] = useState<'basic' | 'professional'>('professional')

  useEffect(() => {
    getSettings().then((settings) => setUsageMode(resolveActiveUsageMode(settings)))
    function handleSettingsChanged(event: Event) {
      setUsageMode(
        resolveActiveUsageMode((event as CustomEvent<AppSettings>).detail),
      )
    }
    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)
    return () =>
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
  }, [])

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel={usageMode === 'basic' ? 'Inicio' : 'Más'}
        backTo={usageMode === 'basic' ? '/' : '/more'}
        eyebrow="Configuración"
        title="Opciones de la aplicación"
      />

      <div className="grid gap-3">
        {settingsLinks
          .filter((settingsLink) =>
            settingsLink.restrictToUsageMode === undefined ||
            settingsLink.restrictToUsageMode === usageMode,
          )
          .map((settingsLink) => {
            const Icon = settingsLink.icon

            return (
              <Link
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
                key={settingsLink.href}
                to={settingsLink.href}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-slate-950">
                      {settingsLink.label}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {settingsLink.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-slate-400" />
              </Link>
            )
          })}
      </div>
    </section>
  )
}

export default SettingsPage
