import {
  ArrowLeftRight,
  CalendarDays,
  ChartNoAxesCombined,
  House,
  Moon,
  MoreHorizontal,
  Sparkles,
  Sun,
} from 'lucide-react'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { AppointmentReminderAlert } from '../components/AppointmentReminderAlert'
import { ServiceCompletionAlert } from '../components/ServiceCompletionAlert'
import { ServiceTimeAlert } from '../components/ServiceTimeAlert'
import {
  getDelayUntilNextDailyBackupCheck,
  runAutomaticDriveBackupIfNeeded,
} from '../services/backupService'
import { initializeAutomationOutbox } from '../services/automationOutboxService'
import { provisionDeviceIdentity } from '../services/deviceIdentityService'
import { migrateLegacyRecordsToSeasons } from '../services/earningPeriodService'
import { getCurrentLicense } from '../services/licenseService'
import { getRuntimeIntegrityStatus } from '../services/playIntegrityService'
import { initializeReminderNotifications } from '../services/reminderService'
import { applyTheme, getSettings, updateSettings } from '../services/settingsService'
import type { LicenseType } from '../types/license'
import type { ThemeMode, UsageMode } from '../types/settings'
import { usesProfessionalAgenda } from '../utils/usageMode'

interface NavItem {
  label: string
  path: string
  icon: typeof House
  onboardingTarget?: string
  hiddenForTrial?: boolean
}

const HOME_ITEM: NavItem = { label: 'Inicio', path: '/', icon: House }
const MOVEMENTS_ITEM: NavItem = {
  label: 'Movimientos',
  path: '/movements',
  icon: ArrowLeftRight,
  onboardingTarget: 'nav-movements',
}
const AGENDA_ITEM: NavItem = {
  label: 'Agenda',
  path: '/agenda',
  icon: CalendarDays,
  onboardingTarget: 'nav-agenda',
}
const REPORTS_ITEM: NavItem = {
  label: 'Reportes',
  path: '/reports',
  icon: ChartNoAxesCombined,
  onboardingTarget: 'nav-reports',
}
/** La licencia gratuita conserva el acceso al sandbox local del Copiloto. */
const ASSISTANT_ITEM: NavItem = {
  label: 'Copiloto',
  path: '/conversation',
  icon: Sparkles,
  onboardingTarget: 'nav-asistente',
  hiddenForTrial: true,
}
const MORE_ITEM: NavItem = { label: 'Más', path: '/more', icon: MoreHorizontal }

const navItems = [HOME_ITEM, MOVEMENTS_ITEM, AGENDA_ITEM, ASSISTANT_ITEM, MORE_ITEM]

const basicNavItems = [HOME_ITEM, MOVEMENTS_ITEM, REPORTS_ITEM, ASSISTANT_ITEM, MORE_ITEM]

let automaticBackupCheckStarted = false
let automaticBackupTimeoutId: number | null = null
let earningPeriodCheckStarted = false
let runtimeIntegrityCheckStarted = false
let automationOutboxStarted = false
let deviceProvisioningStarted = false

function runAutomaticBackupCheck() {
  runAutomaticDriveBackupIfNeeded().catch((error) => {
    console.warn('No se pudo ejecutar el backup automático.', error)
  })
}

function scheduleNextAutomaticBackupCheck() {
  if (automaticBackupTimeoutId !== null) {
    window.clearTimeout(automaticBackupTimeoutId)
  }

  automaticBackupTimeoutId = window.setTimeout(() => {
    runAutomaticBackupCheck()
    scheduleNextAutomaticBackupCheck()
  }, getDelayUntilNextDailyBackupCheck())
}

export function AppLayout() {
  const location = useLocation()
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [usageMode, setUsageMode] = useState<UsageMode>('professional')
  const [licenseType, setLicenseType] = useState<LicenseType | null>(null)
  const [isDarkTheme, setIsDarkTheme] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )
  const moreSectionPaths = usageMode === 'basic'
    ? ['/more', '/temporadas', '/currency-converter', '/settings', '/debug']
    : ['/more', '/temporadas', '/reports', '/currency-converter', '/settings', '/debug']
  const isMoreSection = moreSectionPaths.some(
    (path) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
  )

  useEffect(() => {
    let startedAutomaticBackupOnThisMount = false

    function syncLayoutSettings(settings: { theme: ThemeMode; usageMode: UsageMode }) {
      setTheme(settings.theme)
      setUsageMode(settings.usageMode)
      setIsDarkTheme(document.documentElement.classList.contains('dark'))
    }

    getCurrentLicense()
      .then((license) => setLicenseType(license?.licenseType ?? null))
      .catch((error) => {
        console.warn('No se pudo cargar el tipo de licencia.', error)
      })

    getSettings()
      .then((settings) => {
        syncLayoutSettings(settings)
        if (usesProfessionalAgenda(settings)) {
          initializeReminderNotifications().catch((error) => {
            console.warn('No se pudieron inicializar las alarmas nativas.', error)
          })
        }

        if (!deviceProvisioningStarted) {
          deviceProvisioningStarted = true
          provisionDeviceIdentity().catch((error) => {
            console.warn('No se pudo provisionar la identidad del dispositivo.', error)
          })
        }
      })
      .catch((error) => {
        console.warn('No se pudo cargar el tema.', error)
      })

    function handleSettingsChanged(event: Event) {
      syncLayoutSettings((event as CustomEvent<{ theme: ThemeMode; usageMode: UsageMode }>).detail)
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    if (!automaticBackupCheckStarted) {
      automaticBackupCheckStarted = true
      startedAutomaticBackupOnThisMount = true
      runAutomaticBackupCheck()
      scheduleNextAutomaticBackupCheck()
    }

    if (!earningPeriodCheckStarted) {
      earningPeriodCheckStarted = true

      migrateLegacyRecordsToSeasons().catch((error) => {
        console.warn('No se pudieron migrar las temporadas existentes.', error)
      })
    }

    if (!runtimeIntegrityCheckStarted) {
      runtimeIntegrityCheckStarted = true

      getRuntimeIntegrityStatus()
        .then((result) => {
          console.info('Modo de ejecución Private Balance', result)
        })
        .catch((error) => {
          console.warn('No se pudo comprobar el modo de ejecución.', error)
        })
    }

    if (!automationOutboxStarted) {
      automationOutboxStarted = true
      initializeAutomationOutbox()
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState !== 'hidden' &&
        document.visibilityState !== 'visible'
      ) {
        return
      }

      runAutomaticBackupCheck()
      scheduleNextAutomaticBackupCheck()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (startedAutomaticBackupOnThisMount) {
        automaticBackupCheckStarted = false

        if (automaticBackupTimeoutId !== null) {
          window.clearTimeout(automaticBackupTimeoutId)
          automaticBackupTimeoutId = null
        }
      }

      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)

    }
  }, [])

  async function toggleTheme() {
    const nextTheme: ThemeMode = isDarkTheme ? 'light' : 'dark'
    const previousTheme = theme

    applyTheme(nextTheme)
    setTheme(nextTheme)
    setIsDarkTheme(nextTheme === 'dark')

    try {
      const updatedSettings = await updateSettings({ theme: nextTheme })
      setTheme(updatedSettings.theme)
      setIsDarkTheme(document.documentElement.classList.contains('dark'))
    } catch (error) {
      console.warn('No se pudo cambiar el tema.', error)
      applyTheme(previousTheme)
      setTheme(previousTheme)
      setIsDarkTheme(document.documentElement.classList.contains('dark'))
    }
  }

  const ThemeIcon = isDarkTheme ? Sun : Moon
  const themeLabel = isDarkTheme ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
  const visibleNavItems = (usageMode === 'basic' ? basicNavItems : navItems).filter(
    (item) => !(item.hiddenForTrial && licenseType === 'trial'),
  )

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 md:block">
        <p className="px-3 text-lg font-semibold text-slate-950 dark:text-white">Private Balance</p>
        <div className="mb-6" />
        <nav aria-label="Navegación principal de escritorio">
          <ul className="grid gap-1">
            {visibleNavItems.map(({ label, path, icon: Icon, onboardingTarget }) => (
              <li key={path}>
                <NavLink
                  className={({ isActive }) => [
                    'flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors',
                    isActive || (path === '/more' && isMoreSection)
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900',
                  ].join(' ')}
                  data-onboarding-target={onboardingTarget}
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
        <div className="absolute bottom-5 left-8 right-5 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">
            {Capacitor.isNativePlatform() ? 'Aplicación Android' : 'Web / PWA'}
          </p>
          <div className="flex items-center gap-2">
            <button
              aria-label={themeLabel}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus:ring-offset-slate-950"
              onClick={toggleTheme}
              title={themeLabel}
              type="button"
            >
              <ThemeIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      <main
        className={[
          'mx-auto min-h-dvh w-full max-w-5xl px-4 pb-24 md:ml-64 md:w-[calc(100%-16rem)] md:pb-8',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-3 py-3 md:hidden">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Private Balance</p>
          <div className="flex items-center gap-2">
            <button
              aria-label={themeLabel}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={toggleTheme}
              title={themeLabel}
              type="button"
            >
              <ThemeIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <Outlet key={usageMode} />
      </main>

      {usesProfessionalAgenda({ usageMode }) && <AppointmentReminderAlert />}
      {usesProfessionalAgenda({ usageMode }) && <ServiceTimeAlert />}
      <ServiceCompletionAlert />

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 md:hidden"
      >
        <ul className="mx-auto grid max-w-5xl grid-cols-5 gap-0.5">
          {visibleNavItems.map(({ label, path, icon: Icon, onboardingTarget }) => (
            <li key={path}>
              <NavLink
                to={path}
                end={path === '/'}
                data-onboarding-target={onboardingTarget}
                className={({ isActive }) =>
                  [
                    'flex min-h-14 flex-col items-center justify-center rounded-md px-0 text-[0.65rem] font-medium leading-tight transition-colors',
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
