import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

import { getSettings } from '../../services/settingsService'
import type { UsageMode } from '../../types/settings'

export function UsageModeGuard({
  allowed,
  children,
}: {
  allowed: UsageMode[]
  children: ReactNode
}) {
  const [usageMode, setUsageMode] = useState<UsageMode | null>(null)

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

  if (!usageMode) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center text-sm text-slate-500">
        Cargando...
      </section>
    )
  }

  if (!allowed.includes(usageMode)) {
    return <Navigate replace to="/" />
  }

  return children
}
