import {
  MessagesSquare,
  ChartNoAxesCombined,
  ChevronRight,
  DatabaseBackup,
  Lightbulb,
  Settings,
  CalendarRange,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { getSettings } from '../../services/settingsService'
import type { UsageMode } from '../../types/settings'

const moreLinks = [
  {
    description: 'Envia mensajes y recibe respuestas usando AIConversationService.',
    href: '/conversation',
    icon: MessagesSquare,
    label: 'Conversacion AI (Preview)',
  },
  {
    description: 'Crea, finaliza y consulta ciclos de actividad y sus estadísticas.',
    href: '/temporadas',
    icon: CalendarRange,
    label: 'Temporadas',
  },
  {
    description: 'Consulta, filtra, exporta y comparte la información financiera.',
    href: '/reports',
    icon: ChartNoAxesCombined,
    label: 'Reportes y exportaciones',
  },
  {
    description: 'Visualiza insights proyectados desde el motor con estado seguro.',
    href: '/dashboard',
    icon: Lightbulb,
    label: 'Dashboard de insights',
  },
  {
    description: 'Administra negocio, monedas, seguridad y preferencias.',
    href: '/settings',
    icon: Settings,
    label: 'Configuración',
  },
  {
    description: 'Exporta, importa y protege una copia de todos tus datos.',
    href: '/settings/backup',
    icon: DatabaseBackup,
    label: 'Backup',
  },
]

export function MorePage() {
  const [usageMode, setUsageMode] = useState<UsageMode>('professional')

  useEffect(() => {
    getSettings().then((settings) => setUsageMode(settings.usageMode))

    function handleSettingsChanged(event: Event) {
      setUsageMode(
        (event as CustomEvent<{ usageMode: UsageMode }>).detail.usageMode,
      )
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [])

  const visibleLinks =
    usageMode === 'basic'
      ? moreLinks.filter((link) => link.href !== '/temporadas' && link.href !== '/dashboard')
      : moreLinks

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Más"
        title="Otras opciones"
      />

      <div className="grid gap-3">
        {visibleLinks.map(({ description, href, icon: Icon, label }) => (
          <Link
            className="flex min-h-20 items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40"
            key={href}
            to={href}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-950">{label}</span>
                <span className="mt-1 block text-sm leading-5 text-slate-500">
                  {description}
                </span>
              </span>
            </div>
            <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  )
}

export default MorePage
