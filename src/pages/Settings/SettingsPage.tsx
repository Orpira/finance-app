import { Building2, ChevronRight, LockKeyhole } from 'lucide-react'
import { Link } from 'react-router-dom'

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
]

export function SettingsPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-emerald-700">Configuración</p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Opciones de la aplicación
        </h1>
      </header>

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
