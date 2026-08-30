import { BellOff, Check, ChevronRight, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { getNotificationService, notifyNotificationsChanged } from '../../notifications/notificationService'
import type { CopilotNotification, NotificationPriority } from '../../notifications/types'

const PRIORITY_STYLES: Record<NotificationPriority, string> = {
  P0: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  P1: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  P2: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  P3: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  P0: 'Crítica',
  P1: 'Acción requerida',
  P2: 'Insight',
  P3: 'Informativa',
}

const VISIBLE_STATUSES = new Set(['new', 'seen', 'read'])

export function NotificationCenterPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<CopilotNotification[] | null>(null)
  const service = getNotificationService()

  function refresh() {
    service.listNotifications().then(setNotifications)
  }

  useEffect(() => {
    refresh()
    service
      .listNotifications()
      .then((all) => Promise.all(all.filter((item) => item.status === 'new').map((item) => service.markSeen(item.id))))
      .then(() => notifyNotificationsChanged())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDismiss(id: string) {
    await service.dismiss(id)
    notifyNotificationsChanged()
    refresh()
  }

  async function handleAct(notification: CopilotNotification) {
    await service.markActed(notification.id)
    notifyNotificationsChanged()
    if (notification.action) navigate(notification.action.destination)
  }

  const visible = (notifications ?? []).filter((item) => VISIBLE_STATUSES.has(item.status))

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <PageHeader backLabel="Más" backTo="/more" eyebrow="Copiloto" title="Notificaciones" />

      {notifications === null ? (
        <p className="text-sm text-slate-500">Cargando notificaciones…</p>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
          <BellOff aria-hidden="true" className="size-8" />
          <p className="text-sm">No tienes notificaciones por ahora.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((notification) => (
            <li
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              key={notification.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[notification.priority]}`}
                  >
                    {PRIORITY_LABELS[notification.priority]}
                  </span>
                  <h2 className="mt-2 font-semibold text-slate-950 dark:text-white">{notification.title}</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
                </div>
                <button
                  aria-label="Descartar notificación"
                  className="shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                  onClick={() => handleDismiss(notification.id)}
                  type="button"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>

              {notification.action ? (
                <button
                  className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
                  onClick={() => handleAct(notification)}
                  type="button"
                >
                  {notification.action.label}
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              ) : notification.status !== 'read' ? (
                <button
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
                  onClick={async () => {
                    await service.markRead(notification.id)
                    refresh()
                  }}
                  type="button"
                >
                  <Check aria-hidden="true" className="size-4" />
                  Marcar como leída
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default NotificationCenterPage
