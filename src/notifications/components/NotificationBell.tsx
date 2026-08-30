import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { getNotificationService } from '../notificationService'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    let cancelled = false

    function refresh() {
      getNotificationService()
        .countUnread()
        .then((count) => {
          if (!cancelled) setUnreadCount(count)
        })
        .catch(() => {
          if (!cancelled) setUnreadCount(0)
        })
    }

    refresh()
    const intervalId = window.setInterval(refresh, 60_000)
    window.addEventListener('finance-app:notifications-changed', refresh)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('finance-app:notifications-changed', refresh)
    }
  }, [])

  return (
    <Link
      aria-label={unreadCount > 0 ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones'}
      className={[
        'relative inline-flex size-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
        className ?? '',
      ].join(' ')}
      title="Notificaciones"
      to="/notifications"
    >
      <Bell aria-hidden="true" className="size-5" />
      {unreadCount > 0 ? (
        <span className="absolute right-1.5 top-1.5 flex size-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[0.6rem] font-semibold leading-none text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      ) : null}
    </Link>
  )
}
