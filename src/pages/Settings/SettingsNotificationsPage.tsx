import { Save } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import { getSettings, updateSettings } from '../../services/settingsService'
import type { NotificationPreferences } from '../../notifications/types'
import type { AppSettings } from '../../types/settings'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const TOGGLES: Array<{
  key: keyof Pick<
    NotificationPreferences,
    | 'copilotNotificationsEnabled'
    | 'importantAlertsEnabled'
    | 'financialInsightsEnabled'
    | 'agendaNotificationsEnabled'
    | 'periodicSummaryEnabled'
    | 'showFinancialDetailsExternally'
  >
  label: string
  description: string
}> = [
  {
    key: 'copilotNotificationsEnabled',
    label: 'Notificaciones del Copiloto',
    description: 'Interruptor general. Si lo desactivas, el Copiloto sigue respondiendo tus preguntas, pero no te avisará de nada por su cuenta.',
  },
  {
    key: 'importantAlertsEnabled',
    label: 'Alertas importantes',
    description: 'Situaciones que requieren una decisión tuya, como el cierre próximo de una temporada.',
  },
  {
    key: 'financialInsightsEnabled',
    label: 'Insights financieros',
    description: 'Observaciones relevantes sobre tu Meta de temporada u otros datos financieros.',
  },
  {
    key: 'agendaNotificationsEnabled',
    label: 'Agenda',
    description: 'Avisos sobre citas pendientes de confirmar. No sustituye a los recordatorios de la propia cita.',
  },
  {
    key: 'periodicSummaryEnabled',
    label: 'Resumen periódico',
    description: 'Un resumen agrupado en lugar de notificaciones individuales.',
  },
  {
    key: 'showFinancialDetailsExternally',
    label: 'Mostrar información financiera',
    description: 'Muestra importes y detalles sensibles en las notificaciones. Desactivado por defecto por privacidad.',
  },
]

export function SettingsNotificationsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    getSettings().then(setSettings)
  }, [])

  function updatePreferences(updates: Partial<NotificationPreferences>) {
    setSettings((current) =>
      current
        ? { ...current, notificationPreferences: { ...current.notificationPreferences, ...updates } }
        : current,
    )
    setSaveStatus('idle')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!settings) return

    setSaveStatus('saving')
    try {
      const updated = await updateSettings({ notificationPreferences: settings.notificationPreferences })
      setSettings(updated)
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  const preferences = settings.notificationPreferences

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader backLabel="Configuración" backTo="/settings" eyebrow="Configuración" title="Notificaciones" />

      <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
        <fieldset className="flex flex-col gap-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Qué recibir</legend>

          {TOGGLES.map((toggle) => (
            <label className="flex items-start gap-3" key={toggle.key}>
              <input
                checked={preferences[toggle.key]}
                className="mt-1 size-4 accent-emerald-700"
                onChange={(event) => updatePreferences({ [toggle.key]: event.target.checked })}
                type="checkbox"
              />
              <span className="flex flex-col gap-1">
                <span className="text-sm font-medium text-slate-700">{toggle.label}</span>
                <span className="text-sm text-slate-500">{toggle.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3 border-t border-slate-200 pt-5">
          <legend className="px-1 text-sm font-medium text-slate-700">Horario silencioso</legend>

          <label className="flex items-start gap-3">
            <input
              checked={preferences.quietHoursEnabled}
              className="mt-1 size-4 accent-emerald-700"
              onChange={(event) => updatePreferences({ quietHoursEnabled: event.target.checked })}
              type="checkbox"
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">Activar horario silencioso</span>
              <span className="text-sm text-slate-500">Las notificaciones no críticas se aplazan durante este rango.</span>
            </span>
          </label>

          {preferences.quietHoursEnabled ? (
            <div className="flex items-center gap-3 pl-7">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Desde
                <input
                  className="h-11 rounded-md border border-slate-200 px-3"
                  onChange={(event) => updatePreferences({ quietHoursStart: event.target.value })}
                  type="time"
                  value={preferences.quietHoursStart}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                Hasta
                <input
                  className="h-11 rounded-md border border-slate-200 px-3"
                  onChange={(event) => updatePreferences({ quietHoursEnd: event.target.value })}
                  type="time"
                  value={preferences.quietHoursEnd}
                />
              </label>
            </div>
          ) : null}
        </fieldset>

        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-sm text-slate-500" role="status">
            {saveStatus === 'saved' && 'Guardado'}
            {saveStatus === 'error' && 'No se pudo guardar'}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={saveStatus === 'saving'}
            type="submit"
          >
            <Save aria-hidden="true" className="size-4" />
            {saveStatus === 'saving' ? 'Guardando' : 'Guardar'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default SettingsNotificationsPage
