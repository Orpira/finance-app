import 'react-calendar/dist/Calendar.css'

import {
  Bell,
  CalendarCheck,
  Check,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Calendar from 'react-calendar'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { CollapsibleFilters } from '../../components/filters/CollapsibleFilters'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  deleteAppointment,
  listAppointments,
  startAppointmentService,
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
import { isReported } from '../../catalogs/reportStatuses'

// Agenda no muestra cronómetros ni cuentas regresivas: los avisos de tiempo
// son responsabilidad exclusiva del sistema de alarmas (AppointmentReminderAlert,
// ServiceTimeAlert). Este `now` solo se usa para decidir si una cita ya
// alcanzó su fecha/hora programada, por lo que no necesita precisión de
// segundo a segundo.
const AVAILABILITY_CHECK_INTERVAL_MS = 20_000

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

// Las horas reales (timerStartedAt/timerStoppedAt) se guardan con
// toISOString() (UTC); a diferencia de dateTime (naive, ya en hora local),
// necesitan pasar por Date para mostrarse en la hora local del dispositivo.
function formatClockTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AgendaPage() {
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
    }, AVAILABILITY_CHECK_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

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

  // Protección UI contra múltiples pulsaciones: mientras una cita está en
  // proceso (iniciando o finalizando) se ignoran nuevas pulsaciones sobre
  // ella. La protección real e idempotente vive en el dominio
  // (startAppointmentService / completeAppointmentAsIncome); esto es solo
  // una primera barrera para evitar disparar llamadas redundantes.
  const processingAppointmentIdsRef = useRef<Set<number>>(new Set())
  const [processingAppointmentIds, setProcessingAppointmentIds] = useState<Set<number>>(
    new Set(),
  )

  async function runExclusive(appointmentId: number, action: () => Promise<unknown>) {
    if (processingAppointmentIdsRef.current.has(appointmentId)) {
      return
    }

    processingAppointmentIdsRef.current.add(appointmentId)
    setProcessingAppointmentIds(new Set(processingAppointmentIdsRef.current))

    try {
      await action()
    } catch (error) {
      console.warn('[Agenda] Operación rechazada por el dominio.', error)
    } finally {
      processingAppointmentIdsRef.current.delete(appointmentId)
      setProcessingAppointmentIds(new Set(processingAppointmentIdsRef.current))
    }
  }

  async function handleStartService(appointment: Appointment) {
    if (!appointment.id) {
      return
    }

    await runExclusive(appointment.id, async () => {
      await startAppointmentService(appointment.id as number, new Date())
      await reloadAppointments()
    })
  }

  async function handleCompleteAppointment(appointment: Appointment) {
    if (!settings || !appointment.id) {
      return
    }

    await runExclusive(appointment.id, async () => {
      await completeAppointmentAsIncome(appointment.id as number, settings, new Date())
      await reloadAppointments()
    })
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
                  const hasTimerStarted = Boolean(appointment.timerStartedAt)
                  const scheduledStartTime = new Date(appointment.dateTime).getTime()
                  const isAvailable = now.getTime() >= scheduledStartTime
                  const isDelayed =
                    !hasTimerStarted &&
                    !appointment.completed &&
                    now.getTime() > scheduledStartTime
                  const isProcessing = Boolean(
                    appointment.id && processingAppointmentIds.has(appointment.id),
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
                        isHighlighted
                          ? 'bg-emerald-50/70 ring-2 ring-inset ring-emerald-300 dark:bg-emerald-950/70 dark:ring-emerald-700'
                          : '',
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
                          {appointment.completed ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                              <span className="font-semibold text-emerald-700">
                                ✓ Servicio realizado
                              </span>
                              {appointment.timerStartedAt && (
                                <span>
                                  Inicio real: {formatClockTime(appointment.timerStartedAt)}
                                </span>
                              )}
                              {appointment.timerStoppedAt && (
                                <span>
                                  · Fin real: {formatClockTime(appointment.timerStoppedAt)}
                                </span>
                              )}
                              {appointment.actualDuration !== undefined && (
                                <span>· Duración: {appointment.actualDuration} min</span>
                              )}
                            </div>
                          ) : hasTimerStarted ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-2 rounded-md bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-800">
                                ● Servicio en curso
                              </span>
                              <span className="text-sm font-medium text-slate-500">
                                Inicio real:{' '}
                                {formatClockTime(appointment.timerStartedAt as string)}
                              </span>
                            </div>
                          ) : isDelayed ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-2 rounded-md bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-800">
                                Inicio retrasado
                              </span>
                            </div>
                          ) : (
                            <p className="mt-3 text-sm font-medium text-slate-500">
                              Disponible a las {getTimeFromDateTime(appointment.dateTime)}
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
                            <span className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-600 dark:!text-slate-200">
                              Solo consulta
                            </span>
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
                        <div className="flex flex-wrap gap-2">
                          {hasTimerStarted ? (
                            <button
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                              disabled={isProcessing}
                              onClick={() => handleCompleteAppointment(appointment)}
                              type="button"
                            >
                              <Check className="size-4" aria-hidden="true" />
                              Servicio realizado
                            </button>
                          ) : (
                            <button
                              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={!isAvailable || isProcessing}
                              onClick={() => handleStartService(appointment)}
                              type="button"
                            >
                              <Play className="size-4" aria-hidden="true" />
                              Iniciar servicio
                            </button>
                          )}
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
