import {
  CalendarDays,
  CircleDollarSign,
  House,
  MoreHorizontal,
  ReceiptText,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { AppointmentReminderAlert } from '../components/AppointmentReminderAlert'
import { ServiceTimeAlert } from '../components/ServiceTimeAlert'
import { runAutomaticDriveBackupIfNeeded } from '../services/backupService'
import { generateDueCutoffReports } from '../services/cutoffReportService'
import { migrateLegacyRecordsToSeasons } from '../services/earningPeriodService'
import { initializeReminderNotifications } from '../services/reminderService'

const navItems = [
  {
    label: 'Inicio',
    path: '/',
    icon: House,
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
  const isMoreSection = ['/more', '/temporadas', '/reports', '/settings', '/debug'].some(
    (path) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
  )

  useEffect(() => {
    initializeReminderNotifications().catch((error) => {
      console.warn('No se pudieron inicializar las alarmas nativas.', error)
    })
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

      migrateLegacyRecordsToSeasons().catch((error) => {
        console.warn('No se pudieron migrar las temporadas existentes.', error)
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 md:block">
        <p className="px-3 text-lg font-semibold text-slate-950 dark:text-white">Private Balance</p>
        <p className="mb-6 mt-1 px-3 text-xs font-medium uppercase tracking-widest text-emerald-700">Finanzas privadas</p>
        <nav aria-label="Navegación principal de escritorio">
          <ul className="grid gap-1">
            {navItems.map(({ label, path, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  className={({ isActive }) => [
                    'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
                    isActive || (path === '/more' && isMoreSection)
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                  ].join(' ')}
                  end={path === '/'}
                  to={path}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <p className="absolute bottom-5 left-8 text-xs text-slate-400">
          {Capacitor.isNativePlatform() ? 'Aplicación Android' : 'Web / PWA'}
        </p>
      </aside>

      <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-24 md:ml-64 md:pb-8">
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
