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

const moreSections = [
  {
    title: 'Negocio',
    links: [
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
        label: 'Reportes',
      },
    ],
  },
  {
    title: 'Inteligencia',
    links: [
      {
        description: 'Visualiza insights proyectados desde el motor con estado seguro.',
        href: '/dashboard',
        icon: Lightbulb,
        label: 'Análisis inteligente',
      },
      {
        description: 'Envía mensajes y recibe respuestas del asistente en fase preliminar.',
        href: '/conversation',
        icon: MessagesSquare,
        label: 'Asistente IA',
      },
    ],
  },
  {
    title: 'Configuración',
    links: [
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
        label: 'Copia de seguridad',
      },
    ],
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

  const visibleSections = moreSections
    .map((section) => ({
      ...section,
      links:
        usageMode === 'basic'
          ? section.links.filter((link) => link.href !== '/temporadas' && link.href !== '/dashboard')
          : section.links,
    }))
    .filter((section) => section.links.length > 0)

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Más"
        title="Otras opciones"
      />

      <div className="flex flex-col gap-6">
        {visibleSections.map((section) => (
          <div className="flex flex-col gap-3" key={section.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </h2>
            <div className="grid gap-3">
              {section.links.map(({ description, href, icon: Icon, label }) => (
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
          </div>
        ))}
      </div>
    </section>
  )
}

export default MorePage
