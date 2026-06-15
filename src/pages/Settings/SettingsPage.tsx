import { Building2, ChevronRight, DatabaseBackup, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'

const settingsLinks = [
  {
    description: 'Nombre del negocio, ciudad, monedas, porcentaje, tasas y tema.',
    href: '/settings/business',
    icon: Building2,
    label: 'Negocio y moneda',
  },
  {
    description: 'Activar, cambiar o desactivar el PIN de acceso.',
    href: '/settings/security',
    icon: LockKeyhole,
    label: 'Seguridad',
  },
  {
    description: 'Exportar o importar un respaldo local de tus datos.',
    href: '/settings/backup',
    icon: DatabaseBackup,
    label: 'Backup',
  },
]

export function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Configuración"
        title="Opciones de la aplicación"
      />

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
