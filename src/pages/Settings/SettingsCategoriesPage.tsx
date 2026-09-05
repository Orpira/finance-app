import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Layers } from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'

const categorySections = [
  {
    description: 'Crea, renombra, archiva y reactiva categorías para clasificar tus ingresos personales.',
    href: '/settings/personal-income-categories',
    icon: ArrowUpFromLine,
    label: 'Ingresos personales',
  },
  {
    description: 'Crea, renombra, archiva y reactiva categorías para clasificar tus egresos personales.',
    href: '/settings/personal-expense-categories',
    icon: ArrowDownToLine,
    label: 'Egresos personales',
  },
]

export function SettingsCategoriesPage() {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Personal"
        title="Categorías"
      />

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
            <Layers className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950">Clasificación personal</h2>
            <p className="text-sm text-slate-500">
              Los catálogos de ingresos y egresos se gestionan por separado.
            </p>
          </div>
        </div>

        <div className="grid gap-3">
          {categorySections.map((section) => {
            const Icon = section.icon

            return (
              <Link
                className="flex items-center justify-between gap-4 rounded-md border border-slate-200 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/40"
                key={section.href}
                to={section.href}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-950">{section.label}</h3>
                    <p className="mt-1 text-sm text-slate-500">{section.description}</p>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default SettingsCategoriesPage
