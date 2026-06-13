import { BellRing, Check, Clock3 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  listAppointments,
  updateAppointment,
} from '../services/appointmentService'
import {
  completeAppointmentAsIncome,
  getAppointmentActualDuration,
} from '../services/appointmentCompletionService'
import { getSettings } from '../services/settingsService'
import type { Appointment } from '../types/appointment'
import type { AppSettings } from '../types/settings'

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

function playPriorityAlarm() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext

    if (!AudioContextClass) {
      return
    }

    const audioContext = new AudioContextClass()
    const startTime = audioContext.currentTime
    const gain = audioContext.createGain()

    gain.connect(audioContext.destination)
    gain.gain.setValueAtTime(0.0001, startTime)
    gain.gain.exponentialRampToValueAtTime(0.42, startTime + 0.03)
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.2)

    ;[0, 0.34, 0.68, 1.12, 1.46].forEach((offset, index) => {
      const oscillator = audioContext.createOscillator()

      oscillator.type = index % 2 === 0 ? 'square' : 'sawtooth'
      oscillator.frequency.setValueAtTime(980, startTime + offset)
      oscillator.frequency.setValueAtTime(720, startTime + offset + 0.14)
      oscillator.connect(gain)
      oscillator.start(startTime + offset)
      oscillator.stop(startTime + offset + 0.22)
    })

    window.navigator.vibrate?.([350, 120, 350, 120, 500])

    window.setTimeout(() => {
      audioContext.close()
    }, 2400)
  } catch {
    window.navigator.vibrate?.([350, 120, 350])
  }
}

export function ServiceTimeAlert() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [now, setNow] = useState(new Date())
  const [activeAppointmentId, setActiveAppointmentId] = useState<number | null>(
    null,
  )
  const [extensionMinutes, setExtensionMinutes] = useState(15)
  const [isSaving, setIsSaving] = useState(false)

  const activeAppointment = useMemo(
    () =>
      appointments.find((appointment) => appointment.id === activeAppointmentId),
    [activeAppointmentId, appointments],
  )

  const reloadAppointments = useCallback(async () => {
    const currentAppointments = await listAppointments()
    setAppointments(currentAppointments)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentAppointments] = await Promise.all([
        getSettings(),
        listAppointments(),
      ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setAppointments(currentAppointments)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
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
    }
  }, [reloadAppointments])

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

  useEffect(() => {
    if (activeAppointmentId) {
      return
    }

    const appointmentWithCompletedTime = appointments.find(
      (appointment) =>
        appointment.id &&
        !appointment.completed &&
        appointment.timerStartedAt &&
        !appointment.timerStoppedAt &&
        appointment.duration > 0 &&
        getElapsedSeconds(appointment, now) >= appointment.duration * 60,
    )

    if (!appointmentWithCompletedTime?.id) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setActiveAppointmentId(appointmentWithCompletedTime.id as number)
      setExtensionMinutes(15)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeAppointmentId, appointments, now])

  useEffect(() => {
    if (!activeAppointment) {
      return
    }

    playPriorityAlarm()

    const intervalId = window.setInterval(() => {
      playPriorityAlarm()
    }, 3500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeAppointment])

  async function handleContinue() {
    if (!activeAppointment?.id || extensionMinutes <= 0) {
      return
    }

    setIsSaving(true)
    await updateAppointment(activeAppointment.id, {
      duration: activeAppointment.duration + extensionMinutes,
    })
    await reloadAppointments()
    setActiveAppointmentId(null)
    setIsSaving(false)
  }

  async function handleFinish() {
    if (!activeAppointment || !settings) {
      return
    }

    setIsSaving(true)
    await completeAppointmentAsIncome(activeAppointment, settings, now)
    await reloadAppointments()
    setActiveAppointmentId(null)
    setIsSaving(false)
  }

  if (!activeAppointment) {
    return null
  }

  const elapsedSeconds = getElapsedSeconds(activeAppointment, now)
  const actualDuration = getAppointmentActualDuration(activeAppointment, now)
  const extraMinutes = Math.max(
    0,
    Math.floor(elapsedSeconds / 60) - activeAppointment.duration,
  )

  return (
    <div
      aria-labelledby="global-service-time-alert-title"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-end bg-slate-950/75 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border-2 border-amber-300 bg-white p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <BellRing className="size-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-amber-700">
              Alarma de servicio
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-slate-950"
              id="global-service-time-alert-title"
            >
              Tiempo previsto cumplido
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Esta cita alcanzó {activeAppointment.duration} minutos. Decide si
              continúas o finalizas el servicio ahora.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-amber-700">
              Cronómetro
            </p>
            <p className="mt-1 inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
              <Clock3 className="size-5" aria-hidden="true" />
              {formatElapsedTime(elapsedSeconds)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-amber-700">
              Duración real
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {actualDuration} min
            </p>
            {extraMinutes > 0 && (
              <p className="mt-1 text-sm font-medium text-amber-700">
                +{extraMinutes} min extra
              </p>
            )}
          </div>
        </div>

        <label className="mt-4 flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">
            Continuar por cuántos minutos más
          </span>
          <input
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            min={1}
            onChange={(event) => setExtensionMinutes(Number(event.target.value))}
            step={5}
            type="number"
            value={extensionMinutes}
          />
        </label>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
            disabled={isSaving || extensionMinutes <= 0}
            onClick={handleContinue}
            type="button"
          >
            Continuar
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={isSaving || !settings}
            onClick={handleFinish}
            type="button"
          >
            <Check className="size-4" aria-hidden="true" />
            Finalizar servicio
          </button>
        </div>
      </div>
    </div>
  )
}

export default ServiceTimeAlert
