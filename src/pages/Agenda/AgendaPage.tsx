import 'react-calendar/dist/Calendar.css'

import {
  Bell,
  CalendarCheck,
  Check,
  Clock3,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Calendar from 'react-calendar'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  deleteAppointment,
  listAppointments,
  updateAppointment,
} from '../../services/appointmentService'
import { completeAppointmentAsIncome } from '../../services/appointmentCompletionService'
import { getSettings } from '../../services/settingsService'
import { listClosedEarningPeriods } from '../../services/earningPeriodService'
import type { Appointment } from '../../types/appointment'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import { getAppointmentDisplayName } from '../../utils/activityLabels'
import {
  formatReminderTime,
  reminderTypeLabels,
} from '../../utils/appointmentReminders'
import { formatCurrency } from '../../utils/currency'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import { getDurationDisplay } from '../../utils/serviceDuration'
import { isReported, markAsPending } from '../../catalogs/reportStatuses'
import { useDialog } from '../../components/dialogs/useDialog'

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isBeforeToday(date: Date, now: Date) {
  return getStartOfDay(date).getTime() < getStartOfDay(now).getTime()
}

function getTimeFromDateTime(dateTime: string) {
  return dateTime.slice(11, 16)
}

function getDateFromDateTime(dateTime: string) {
  return dateTime.slice(0, 10)
}

function getDateFromSearch(searchDate: string | null) {
  if (!searchDate) {
    return null
  }

  const date = new Date(`${searchDate}T00:00`)

  return Number.isNaN(date.getTime()) ? null : date
}

function sortAppointments(appointments: Appointment[]) {
  return [...appointments].sort((first, second) =>
    first.dateTime.localeCompare(second.dateTime),
  )
}

function getElapsedSeconds(appointment: Appointment, now: Date) {
  if (!appointment.timerStartedAt) {
    return 0
  }

  const start = new Date(appointment.timerStartedAt)
  const end = appointment.timerStoppedAt
    ? new Date(appointment.timerStoppedAt)
    : now

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000))
}

function formatElapsedTime(seconds: number) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':')
}

function getActualDurationMinutes(appointment: Appointment, now: Date) {
  if (appointment.actualDuration !== undefined) {
    return appointment.actualDuration
  }

  if (!appointment.timerStartedAt) {
    return appointment.duration
  }

  return Math.max(1, Math.ceil(getElapsedSeconds(appointment, now) / 60))
}

function getTimerLabel(appointment: Appointment, now: Date) {
  if (appointment.completed) {
    return `Duración real: ${getActualDurationMinutes(appointment, now)} min`
  }

  if (appointment.timerStartedAt) {
    return appointment.timerMode === 'manual'
      ? 'Contador en curso: inicio manual'
      : 'Contador en curso: inicio automático'
  }

  if (appointment.timerMode === 'manualPending') {
    return 'Inicio retrasado: esperando inicio manual'
  }

  return `Inicio automático a las ${getTimeFromDateTime(appointment.dateTime)}`
}

export function AgendaPage() {
  const { alert, confirm } = useDialog()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [closedPeriodIds, setClosedPeriodIds] = useState<Set<number>>(new Set())
  const [selectedDate, setSelectedDate] = useState(
    () => getDateFromSearch(searchParams.get('date')) ?? new Date(),
  )
  const [now, setNow] = useState(new Date())

  const highlightedAppointmentId = searchParams.get('appointment')
  const selectedDateFromSearch = getDateFromSearch(searchParams.get('date'))
  const visibleSelectedDate = selectedDateFromSearch ?? selectedDate
  const selectedDateInput = useMemo(
    () => formatInputDate(visibleSelectedDate),
    [visibleSelectedDate],
  )

  const reloadAppointments = useCallback(async () => {
    const currentAppointments = await listAppointments()
    setAppointments(currentAppointments)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentAppointments, closedPeriods] = await Promise.all([
        getSettings(),
        listAppointments(),
        listClosedEarningPeriods(),
      ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setAppointments(currentAppointments)
      setClosedPeriodIds(new Set(closedPeriods.flatMap((period) => period.id ? [period.id] : [])))
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const dueAppointments = appointments.filter(
      (appointment) =>
        appointment.id &&
        !appointment.completed &&
        !isReported(appointment) &&
        !appointment.timerStartedAt &&
        appointment.timerMode !== 'manualPending' &&
        new Date(appointment.dateTime).getTime() <= now.getTime(),
    )

    if (dueAppointments.length === 0) {
      return
    }

    let isCancelled = false

    async function startDueTimers() {
      await Promise.all(
        dueAppointments.map((appointment) =>
          updateAppointment(appointment.id as number, {
            timerMode: 'automatic',
            timerStartedAt: appointment.dateTime,
          }),
        ),
      )

      if (!isCancelled) {
        await reloadAppointments()
      }
    }

    startDueTimers()

    return () => {
      isCancelled = true
    }
  }, [appointments, now, reloadAppointments])

  const selectedAppointments = useMemo(
    () =>
      sortAppointments(
        appointments.filter(
          (appointment) =>
            !appointment.completed &&
            getDateFromDateTime(appointment.dateTime) === selectedDateInput,
        ),
      ),
    [appointments, selectedDateInput],
  )

  function handleCalendarChange(value: unknown) {
    if (!(value instanceof Date) || isBeforeToday(value, now)) {
      return
    }

    const nextDate = formatInputDate(value)

    setSelectedDate(value)
    setSearchParams({ date: nextDate })
  }

  function openCreateAppointment() {
    navigate(`/agenda/nueva?date=${selectedDateInput}`)
  }

  function openEditAppointment(appointment: Appointment) {
    if (!appointment.id) {
      return
    }

    navigate(`/agenda/${appointment.id}/editar?date=${selectedDateInput}`)
  }

  async function handleDelete(appointmentId: number) {
    await deleteAppointment(appointmentId)
    await reloadAppointments()
  }

  async function handleRemoveReportedMark(appointment: Appointment) {
    if (!appointment.id) {
      return
    }

    const shouldRemoveMark = await confirm({
      title: 'Quitar marca de Reportado',
      message: '¿Quitar la marca de Reportado? La cita volverá a permitir modificaciones y eliminación.',
      confirmLabel: 'Quitar marca',
    })
    if (!shouldRemoveMark) {
      return
    }

    try {
      const pendingAppointment = markAsPending(appointment)
      await updateAppointment(appointment.id, {
        reportStatusCode: pendingAppointment.reportStatusCode,
        reportStatusLabel: pendingAppointment.reportStatusLabel,
        reportedAt: pendingAppointment.reportedAt,
      })
      await reloadAppointments()
    } catch (error: unknown) {
      await alert({
        type: 'error',
        title: 'No se pudo actualizar la cita',
        message: error instanceof Error ? error.message : 'No se pudo quitar la marca de la cita.',
      })
    }
  }

  async function handleManualPending(appointment: Appointment) {
    if (!appointment.id || appointment.completed || appointment.timerStartedAt) {
      return
    }

    await updateAppointment(appointment.id, {
      timerMode: 'manualPending',
    })
    await reloadAppointments()
  }

  async function handleStartTimer(appointment: Appointment) {
    if (!appointment.id || appointment.completed) {
      return
    }

    await updateAppointment(appointment.id, {
      actualDuration: undefined,
      timerMode: 'manual',
      timerStartedAt: new Date().toISOString(),
      timerStoppedAt: undefined,
    })
    await reloadAppointments()
  }

  async function handleCompleteAppointment(appointment: Appointment) {
    if (!settings || !appointment.id || appointment.completed) {
      return
    }

    await completeAppointmentAsIncome(appointment, settings, now)
    await reloadAppointments()
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <PageHeader
        backLabel="Inicio"
        backTo="/"
        eyebrow="Agenda"
        title="Citas y servicios"
      >
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          onClick={openCreateAppointment}
          type="button"
        >
          <Plus className="size-4" aria-hidden="true" />
          Nueva cita
        </button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="flex flex-col gap-4">
          <CollapsibleFilters
            title="Calendario"
            storageKey="filters-open-agenda"
          >
            <Calendar
              className="w-full border-none text-sm"
              minDate={getStartOfDay(now)}
              onChange={handleCalendarChange}
              tileDisabled={({ date: tileDate, view }) =>
                view === 'month' && isBeforeToday(tileDate, now)
              }
              value={visibleSelectedDate}
            />
          </CollapsibleFilters>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarCheck
              className="size-5 text-emerald-700"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold text-slate-950">
              Citas del día
            </h2>
          </div>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            {selectedAppointments.length === 0 ? (
              <div className="flex flex-col gap-3 p-4">
                <p className="text-sm text-slate-500">
                  No hay citas para esta fecha.
                </p>
                <button
                  className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  onClick={openCreateAppointment}
                  type="button"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Crear cita
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {selectedAppointments.map((appointment) => {
                  const elapsedSeconds = getElapsedSeconds(appointment, now)
                  const actualDuration = getActualDurationMinutes(
                    appointment,
                    now,
                  )
                  const hasTimerStarted = Boolean(appointment.timerStartedAt)
                  const isPlannedTimeReached =
                    hasTimerStarted &&
                    !appointment.completed &&
                    elapsedSeconds >= appointment.duration * 60
                  const extraMinutes = Math.max(
                    0,
                    Math.floor(elapsedSeconds / 60) - appointment.duration,
                  )
                  const isHighlighted =
                    String(appointment.id) === highlightedAppointmentId
                  const isClosedSeason = closedPeriodIds.has(appointment.earningPeriodId ?? appointment.seasonPeriodId ?? -1) || isLocationSeasonClosed(
                    appointment,
                    settings.closedLocationSeasons,
                    settings.reopenedLocationSeasons,
                  )
                  const appointmentIsReported = isReported(appointment)

                  return (
                    <li
                      className={[
                        'flex flex-col gap-3 p-4 transition',
                        isHighlighted ? 'bg-emerald-50/70 ring-2 ring-inset ring-emerald-300' : '',
                      ].join(' ')}
                      key={appointment.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-950">
                            {getAppointmentDisplayName(
                              appointment,
                              settings.city,
                            )}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {getTimeFromDateTime(appointment.dateTime)} ·{' '}
                            {getDurationDisplay(
                              appointment.duration,
                              appointment.durationLabel,
                            )}{' '}
                            previstos ·{' '}
                            {formatCurrency(
                              appointment.expectedAmount,
                              appointment.currency as CurrencyCode,
                            )}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={[
                                'inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-sm font-semibold',
                                isPlannedTimeReached
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700',
                              ].join(' ')}
                            >
                              <Clock3 className="size-4" aria-hidden="true" />
                              {formatElapsedTime(elapsedSeconds)}
                            </span>
                            <span className="text-sm font-medium text-slate-500">
                              {isPlannedTimeReached
                                ? extraMinutes > 0
                                  ? `Tiempo previsto cumplido · +${extraMinutes} min extra`
                                  : 'Tiempo previsto cumplido'
                                : getTimerLabel(appointment, now)}
                            </span>
                          </div>
                          {appointment.completed && (
                            <p className="mt-2 text-sm font-semibold text-emerald-700">
                              Servicio realizado · {actualDuration} min reales
                            </p>
                          )}
                          {appointmentIsReported && (
                            <p className="mt-2 text-sm font-semibold text-emerald-700">
                              Reportado · solo consulta
                            </p>
                          )}
                          {(appointment.reminders ?? []).length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(appointment.reminders ?? []).map((reminder) => (
                                <span
                                  className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-800"
                                  key={reminder.id}
                                >
                                  <Bell className="size-4" aria-hidden="true" />
                                  {formatReminderTime(reminder)}
                                  <span className="text-xs font-semibold text-emerald-600">
                                    {reminderTypeLabels[reminder.type]}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {isClosedSeason ? (
                            <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:!text-slate-200">
                              Solo consulta
                            </span>
                          ) : appointmentIsReported ? (
                            <button
                              className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                              onClick={() => handleRemoveReportedMark(appointment)}
                              type="button"
                            >
                              Quitar marca
                            </button>
                          ) : (
                            <>
                          <button
                            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                            onClick={() => openEditAppointment(appointment)}
                            type="button"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                            <span className="sr-only">Editar cita</span>
                          </button>
                          <button
                            className="inline-flex size-10 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50"
                            onClick={() =>
                              appointment.id && handleDelete(appointment.id)
                            }
                            type="button"
                          >
                            <Trash2 className="size-4" aria-hidden="true" />
                            <span className="sr-only">Eliminar cita</span>
                          </button>
                            </>
                          )}
                        </div>
                      </div>

                      {!appointment.completed && !isClosedSeason && !appointmentIsReported && (
                        <div className="grid gap-2 sm:grid-cols-3">
                          {!hasTimerStarted &&
                            appointment.timerMode !== 'manualPending' && (
                              <button
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-amber-200 px-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-50"
                                onClick={() =>
                                  handleManualPending(appointment)
                                }
                                type="button"
                              >
                                Inicio retrasado
                              </button>
                            )}

                          {(!hasTimerStarted ||
                            appointment.timerMode === 'automatic') && (
                            <button
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                              onClick={() => handleStartTimer(appointment)}
                              type="button"
                            >
                              <Play className="size-4" aria-hidden="true" />
                              {hasTimerStarted
                                ? 'Reiniciar ahora'
                                : 'Iniciar ahora'}
                            </button>
                          )}

                          <button
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 sm:col-span-1"
                            onClick={() =>
                              handleCompleteAppointment(appointment)
                            }
                            type="button"
                          >
                            <Check className="size-4" aria-hidden="true" />
                            Servicio realizado
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

export default AgendaPage
