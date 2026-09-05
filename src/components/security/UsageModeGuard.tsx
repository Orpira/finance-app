import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'
import { resolveActiveUsageMode } from '../../utils/usageMode'

/**
 * `allowed` is checked against the *active* mode (`resolveActiveUsageMode`),
 * never the raw `settings.usageMode`: a Híbrido installation stores
 * `'hybrid'` in settings, but which routes are reachable depends on which
 * workspace (`activeContext`) the user currently has selected.
 */
export function UsageModeGuard({
  allowed,
  children,
}: {
  allowed: Array<'basic' | 'professional'>
  children: ReactNode
}) {
  const [activeUsageMode, setActiveUsageMode] = useState<
    'basic' | 'professional' | null
  >(null)

  useEffect(() => {
    getSettings().then((settings) => setActiveUsageMode(resolveActiveUsageMode(settings)))

    function handleSettingsChanged(event: Event) {
      setActiveUsageMode(
        resolveActiveUsageMode((event as CustomEvent<AppSettings>).detail),
      )
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [])

  if (!activeUsageMode) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">
        Cargando...
      </section>
    )
  }

  if (!allowed.includes(activeUsageMode)) {
    return <Navigate replace to="/" />
  }

  return children
}
