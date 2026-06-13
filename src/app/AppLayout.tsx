import {
  ArrowLeft,
  CalendarDays,
  ChartNoAxesCombined,
  CircleDollarSign,
  LayoutDashboard,
  ReceiptText,
  Settings,
} from 'lucide-react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import { AppointmentReminderAlert } from '../components/AppointmentReminderAlert'
import { ServiceTimeAlert } from '../components/ServiceTimeAlert'

const navItems = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ingresos',
    path: '/income',
    icon: CircleDollarSign,
  },
  {
    label: 'Gastos',
    path: '/expenses',
    icon: ReceiptText,
  },
  {
    label: 'Agenda',
    path: '/agenda',
    icon: CalendarDays,
  },
  {
    label: 'Reportes',
    path: '/reports',
    icon: ChartNoAxesCombined,
  },
  {
    label: 'Configuración',
    path: '/settings',
    icon: Settings,
  },
]

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }

    navigate('/')
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-24 pt-4">
        {!isHome && (
          <div className="mb-4 flex items-center">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              onClick={handleBack}
              type="button"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Volver
            </button>
          </div>
        )}
        <Outlet />
      </main>

      <AppointmentReminderAlert />
      <ServiceTimeAlert />

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
      >
        <ul className="mx-auto grid max-w-5xl grid-cols-6 gap-1">
          {navItems.map(({ label, path, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-[0.65rem] font-medium leading-tight transition-colors',
                    isActive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100',
                  ].join(' ')
                }
              >
                <Icon className="mb-1 size-5" aria-hidden="true" />
                <span className="max-w-full truncate">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export default AppLayout
