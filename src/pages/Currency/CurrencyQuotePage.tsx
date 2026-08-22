import { useEffect, useState } from 'react'

import { CurrencyQuoteCard } from '../../components/currency/CurrencyQuoteCard'
import { PageHeader } from '../../components/layout/PageHeader'
import { getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'

export function CurrencyQuotePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let active = true

    getSettings()
      .then((nextSettings) => {
        if (active) setSettings(nextSettings)
      })
      .catch(() => {
        if (active) setLoadError(true)
      })

    function handleSettingsChanged(event: Event) {
      setSettings((event as CustomEvent<AppSettings>).detail)
    }

    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)

    return () => {
      active = false
      window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
    }
  }, [])

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6">
      <PageHeader
        backLabel="Más"
        backTo="/more"
        eyebrow="Herramientas"
        title="Consulta de divisas"
      />

      {settings ? (
        <CurrencyQuoteCard
          defaultCurrency={settings.defaultCurrency}
          key={`${settings.defaultCurrency}:${settings.secondaryCurrency}:${settings.rateMode}`}
          rateMode={settings.rateMode}
          secondaryCurrency={settings.secondaryCurrency}
          title="Cotizaciones"
        />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400" role={loadError ? 'alert' : 'status'}>
          {loadError ? 'No se pudo cargar la configuración de monedas.' : 'Cargando configuración...'}
        </p>
      )}
    </section>
  )
}

export default CurrencyQuotePage