import {
  BadgeCheck,
  Building2,
  ChevronRight,
  LockKeyhole,
  MessagesSquare,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { UsageModeBadge } from '../../components/UsageModeBadge'
import { getSettings } from '../../services/settingsService'
import type { UsageMode } from '../../types/settings'

const settingsLinks = [
  {
    description: 'Consulta o actualiza la licencia segura del dispositivo.',
    href: '/settings/license',
    icon: BadgeCheck,
    label: 'Licencia',
  },
  {
    description: 'Conecta WhatsApp y elige qué notificaciones enviar.',
    href: '/settings/communication-channels',
    icon: MessagesSquare,
    label: 'Canales de comunicación',
  },
  {
    description: 'Modo de uso, nombre, ubicación, monedas, porcentaje y tasas.',
    href: '/settings/business',
    icon: Building2,
    label: 'Datos generales',
  },
  {
    description: 'Activar, cambiar o desactivar el PIN de acceso.',
    href: '/settings/security',
    icon: LockKeyhole,
    label: 'Seguridad',
  },
]

export function SettingsPage() {
  const [usageMode, setUsageMode] = useState<UsageMode>('professional')

  useEffect(() => {
    getSettings().then((settings) => setUsageMode(settings.usageMode))
    function handleSettingsChanged(event: Event) {
      setUsageMode(
        (event as CustomEvent<{ usageMode: UsageMode }>).detail.usageMode,
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
      >
        <UsageModeBadge usageMode={usageMode} />
      </PageHeader>

      <div className="grid gap-3">
        {settingsLinks.map((settingsLink) => {
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
