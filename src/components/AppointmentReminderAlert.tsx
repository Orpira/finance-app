import { BellRing, CalendarDays, Check } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { listAppointments } from '../services/appointmentService'
import type { Appointment, AppointmentReminder } from '../types/appointment'
import {
  formatReminderTime,
  getReminderTriggerTime,
  reminderTypeLabels,
} from '../utils/appointmentReminders'
import { playPriorityAlarm } from '../utils/alarm'

const FIRED_REMINDERS_STORAGE_KEY = 'finance-app:fired-appointment-reminders'

interface ActiveReminder {
  appointment: Appointment;
  reminder: AppointmentReminder;
  key: string;
}

function getDateFromDateTime(dateTime: string) {
  return dateTime.slice(0, 10)
}

function getTimeFromDateTime(dateTime: string) {
  return dateTime.slice(11, 16)
}

function getFiredReminderKeys() {
  try {
    const storedValue = localStorage.getItem(FIRED_REMINDERS_STORAGE_KEY)
    const parsedValue = storedValue ? JSON.parse(storedValue) : []

    return Array.isArray(parsedValue)
      ? new Set(parsedValue.filter((value) => typeof value === 'string'))
      : new Set<string>()
  } catch {
    return new Set<string>()
  }
}

function saveFiredReminderKeys(keys: Set<string>) {
  localStorage.setItem(
    FIRED_REMINDERS_STORAGE_KEY,
    JSON.stringify(Array.from(keys).slice(-200)),
  )
}

function getReminderKey(appointment: Appointment, reminder: AppointmentReminder) {
  return `${appointment.id}-${appointment.dateTime}-${reminder.id}`
}

function findDueReminder(
  appointments: Appointment[],
  now: Date,
): ActiveReminder | null {
  const firedReminderKeys = getFiredReminderKeys()
  const nowTime = now.getTime()

  for (const appointment of appointments) {
    if (!appointment.id || appointment.completed) {
      continue
    }

    const appointmentTime = new Date(appointment.dateTime).getTime()

    if (Number.isNaN(appointmentTime) || nowTime >= appointmentTime) {
      continue
    }

    for (const reminder of appointment.reminders ?? []) {
      const reminderKey = getReminderKey(appointment, reminder)

      if (firedReminderKeys.has(reminderKey)) {
        continue
      }

      const triggerTime = getReminderTriggerTime(appointment, reminder)

      if (nowTime >= triggerTime) {
        return {
          appointment,
          reminder,
          key: reminderKey,
        }
      }
    }
  }

  return null
}

export function AppointmentReminderAlert() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [now, setNow] = useState(new Date())
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(
    null,
  )

  const reloadAppointments = useCallback(async () => {
    const currentAppointments = await listAppointments()
    setAppointments(currentAppointments)
  }, [])

  const appointmentTimeLabel = useMemo(() => {
    if (!activeReminder) {
      return ''
    }

    return getTimeFromDateTime(activeReminder.appointment.dateTime)
  }, [activeReminder])

  useEffect(() => {
    let isMounted = true

    async function loadInitialAppointments() {
      const currentAppointments = await listAppointments()

      if (isMounted) {
        setAppointments(currentAppointments)
      }
    }

    loadInitialAppointments()

    const tickIntervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    const reloadIntervalId = window.setInterval(() => {
      reloadAppointments()
    }, 5000)

    window.addEventListener('focus', reloadAppointments)

    return () => {
      window.clearInterval(tickIntervalId)
      window.clearInterval(reloadIntervalId)
      window.removeEventListener('focus', reloadAppointments)
      isMounted = false
    }
  }, [reloadAppointments])

  useEffect(() => {
    if (activeReminder) {
      return
    }

    const dueReminder = findDueReminder(appointments, now)

    if (!dueReminder) {
      return
    }

    const firedReminderKeys = getFiredReminderKeys()
    firedReminderKeys.add(dueReminder.key)
    saveFiredReminderKeys(firedReminderKeys)
    const timeoutId = window.setTimeout(() => {
      setActiveReminder(dueReminder)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeReminder, appointments, now])

  useEffect(() => {
    if (!activeReminder) {
      return
    }

    playPriorityAlarm()

    const intervalId = window.setInterval(() => {
      playPriorityAlarm()
    }, 3500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeReminder])

  function handleOpenAgenda() {
    if (!activeReminder) {
      return
    }

    const selectedDate = getDateFromDateTime(activeReminder.appointment.dateTime)
    const appointmentId = activeReminder.appointment.id

    setActiveReminder(null)
    navigate(`/agenda?date=${selectedDate}&appointment=${appointmentId}`)
  }

  if (!activeReminder) {
    return null
  }

  return (
    <div
      aria-labelledby="global-appointment-reminder-title"
      aria-modal="true"
      className="fixed inset-0 z-[90] flex items-end bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border-2 border-emerald-300 bg-white p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <BellRing className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-emerald-700">
              Recordatorio de cita
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-slate-950"
              id="global-appointment-reminder-title"
            >
              Cita a las {appointmentTimeLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {formatReminderTime(activeReminder.reminder)} ·{' '}
              {reminderTypeLabels[activeReminder.reminder.type]}
            </p>
          </div>
        </div>

        {activeReminder.appointment.notes && (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            {activeReminder.appointment.notes}
          </p>
        )}

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            onClick={() => setActiveReminder(null)}
            type="button"
          >
            <Check className="size-4" aria-hidden="true" />
            Entendido
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
            onClick={handleOpenAgenda}
            type="button"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Ver cita
          </button>
        </div>
      </div>
    </div>
  )
}

export default AppointmentReminderAlert
