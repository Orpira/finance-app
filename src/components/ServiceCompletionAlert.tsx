import { BellRing, CheckCircle2, Clock3 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ServiceIncome } from '../types/service'
import { playPriorityAlarm } from '../utils/alarm'
import { calculateEffectiveDuration } from '../utils/serviceDuration'
import {
  dismissServiceTimer,
  isServiceTimerDue,
  listTrackedServiceIncomes,
  markServiceTimerCompleted,
} from '../services/serviceTimerService'

function formatRemainingSeconds(seconds: number) {
  const total = Math.max(0, seconds)
  const minutes = Math.floor(total / 60)
  const restSeconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(restSeconds).padStart(2, '0')}`
}

function resolvePendingAlert(incomes: ServiceIncome[]) {
  return incomes
    .filter((income) => income.id && (income.timerStatus === 'completed' || income.timerStatus === 'notified'))
    .sort((a, b) => {
      const aDate = Date.parse(a.timerCompletedAt ?? a.timerEndsAt ?? a.createdAt ?? '')
      const bDate = Date.parse(b.timerCompletedAt ?? b.timerEndsAt ?? b.createdAt ?? '')
      return (Number.isNaN(aDate) ? 0 : aDate) - (Number.isNaN(bDate) ? 0 : bDate)
    })[0]
}

export function ServiceCompletionAlert() {
  const [trackedIncomes, setTrackedIncomes] = useState<ServiceIncome[]>([])
  const [now, setNow] = useState(() => new Date())
  const [activeIncomeId, setActiveIncomeId] = useState<number | null>(null)
  const [isDismissing, setIsDismissing] = useState(false)
  const processingIdsRef = useRef<Set<number>>(new Set())

  const reloadTrackedIncomes = useCallback(async () => {
    const incomes = await listTrackedServiceIncomes()
    setTrackedIncomes(incomes)
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadInitial() {
      const incomes = await listTrackedServiceIncomes()
      if (mounted) setTrackedIncomes(incomes)
    }

    loadInitial()

    const tickIntervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)
    const reloadIntervalId = window.setInterval(() => {
      reloadTrackedIncomes()
    }, 5000)

    window.addEventListener('focus', reloadTrackedIncomes)

    return () => {
      mounted = false
      window.clearInterval(tickIntervalId)
      window.clearInterval(reloadIntervalId)
      window.removeEventListener('focus', reloadTrackedIncomes)
    }
  }, [reloadTrackedIncomes])

  useEffect(() => {
    const dueIncomes = trackedIncomes.filter((income) => income.id && isServiceTimerDue(income, now))
    if (dueIncomes.length === 0) return

    let cancelled = false

    async function processDueIncomes() {
      for (const income of dueIncomes) {
        if (!income.id) continue
        if (processingIdsRef.current.has(income.id)) continue

        processingIdsRef.current.add(income.id)
        try {
          await markServiceTimerCompleted(income.id, now)
        } finally {
          processingIdsRef.current.delete(income.id)
        }
      }

      if (!cancelled) {
        await reloadTrackedIncomes()
      }
    }

    processDueIncomes()

    return () => {
      cancelled = true
    }
  }, [now, reloadTrackedIncomes, trackedIncomes])

  const activeIncome = useMemo(
    () => trackedIncomes.find((income) => income.id === activeIncomeId) ?? null,
    [activeIncomeId, trackedIncomes],
  )

  useEffect(() => {
    if (activeIncomeId) return

    const pendingAlert = resolvePendingAlert(trackedIncomes)
    if (!pendingAlert?.id) return

    const timeoutId = window.setTimeout(() => {
      setActiveIncomeId(pendingAlert.id as number)
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [activeIncomeId, trackedIncomes])

  useEffect(() => {
    if (!activeIncome) return

    playPriorityAlarm()

    const intervalId = window.setInterval(() => {
      playPriorityAlarm()
    }, 3500)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [activeIncome])

  const runningIncomes = useMemo(
    () => trackedIncomes.filter((income) => income.timerStatus === 'running' || income.timerStatus === 'pending'),
    [trackedIncomes],
  )

  const nextRunning = useMemo(
    () => runningIncomes
      .filter((income) => income.timerEndsAt)
      .sort((a, b) => Date.parse(a.timerEndsAt as string) - Date.parse(b.timerEndsAt as string))[0],
    [runningIncomes],
  )

  async function handleDismissAlert() {
    if (!activeIncome?.id) return

    setIsDismissing(true)
    await dismissServiceTimer(activeIncome.id)
    await reloadTrackedIncomes()
    setActiveIncomeId(null)
    setIsDismissing(false)
  }

  const nextRemainingSeconds = nextRunning?.timerEndsAt
    ? Math.max(0, Math.floor((Date.parse(nextRunning.timerEndsAt) - now.getTime()) / 1000))
    : null

  return (
    <>
      {runningIncomes.length > 0 && nextRemainingSeconds !== null && (
        <div className="fixed left-3 top-3 z-75 rounded-lg border border-emerald-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Servicios activos: {runningIncomes.length}
          </p>
          <p className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock3 className="size-4" aria-hidden="true" />
            Próximo fin en {formatRemainingSeconds(nextRemainingSeconds)}
          </p>
        </div>
      )}

      {activeIncome && (
        <div
          aria-labelledby="global-service-completed-title"
          aria-modal="true"
          className="fixed inset-0 z-120 flex items-end bg-slate-950/80 p-4 backdrop-blur-sm sm:items-center sm:justify-center"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-xl border-2 border-emerald-300 bg-white p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
                <BellRing className="size-6" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase text-emerald-700">
                  Alarma de servicio
                </p>
                <h2
                  className="mt-1 text-2xl font-semibold text-slate-950"
                  id="global-service-completed-title"
                >
                  Servicio finalizado
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Se completaron {calculateEffectiveDuration(activeIncome)} minutos programados.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-slate-700">
              <p><strong>Fecha:</strong> {activeIncome.date}</p>
              <p><strong>Valor:</strong> {activeIncome.totalAmount} {activeIncome.currency}</p>
              {activeIncome.city && <p><strong>Ciudad:</strong> {activeIncome.city}</p>}
              {activeIncome.paymentType && <p><strong>Método de pago:</strong> {activeIncome.paymentType}</p>}
            </div>

            <button
              className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={isDismissing}
              onClick={handleDismissAlert}
              type="button"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Confirmar y detener alarma
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ServiceCompletionAlert