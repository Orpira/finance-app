import {
  LoaderCircle,
  MessageCircle,
  Power,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  disconnectWhatsApp,
  getWhatsAppChannel,
  refreshWhatsAppStatus,
  requestWhatsAppQr,
  testWhatsAppNotification,
  updateWhatsAppNotificationPreferences,
  type CommunicationChannelActionResult,
} from '../../services/communicationChannelService'
import { getOrCreateDeviceIdentity } from '../../services/deviceIdentityService'
import type {
  CommunicationChannel,
  WhatsAppNotificationPreferences,
} from '../../types/communicationChannel'
import type { DeviceIdentity } from '../../types/deviceIdentity'

const STATUS_LABELS = {
  not_configured: 'No configurado',
  connecting: 'Pendiente de vinculación',
  connected: 'Conectado',
  disconnected: 'Desconectado',
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

type ActionName = 'qr' | 'status' | 'disconnect' | 'test' | 'preferences'

function maskIdentityCode(value: string) {
  const prefixEnd = value.indexOf('-', value.indexOf('-') + 1)
  const prefix = prefixEnd > 0 ? value.slice(0, prefixEnd) : value.slice(0, 8)
  return `${prefix}-••••••••-${value.slice(-4)}`
}

const PROVISIONING_LABELS = {
  pending: 'Pendiente de envío',
  provisioned: 'Provisionado',
  error: 'Pendiente de reintento',
} as const

export function CommunicationChannelsPage() {
  const [channel, setChannel] = useState<CommunicationChannel | null>(null)
  const [identity, setIdentity] = useState<DeviceIdentity | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeAction, setActiveAction] = useState<ActionName | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let active = true
    Promise.all([getWhatsAppChannel(), getOrCreateDeviceIdentity()])
      .then(([storedChannel, storedIdentity]) => {
        if (active) {
          setChannel(storedChannel)
          setIdentity(storedIdentity)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

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

  const status = channel?.status ?? 'not_configured'
  const isBusy = activeAction !== null

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
              <p className="mt-0.5 text-sm text-slate-500">Evolution API mediante n8n</p>
              {channel?.connectedNumber && (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  Número vinculado: {channel.connectedNumber}
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
              {channel?.qrCode && status !== 'connected' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-center">
                  <img
                    alt="Código QR para vincular WhatsApp"
                    className="mx-auto aspect-square w-full max-w-64 rounded-lg bg-white object-contain p-2"
                    src={channel.qrCode}
                  />
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-700">
                    Abre WhatsApp → Dispositivos vinculados → Vincular dispositivo → Escanea este QR.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {status !== 'connected' && (
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isBusy}
                    onClick={() => void runAction('qr', requestWhatsAppQr, 'QR recibido. Escanéalo desde WhatsApp.')}
                    type="button"
                  >
                    {activeAction === 'qr' ? <LoaderCircle className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
                    {channel?.qrCode || status === 'connecting' ? 'Regenerar QR' : 'Conectar WhatsApp'}
                  </button>
                )}
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  onClick={() => void runAction('status', refreshWhatsAppStatus, 'Estado actualizado.')}
                  type="button"
                >
                  {activeAction === 'status' ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  Actualizar estado
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy || status !== 'connected'}
                  onClick={() => void runAction('test', testWhatsAppNotification, 'Mensaje de prueba solicitado.')}
                  type="button"
                >
                  {activeAction === 'test' ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Probar envío
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy || status === 'not_configured' || status === 'disconnected'}
                  onClick={() => void runAction('disconnect', disconnectWhatsApp, 'WhatsApp desconectado.')}
                  type="button"
                >
                  {activeAction === 'disconnect' ? <LoaderCircle className="size-4 animate-spin" /> : <Power className="size-4" />}
                  Desconectar
                </button>
              </div>

              {notice && (
                <p
                  className={`rounded-lg px-3 py-2 text-sm ${notice.kind === 'error' ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}
                  role={notice.kind === 'error' ? 'alert' : 'status'}
                >
                  {notice.text}
                </p>
              )}

              <fieldset className="space-y-3 border-t border-slate-100 pt-5">
                <legend className="mb-3 font-semibold text-slate-950">Notificaciones automáticas</legend>
                {PREFERENCE_OPTIONS.map((option) => (
                  <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-200 px-4 py-3" key={option.key}>
                    <span className="text-sm font-medium text-slate-700">{option.label}</span>
                    <input
                      checked={channel?.[option.key] ?? false}
                      className="size-5 accent-emerald-600"
                      disabled={isBusy}
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

      {identity && (
        <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <ShieldCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-950">Identidad técnica</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Identificadores locales persistentes usados para conectar este dispositivo de forma segura.
              </p>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Usuario</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-slate-700">{maskIdentityCode(identity.userCode)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dispositivo</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-slate-700">{maskIdentityCode(identity.deviceCode)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Plataforma</dt>
                  <dd className="mt-1 capitalize text-slate-700">{identity.platform}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Provisionamiento</dt>
                  <dd className="mt-1 text-slate-700">
                    {identity.provisioningStatus
                      ? PROVISIONING_LABELS[identity.provisioningStatus]
                      : 'Sin estado'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </article>
      )}

      <p className="text-xs leading-5 text-slate-500">
        Private Balance se comunica únicamente con n8n. Las credenciales de Evolution API permanecen fuera de este dispositivo.
      </p>
    </section>
  )
}

export default CommunicationChannelsPage
