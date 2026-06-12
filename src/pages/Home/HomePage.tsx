import {
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  LayoutDashboard,
  ReceiptText,
  Settings,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import privateBalanceLogo from '../../assets/private-balance-logo.svg'
import { getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'

const mainActions = [
  {
    label: 'Dashboard',
    title: 'Control general de tu actividad',
    description:
      'Visualiza ingresos, gastos, ganancias y estadísticas clave de forma rápida.',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ingresos',
    title: 'Registro de servicios realizados',
    description:
      'Guarda cada servicio, calcula automáticamente tu ganancia real y convierte valores entre monedas.',
    path: '/income',
    icon: CircleDollarSign,
  },
  {
    label: 'Gastos',
    title: 'Control de egresos',
    description:
      'Registra gastos operativos y realiza seguimiento detallado de tus costos diarios.',
    path: '/expenses',
    icon: ReceiptText,
  },
  {
    label: 'Agenda',
    title: 'Planificación de citas',
    description:
      'Organiza tus compromisos, programa citas y conviértelas fácilmente en servicios completados.',
    path: '/agenda',
    icon: CalendarDays,
  },
  {
    label: 'Reportes',
    title: 'Análisis y exportación',
    description:
      'Genera reportes en PDF o Excel y comparte resúmenes de tu actividad cuando lo necesites.',
    path: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Configuración',
    title: 'Preferencias y seguridad',
    description:
      'Administra moneda base, tasas de cambio, PIN de acceso, tema visual y opciones de respaldo.',
    path: '/settings',
    icon: Settings,
  },
]

export function HomePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    let isMounted = true

    getSettings().then((currentSettings) => {
      if (isMounted) {
        setSettings(currentSettings)
      }
    })

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="mx-auto flex min-h-[calc(100dvh-7rem)] w-full max-w-4xl flex-col justify-center gap-8">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        <img
          alt="Private Balance"
          className="h-44 w-44 shrink-0 object-contain sm:h-52 sm:w-52"
          src={privateBalanceLogo}
        />
        <div className="flex max-w-2xl flex-col gap-2">
          <p className="text-sm font-medium text-emerald-700">
            {settings?.businessName
              ? `Bienvenida · ${settings.businessName}`
              : 'Bienvenida'}
          </p>
          <h1 className="text-3xl font-semibold text-slate-950">
            Tu espacio privado de organización
          </h1>
          <p className="text-sm leading-6 text-slate-500">
            Lleva el control de tu actividad diaria, tus finanzas y tu agenda de
            forma sencilla, segura y totalmente privada.
          </p>
        </div>
      </header>

      <nav aria-label="Accesos principales">
        <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mainActions.map(({ label, title, description, path, icon: Icon }) => (
            <li className="h-full" key={path}>
              <Link
                className="flex h-full min-h-44 items-start gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
                to={path}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-lg font-semibold text-slate-950">
                    {label}
                  </span>
                  <span className="text-sm font-semibold text-slate-700">
                    {title}
                  </span>
                  <span className="text-sm leading-5 text-slate-500">
                    {description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  )
}

export default HomePage
