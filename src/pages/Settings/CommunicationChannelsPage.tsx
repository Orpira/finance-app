import {
  LoaderCircle,
  MessageCircle,
  Power,
  RefreshCw,
  Send,
  UserRoundCog,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  changeWhatsAppAccount,
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppChannel,
  refreshWhatsAppStatus,
  testWhatsAppNotification,
  updateWhatsAppNotificationPreferences,
  type CommunicationChannelActionResult,
} from '../../services/communicationChannelService'
import type {
  CommunicationChannel,
  WhatsAppNotificationPreferences,
} from '../../types/communicationChannel'

const STATUS_LABELS = {
  not_configured: 'No conectado',
  connecting: 'Pendiente de vinculación',
  connected: 'Conectado',
  disconnected: 'No conectado',
  error: 'Error',
} as const

const STATUS_STYLES = {
  not_configured: 'bg-slate-100 text-slate-700',
  connecting: 'bg-amber-100 text-amber-800',
  connected: 'bg-emerald-100 text-emerald-800',
  disconnected: 'bg-slate-100 text-slate-700',
  error: 'bg-red-100 text-red-800',
} as const

const PREFERENCE_OPTIONS: Array<{
  key: keyof WhatsAppNotificationPreferences
  label: string
}> = [
  { key: 'notifyIncomeCreated', label: 'Notificar nuevos ingresos' },
  { key: 'notifyExpenseCreated', label: 'Notificar nuevos egresos' },
  { key: 'notifyCalendarReminder', label: 'Notificar recordatorios de agenda' },
  { key: 'notifyBackupCompleted', label: 'Notificar backups completados' },
]

type ActionName = 'connect' | 'status' | 'disconnect' | 'change' | 'test' | 'preferences'

const STATUS_POLL_INTERVAL_MS = 7_000
const STATUS_POLL_TIMEOUT_MS = 90_000

function formatLastSync(value?: string) {
  if (!value) return 'Sin sincronización registrada'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Sin sincronización registrada'
    : date.toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
}

export function CommunicationChannelsPage() {
  const [channel, setChannel] = useState<CommunicationChannel | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeAction, setActiveAction] = useState<ActionName | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const status = channel?.status ?? 'not_configured'
  const isBusy = activeAction !== null
  const isConnected = status === 'connected'
  const connectedNumber = channel?.phoneNumber ?? channel?.connectedNumber

  useEffect(() => {
    let active = true
    getWhatsAppChannel()
      .then((storedChannel) => {
        if (active) {
          setChannel(storedChannel)
          setPhoneNumber(storedChannel?.phoneNumber ?? storedChannel?.connectedNumber ?? '')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (status !== 'connecting' || activeAction !== null) return

    let active = true
    const startedAt = Date.now()
    let timer: ReturnType<typeof setTimeout> | undefined

    const terminalStatuses = new Set(['connected', 'disconnected', 'error'])

    const pollStatus = async () => {
      try {
        const result = await refreshWhatsAppStatus()
        if (!active) return

        setChannel(result.channel)

        const shouldStop =
          terminalStatuses.has(result.channel.status) ||
          Date.now() - startedAt >= STATUS_POLL_TIMEOUT_MS
        if (shouldStop) return

        timer = setTimeout(() => { void pollStatus() }, STATUS_POLL_INTERVAL_MS)
      } catch {
        if (!active) return

        const timedOut = Date.now() - startedAt >= STATUS_POLL_TIMEOUT_MS
        if (timedOut) return

        timer = setTimeout(() => { void pollStatus() }, STATUS_POLL_INTERVAL_MS)
      }
    }

    timer = setTimeout(() => { void pollStatus() }, STATUS_POLL_INTERVAL_MS)

    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [activeAction, status])

  async function runAction(
    action: ActionName,
    operation: () => Promise<CommunicationChannelActionResult>,
    successMessage: string,
  ) {
    setActiveAction(action)
    setNotice(null)
    try {
      const result = await operation()
      setChannel(result.channel)
      setNotice(result.delivered
        ? { kind: 'success', text: result.message ?? successMessage }
        : { kind: 'error', text: result.error ?? 'No se pudo contactar con n8n. Puedes reintentar.' })
    } catch (error) {
      setNotice({
        kind: 'error',
        text: error instanceof Error ? error.message : 'No se pudo completar la acción.',
      })
    } finally {
      setActiveAction(null)
    }
  }

  function handlePreferenceChange(key: keyof WhatsAppNotificationPreferences, checked: boolean) {
    const current = channel ?? {
      notifyIncomeCreated: false,
      notifyExpenseCreated: false,
      notifyCalendarReminder: false,
      notifyBackupCompleted: false,
    }
    const preferences: WhatsAppNotificationPreferences = {
      notifyIncomeCreated: current.notifyIncomeCreated,
      notifyExpenseCreated: current.notifyExpenseCreated,
      notifyCalendarReminder: current.notifyCalendarReminder,
      notifyBackupCompleted: current.notifyBackupCompleted,
      [key]: checked,
    }
    void runAction(
      'preferences',
      () => updateWhatsAppNotificationPreferences(preferences),
      'Preferencias guardadas.',
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader
        backLabel="Configuración"
        backTo="/settings"
        eyebrow="Configuración"
        title="Canales de comunicación"
      />

      <p className="text-sm leading-6 text-slate-600">
        Gestiona los canales que Private Balance usará para enviar notificaciones.
      </p>

      <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <MessageCircle className="size-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-slate-950">WhatsApp</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Notificaciones automáticas mediante n8n y Evolution API
              </p>
              {isConnected && connectedNumber && (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Número conectado: {connectedNumber}
                </p>
              )}
            </div>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {STATUS_LABELS[status]}
          </span>
        </div>

        <div className="space-y-5 p-5">
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              Cargando canal…
            </div>
          ) : (
            <>
              {!isConnected && status !== 'connecting' && (
                <p className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  Private Balance puede usar tu WhatsApp para enviarte notificaciones
                  automáticas de ingresos, egresos y agenda. Esta autorización es
                  independiente de la licencia de la aplicación.
                </p>
              )}

              {!isConnected && (
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-slate-800">
                    Número de WhatsApp
                  </span>
                  <input
                    autoComplete="tel"
                    className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    disabled={isBusy}
                    inputMode="tel"
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="Ej. 34600111222"
                    type="tel"
                    value={phoneNumber}
                  />
                  <span className="text-xs leading-5 text-slate-500">
                    Incluye el prefijo internacional. Se usa para solicitar el código de vinculación; si Evolution no lo ofrece, se mostrará un QR alternativo.
                  </span>
                </label>
              )}

              {channel?.pairingCode && !isConnected && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-900">Código de vinculación</p>
                  <p className="mt-3 break-all text-center font-mono text-3xl font-bold tracking-[0.2em] text-emerald-950">
                    {channel.pairingCode}
                  </p>
                  <p className="mt-4 text-sm leading-6 text-emerald-900">
                    Abre WhatsApp → Dispositivos vinculados → Vincular con número/código → introduce este código.
                  </p>
                </div>
              )}

              {channel?.qrCode && !channel.pairingCode && !isConnected && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center">
                  <img
                    alt="Código QR para vincular WhatsApp"
                    className="mx-auto aspect-square w-full max-w-64 rounded-lg bg-white object-contain p-2"
                    src={channel.qrCode}
                  />
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-700">
                    Usa este QR solo si vas a vincular desde otro dispositivo.
                  </p>
                </div>
              )}

              {isConnected && (
                <dl className="grid gap-3 rounded-lg bg-emerald-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cuenta</dt>
                    <dd className="mt-1 font-medium text-emerald-950">
                      {channel?.profileName || connectedNumber || 'WhatsApp conectado'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Última sincronización</dt>
                    <dd className="mt-1 font-medium text-emerald-950">
                      {formatLastSync(channel?.lastSeenAt ?? channel?.updatedAt)}
                    </dd>
                  </div>
                </dl>
              )}

              <div className="flex flex-wrap gap-2">
                {!isConnected && status !== 'connecting' && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void runAction(
                      'connect',
                      () => connectWhatsApp(phoneNumber),
                      'Solicitud de vinculación preparada.',
                    )}
                    type="button"
                  >
                    {activeAction === 'connect' ? <LoaderCircle className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                    Conectar WhatsApp
                  </button>
                )}
                {!isConnected && status === 'connecting' && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void runAction('status', refreshWhatsAppStatus, 'Estado actualizado.')}
                    type="button"
                  >
                    {activeAction === 'status' ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                    Actualizar estado
                  </button>
                )}
                {!isConnected && status === 'connecting' && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void runAction(
                      'connect',
                      () => connectWhatsApp(phoneNumber),
                      'Solicitud de vinculación preparada.',
                    )}
                    type="button"
                  >
                    {activeAction === 'connect' ? <LoaderCircle className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                    Generar nuevo código
                  </button>
                )}
                {isConnected && <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => void runAction('status', refreshWhatsAppStatus, 'Estado actualizado.')}
                  type="button"
                >
                  {activeAction === 'status' ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Actualizar estado
                </button>}
                {isConnected && <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => void runAction('test', testWhatsAppNotification, 'Mensaje de prueba solicitado.')}
                  type="button"
                >
                  {activeAction === 'test' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Probar envío
                </button>}
                {isConnected && <button
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => void runAction('disconnect', disconnectWhatsApp, 'WhatsApp desconectado.')}
                  type="button"
                >
                  {activeAction === 'disconnect' ? <LoaderCircle className="size-4 animate-spin" /> : <Power className="size-4" />}
                  Desconectar
                </button>}
                {isConnected && <button
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => void runAction('change', changeWhatsAppAccount, 'Puedes vincular otra cuenta.')}
                  type="button"
                >
                  {activeAction === 'change' ? <LoaderCircle className="size-4 animate-spin" /> : <UserRoundCog className="size-4" />}
                  Cambiar cuenta
                </button>}
              </div>

              {notice && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${notice.kind === 'error' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}
                  role={notice.kind === 'error' ? 'alert' : 'status'}
                >
                  {notice.text}
                </p>
              )}

              {channel?.status === 'connecting' && channel?.pairingCode == null && channel?.qrCode == null && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  {channel?.lastSeenAt
                    ? 'No hay QR disponible para esta instancia. Pulsa "Actualizar estado" para consultar conexión o "Generar nuevo código" para solicitar un nuevo código.'
                    : 'No hay QR disponible. Pulsa "Actualizar estado" para consultar conexión o "Generar nuevo código" para solicitar un nuevo código.'}
                </div>
              )}

              <fieldset className="space-y-3 border-t border-slate-100 pt-5" disabled={!isConnected}>
                <legend className="mb-3 font-semibold text-slate-950">Notificaciones automáticas</legend>
                {PREFERENCE_OPTIONS.map((option) => (
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3" key={option.key}>
                    <span className="text-sm font-medium text-slate-700">{option.label}</span>
                    <input
                      checked={channel?.[option.key] ?? false}
                      className="size-5 accent-emerald-600"
                      disabled={isBusy || !isConnected}
                      onChange={(event) => handlePreferenceChange(option.key, event.target.checked)}
                      type="checkbox"
                    />
                  </label>
                ))}
              </fieldset>
            </>
          )}
        </div>
      </article>

      <p className="text-xs leading-5 text-slate-500">
        Private Balance se comunica únicamente con n8n. Las credenciales de Evolution API permanecen fuera de este dispositivo.
      </p>
    </section>
  )
}

export default CommunicationChannelsPage
