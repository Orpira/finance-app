import { Bell, CalendarPlus, Plus, Save, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  createAppointment,
  getAppointmentById,
  updateAppointment,
} from '../../services/appointmentService'
import { scheduleAppointmentReminders } from '../../services/reminderService'
import { getSettings } from '../../services/settingsService'
import type {
  Appointment,
  AppointmentReminder,
  AppointmentReminderUnit,
} from '../../types/appointment'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  createEmptyReminder,
  hasInvalidReminders,
} from '../../utils/appointmentReminders'
import { getTodayInputDate } from '../../utils/currency'
import { currencies } from '../../utils/countries'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatInputTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function isScheduleInPast(date: string, time: string, now: Date) {
  const today = formatInputDate(now)

  if (date < today) {
    return true
  }

  if (date > today) {
    return false
  }

  return time < formatInputTime(now)
}

function getTimeFromDateTime(dateTime: string) {
  return dateTime.slice(11, 16)
}

function getDateFromDateTime(dateTime: string) {
  return dateTime.slice(0, 10)
}

function getInitialDate(searchDate: string | null) {
  const today = getTodayInputDate()

  if (!searchDate || searchDate < today) {
    return today
  }

  return searchDate
}

export function AppointmentFormPage() {
  const navigate = useNavigate()
  const { appointmentId } = useParams()
  const [searchParams] = useSearchParams()
  const parsedAppointmentId = appointmentId ? Number(appointmentId) : null
  const isEditing = Boolean(parsedAppointmentId)

  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null)
  const [date, setDate] = useState(() =>
    getInitialDate(searchParams.get('date')),
  )
  const [time, setTime] = useState('15:00')
  const [duration, setDuration] = useState(90)
  const [expectedAmount, setExpectedAmount] = useState(120)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [notes, setNotes] = useState('')
  const [reminders, setReminders] = useState<AppointmentReminder[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [now, setNow] = useState(new Date())
  const [loadError, setLoadError] = useState('')

  const todayInput = formatInputDate(now)
  const currentTimeInput = formatInputTime(now)
  const isSelectedScheduleInPast = isScheduleInPast(date, time, now)
  const hasReminderErrors = hasInvalidReminders(reminders)
  const pageTitle = isEditing ? 'Editar cita' : 'Nueva cita'

  const returnToAgenda = useMemo(
    () => `/agenda?date=${date}`,
    [date],
  )

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const currentSettings = await getSettings()

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setCurrency(currentSettings.defaultCurrency)

      if (!parsedAppointmentId) {
        return
      }

      const appointment = await getAppointmentById(parsedAppointmentId)

      if (!isMounted) {
        return
      }

      if (!appointment) {
        setLoadError('No se encontró la cita.')
        return
      }

      if (
        isLocationSeasonClosed(
          appointment,
          currentSettings.closedLocationSeasons,
        )
      ) {
        setDate(getDateFromDateTime(appointment.dateTime))
        setLoadError(
          'Esta cita pertenece a una temporada cerrada. Solo puede consultarse desde la agenda y usarse en reportes.',
        )
        return
      }

      setEditingAppointment(appointment)
      setDate(getDateFromDateTime(appointment.dateTime))
      setTime(getTimeFromDateTime(appointment.dateTime))
      setDuration(appointment.duration)
      setExpectedAmount(appointment.expectedAmount)
      setCurrency(appointment.currency as CurrencyCode)
      setNotes(appointment.notes ?? '')
      setReminders(
        (appointment.reminders ?? []).map((reminder) => ({
          ...reminder,
          type: 'local',
        })),
      )
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [parsedAppointmentId])

  function handleDateChange(nextDate: string) {
    setDate(nextDate)

    if (isScheduleInPast(nextDate, time, now)) {
      setTime(formatInputTime(now))
    }
  }

  function addReminder() {
    setReminders((currentReminders) => {
      if (currentReminders.length >= 2) {
        return currentReminders
      }

      return [...currentReminders, createEmptyReminder()]
    })
  }

  function updateReminder(
    reminderId: string,
    updates: Partial<AppointmentReminder>,
  ) {
    setReminders((currentReminders) =>
      currentReminders.map((reminder) =>
        reminder.id === reminderId ? { ...reminder, ...updates } : reminder,
      ),
    )
  }

  function removeReminder(reminderId: string) {
    setReminders((currentReminders) =>
      currentReminders.filter((reminder) => reminder.id !== reminderId),
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    if (isSelectedScheduleInPast || hasReminderErrors) {
      setSaveStatus('error')
      return
    }

    setSaveStatus('saving')

    const input = {
      dateTime: `${date}T${time}`,
      duration,
      expectedAmount,
      currency,
      country: editingAppointment?.country ?? settings.country,
      city: editingAppointment?.city ?? settings.city,
      notes: notes.trim(),
      reminders: reminders.map((reminder) => ({
        ...reminder,
        type: 'local' as const,
      })),
      completed: editingAppointment?.completed ?? false,
      timerMode: editingAppointment?.timerMode,
      timerStartedAt: editingAppointment?.timerStartedAt,
      timerStoppedAt: editingAppointment?.timerStoppedAt,
      actualDuration: editingAppointment?.actualDuration,
    }

    try {
      let savedAppointment: Appointment | undefined

      if (editingAppointment?.id) {
        savedAppointment = await updateAppointment(editingAppointment.id, input)
      } else {
        const nextAppointmentId = await createAppointment(input)
        savedAppointment = { ...input, id: nextAppointmentId }
      }

      if (savedAppointment) {
        await scheduleAppointmentReminders(savedAppointment)
        navigate(`/agenda?date=${date}&appointment=${savedAppointment.id}`, {
          replace: true,
        })
        return
      }

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

  if (loadError) {
    return (
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <PageHeader
          backLabel="Agenda"
          backTo={returnToAgenda}
          eyebrow="Agenda"
          title={pageTitle}
        />
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {loadError}
        </div>
        <button
          className="inline-flex h-11 w-fit items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          onClick={() => navigate(returnToAgenda)}
          type="button"
        >
          Volver a Agenda
        </button>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Agenda"
        backTo={returnToAgenda}
        eyebrow="Agenda"
        title={pageTitle}
      />

      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Fecha</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={todayInput}
              onChange={(event) => handleDateChange(event.target.value)}
              type="date"
              value={date}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Hora</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={date === todayInput ? currentTimeInput : undefined}
              onChange={(event) => setTime(event.target.value)}
              type="time"
              value={time}
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Duración</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={0}
              onChange={(event) => setDuration(Number(event.target.value))}
              type="number"
              value={duration}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Valor</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={0}
              onChange={(event) => setExpectedAmount(Number(event.target.value))}
              step="0.01"
              type="number"
              value={expectedAmount}
            />
          </label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Moneda</span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
            value={currency}
          >
            {currencies.map((currencyOption) => (
              <option key={currencyOption.value} value={currencyOption.value}>
                {currencyOption.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">Notas</span>
          <textarea
            className="min-h-20 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            onChange={(event) => setNotes(event.target.value)}
            value={notes}
          />
        </label>

        <div className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-emerald-700" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-slate-900">
                Alarmas sonoras
              </h2>
            </div>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
              disabled={reminders.length >= 2}
              onClick={addReminder}
              type="button"
            >
              <Plus className="size-4" aria-hidden="true" />
              Añadir alarma ({reminders.length}/2)
            </button>
          </div>

          {reminders.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sin alarmas configuradas. Puedes añadir hasta dos y elegir cuánto
              tiempo antes de la cita sonará cada una.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {reminders.map((reminder, index) => (
                <div
                  className="grid gap-2 rounded-md border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                  key={reminder.id}
                >
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">
                      Cantidad
                    </span>
                    <input
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      min={1}
                      onChange={(event) =>
                        updateReminder(reminder.id, {
                          amount: Number(event.target.value),
                        })
                      }
                      type="number"
                      value={reminder.amount}
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-slate-600">
                      Unidad
                    </span>
                    <select
                      className="h-10 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                      onChange={(event) =>
                        updateReminder(reminder.id, {
                          unit: event.target.value as AppointmentReminderUnit,
                        })
                      }
                      value={reminder.unit}
                    >
                      <option value="minutes">minutos</option>
                      <option value="hours">horas</option>
                      <option value="days">días</option>
                    </select>
                  </label>

                  <button
                    className="inline-flex h-10 items-center justify-center self-end rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    onClick={() => removeReminder(reminder.id)}
                    type="button"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                    <span className="sr-only">Eliminar aviso {index + 1}</span>
                  </button>
                </div>
              ))}
            </div>
          )}

          {hasReminderErrors && (
            <p className="text-sm font-medium text-red-700">
              Revisa los recordatorios: máximo 2, cantidad mayor que 0 y sin
              duplicados.
            </p>
          )}
          <p className="text-xs leading-5 text-slate-500">
            En Android se programan como alarmas exactas, con sonido, vibración
            y canal de prioridad máxima. El sistema puede solicitar permisos la
            primera vez.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500" role="status">
            {saveStatus === 'saved' && 'Cita guardada'}
            {saveStatus === 'error' &&
              (isSelectedScheduleInPast
                ? 'Selecciona una fecha y hora actual o futura'
                : hasReminderErrors
                  ? 'Revisa los recordatorios'
                  : 'No se pudo guardar')}
          </p>

          <div className="grid gap-2 sm:flex sm:justify-end">
            <button
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={() => navigate(returnToAgenda)}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={
                saveStatus === 'saving' ||
                expectedAmount <= 0 ||
                isSelectedScheduleInPast ||
                hasReminderErrors
              }
              type="submit"
            >
              {isEditing ? (
                <Save className="size-4" aria-hidden="true" />
              ) : (
                <CalendarPlus className="size-4" aria-hidden="true" />
              )}
              {saveStatus === 'saving' ? 'Guardando' : 'Guardar cita'}
            </button>
          </div>
        </div>
      </form>
    </section>
  )
}

export default AppointmentFormPage
