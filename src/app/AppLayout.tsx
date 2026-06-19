import {
  CalendarDays,
  CircleDollarSign,
  LayoutDashboard,
  MoreHorizontal,
  ReceiptText,
} from 'lucide-react'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { AppointmentReminderAlert } from '../components/AppointmentReminderAlert'
import { ServiceTimeAlert } from '../components/ServiceTimeAlert'
import { runAutomaticDriveBackupIfNeeded } from '../services/backupService'
import { generateDueCutoffReports } from '../services/cutoffReportService'
import { ensureActiveEarningPeriod } from '../services/earningPeriodService'

const navItems = [
  {
    label: 'Inicio',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Ingresos',
    path: '/income',
    icon: CircleDollarSign,
  },
  {
    label: 'Egresos',
    path: '/expenses',
    icon: ReceiptText,
  },
  {
    label: 'Agenda',
    path: '/agenda',
    icon: CalendarDays,
  },
  {
    label: 'Más',
    path: '/more',
    icon: MoreHorizontal,
  },
]

let automaticBackupCheckStarted = false
let automaticCutoffCheckStarted = false
let earningPeriodCheckStarted = false

export function AppLayout() {
  const location = useLocation()
  const isMoreSection = ['/more', '/reports', '/settings', '/debug'].some(
    (path) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
  )

  useEffect(() => {
    if (!automaticBackupCheckStarted) {
      automaticBackupCheckStarted = true

      runAutomaticDriveBackupIfNeeded().catch((error) => {
        console.warn('No se pudo ejecutar el backup automático.', error)
      })
    }

    if (!automaticCutoffCheckStarted) {
      automaticCutoffCheckStarted = true

      generateDueCutoffReports().catch((error) => {
        console.warn('No se pudieron generar los cortes automáticos.', error)
      })
    }

    if (!earningPeriodCheckStarted) {
      earningPeriodCheckStarted = true

      ensureActiveEarningPeriod().catch((error) => {
        console.warn('No se pudo inicializar el período de ganancia.', error)
      })
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'hidden') {
        return
      }

      runAutomaticDriveBackupIfNeeded().catch((error) => {
        console.warn('No se pudo ejecutar el backup automático.', error)
      })
      generateDueCutoffReports().catch((error) => {
        console.warn('No se pudieron generar los cortes automáticos.', error)
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-24">
        <Outlet />
      </main>

      <AppointmentReminderAlert />
      <ServiceTimeAlert />

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
      >
        <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-1">
          {navItems.map(({ label, path, icon: Icon }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === '/'}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-[0.65rem] font-medium leading-tight transition-colors',
                    isActive || (path === '/more' && isMoreSection)
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
