import 'react-calendar/dist/Calendar.css'

import {
  CalendarCheck,
  Check,
  Clock3,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Calendar from 'react-calendar'

import {
  createAppointment,
  deleteAppointment,
  listAppointments,
  updateAppointment,
} from '../../services/appointmentService'
import { completeAppointmentAsIncome } from '../../services/appointmentCompletionService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Appointment } from '../../types/appointment'
import type { ServiceIncome, ServiceIncomeStatus } from '../../types/service'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import { formatCurrency, getTodayInputDate } from '../../utils/currency'
import { currencies } from '../../utils/countries'
import { getPaymentTypeLabel } from '../../utils/paymentTypes'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const incomeStatusLabels: Record<ServiceIncomeStatus, string> = {
  PENDIENTE: 'Pendiente',
  EJECUCION: 'En ejecución',
  FINALIZADO: 'Finalizado',
}

function getIncomeStatus(income: ServiceIncome): ServiceIncomeStatus {
  return income.status ?? 'PENDIENTE'
}

function getIncomeStatusClass(status: ServiceIncomeStatus) {
  if (status === 'FINALIZADO') {
    return 'bg-emerald-100 text-emerald-800'
  }

  if (status === 'EJECUCION') {
    return 'bg-amber-100 text-amber-800'
  }

  return 'bg-slate-100 text-slate-700'
}

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

function getStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isBeforeToday(date: Date, now: Date) {
  return getStartOfDay(date).getTime() < getStartOfDay(now).getTime()
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

function getIncomeTime(income: ServiceIncome) {
  const dateTime = income.timerStartedAt ?? income.createdAt

  if (!dateTime) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateTime))
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
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null)
  const [date, setDate] = useState(getTodayInputDate())
  const [time, setTime] = useState('15:00')
  const [duration, setDuration] = useState(90)
  const [expectedAmount, setExpectedAmount] = useState(120)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [notes, setNotes] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [now, setNow] = useState(new Date())

  const todayInput = formatInputDate(now)
  const currentTimeInput = formatInputTime(now)
  const isSelectedScheduleInPast = isScheduleInPast(date, time, now)

  const reloadAppointments = useCallback(async () => {
    const currentAppointments = await listAppointments()
    setAppointments(currentAppointments)
  }, [])

  const reloadIncomes = useCallback(async () => {
    const currentIncomes = await listServiceIncomes()
    setIncomes(currentIncomes)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentAppointments, currentIncomes] = await Promise.all([
        getSettings(),
        listAppointments(),
        listServiceIncomes(),
      ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setCurrency(currentSettings.defaultCurrency)
      setAppointments(currentAppointments)
      setIncomes(currentIncomes)
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

  const selectedDateInput = useMemo(
    () => formatInputDate(selectedDate),
    [selectedDate],
  )

  const selectedAppointments = useMemo(
    () =>
      sortAppointments(
        appointments.filter(
          (appointment) =>
            getDateFromDateTime(appointment.dateTime) === selectedDateInput,
        ),
      ),
    [appointments, selectedDateInput],
  )

  const selectedIncomes = useMemo(
    () =>
      incomes.filter((income) => income.date === selectedDateInput),
    [incomes, selectedDateInput],
  )

  function resetForm(nextDate = selectedDateInput) {
    const nextTime =
      nextDate === formatInputDate(new Date()) ? formatInputTime(new Date()) : '15:00'

    setEditingAppointment(null)
    setDate(nextDate)
    setTime(nextTime)
    setDuration(90)
    setExpectedAmount(120)
    setCurrency(settings?.defaultCurrency ?? 'EUR')
    setNotes('')
    setSaveStatus('idle')
  }

  function handleCalendarChange(value: unknown) {
    if (!(value instanceof Date)) {
      return
    }

    if (isBeforeToday(value, now)) {
      return
    }

    setSelectedDate(value)
    resetForm(formatInputDate(value))
  }

  function handleDateChange(nextDate: string) {
    setDate(nextDate)

    if (isScheduleInPast(nextDate, time, now)) {
      setTime(formatInputTime(now))
    }
  }

  function startEditing(appointment: Appointment) {
    setEditingAppointment(appointment)
    setDate(getDateFromDateTime(appointment.dateTime))
    setTime(getTimeFromDateTime(appointment.dateTime))
    setDuration(appointment.duration)
    setExpectedAmount(appointment.expectedAmount)
    setCurrency(appointment.currency as CurrencyCode)
    setNotes(appointment.notes ?? '')
    setSaveStatus('idle')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isScheduleInPast(date, time, now)) {
      setSaveStatus('error')
      return
    }

    setSaveStatus('saving')

    const input = {
      dateTime: `${date}T${time}`,
      duration,
      expectedAmount,
      currency,
      notes: notes.trim(),
      completed: editingAppointment?.completed ?? false,
      timerMode: editingAppointment?.timerMode,
      timerStartedAt: editingAppointment?.timerStartedAt,
      timerStoppedAt: editingAppointment?.timerStoppedAt,
      actualDuration: editingAppointment?.actualDuration,
    }

    try {
      if (editingAppointment?.id) {
        await updateAppointment(editingAppointment.id, input)
      } else {
        await createAppointment(input)
      }

      setSelectedDate(new Date(`${date}T00:00`))
      resetForm(date)
      setSaveStatus('saved')
      await reloadAppointments()
    } catch {
      setSaveStatus('error')
    }
  }

  async function handleDelete(appointmentId: number) {
    await deleteAppointment(appointmentId)
    await reloadAppointments()

    if (editingAppointment?.id === appointmentId) {
      resetForm()
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
    await Promise.all([reloadAppointments(), reloadIncomes()])
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
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-emerald-700">Agenda</p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Citas y servicios
        </h1>
      </header>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
        <section className="flex flex-col gap-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <Calendar
              className="w-full border-none text-sm"
              minDate={getStartOfDay(now)}
              onChange={handleCalendarChange}
              tileDisabled={({ date: tileDate, view }) =>
                view === 'month' && isBeforeToday(tileDate, now)
              }
              value={selectedDate}
            />
          </div>

          <form
            className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            onSubmit={handleSubmit}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">
                {editingAppointment ? 'Editar cita' : 'Crear cita'}
              </h2>
              {editingAppointment && (
                <button
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  onClick={() => resetForm()}
                  type="button"
                >
                  Nueva
                </button>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Fecha
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  min={todayInput}
                  onChange={(event) => handleDateChange(event.target.value)}
                  type="date"
                  value={date}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Hora
                </span>
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
                <span className="text-sm font-medium text-slate-700">
                  Duración
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  min={0}
                  onChange={(event) => setDuration(Number(event.target.value))}
                  type="number"
                  value={duration}
                />
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Valor
                </span>
                <input
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  min={0}
                  onChange={(event) =>
                    setExpectedAmount(Number(event.target.value))
                  }
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
                onChange={(event) =>
                  setCurrency(event.target.value as CurrencyCode)
                }
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

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500" role="status">
                {saveStatus === 'saved' && 'Cita guardada'}
                {saveStatus === 'error' &&
                  (isSelectedScheduleInPast
                    ? 'Selecciona una fecha y hora actual o futura'
                    : 'No se pudo guardar')}
              </p>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={
                  saveStatus === 'saving' ||
                  expectedAmount <= 0 ||
                  isSelectedScheduleInPast
                }
                type="submit"
              >
                <Plus className="size-4" aria-hidden="true" />
                {saveStatus === 'saving' ? 'Guardando' : 'Guardar cita'}
              </button>
            </div>
          </form>
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
            {selectedAppointments.length === 0 && selectedIncomes.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">
                No hay citas para esta fecha.
              </p>
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

                  return (
                    <li
                      className="flex flex-col gap-3 p-4"
                      key={appointment.id}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-slate-950">
                            Cita #{appointment.id ?? '-'}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {getTimeFromDateTime(appointment.dateTime)} ·{' '}
                            {appointment.duration} minutos previstos ·{' '}
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
                              <Clock3
                                className="size-4"
                                aria-hidden="true"
                              />
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
                        </div>

                        <div className="flex gap-2">
                          <button
                            className="inline-flex size-10 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:bg-slate-50"
                            onClick={() => startEditing(appointment)}
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
                        </div>
                      </div>

                      {!appointment.completed && (
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
                {selectedIncomes.map((income) => {
                  const status = getIncomeStatus(income)

                  return (
                    <li className="flex flex-col gap-3 p-4" key={`income-${income.id}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-950">
                              Ingreso #{income.id ?? '-'}
                            </p>
                            <span
                              className={[
                                'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                                getIncomeStatusClass(status),
                              ].join(' ')}
                            >
                              {incomeStatusLabels[status]}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-500">
                            {[getIncomeTime(income), income.city]
                              .filter(Boolean)
                              .join(' · ')}
                            {getIncomeTime(income) || income.city ? ' · ' : ''}
                            {income.actualDuration ?? income.duration} minutos ·{' '}
                            {getPaymentTypeLabel(income.paymentType)}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-emerald-700">
                            Servicio registrado ·{' '}
                            {formatCurrency(
                              income.realGain,
                              income.currency as CurrencyCode,
                            )}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-slate-950">
                            {formatCurrency(
                              income.totalAmount,
                              income.currency as CurrencyCode,
                            )}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Total
                          </p>
                        </div>
                      </div>
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
