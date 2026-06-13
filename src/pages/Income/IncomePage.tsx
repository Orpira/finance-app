import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  Square,
  Trash2,
} from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { currencies } from '../../utils/countries'

import {
  createServiceIncome,
  deleteServiceIncome,
  listServiceIncomes,
  updateServiceIncome,
} from '../../services/incomeService'
import { saveExchangeRate } from '../../services/exchangeRateService'
import { getSettings } from '../../services/settingsService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  type ExchangeRateResolutionSource,
} from '../../services/currencyConversionService'
import type { ServiceIncome, ServiceIncomeStatus } from '../../types/service'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  EUR_COP_DEFAULT_RATE,
  formatCurrency,
  getTodayInputDate,
  roundMoney,
} from '../../utils/currency'
import { getPaymentTypeLabel, paymentTypes } from '../../utils/paymentTypes'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'duplicateHour'
const INCOMES_PER_PAGE = 10

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

function getElapsedSeconds(
  timerStartedAt: string | undefined,
  timerStoppedAt: string | undefined,
  now: Date,
) {
  if (!timerStartedAt) {
    return 0
  }

  const start = new Date(timerStartedAt)
  const end = timerStoppedAt ? new Date(timerStoppedAt) : now

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

function getActualDurationMinutes(
  fallbackDuration: number,
  timerStartedAt: string | undefined,
  timerStoppedAt: string | undefined,
  now: Date,
) {
  if (!timerStartedAt) {
    return fallbackDuration
  }

  return Math.max(
    1,
    Math.ceil(getElapsedSeconds(timerStartedAt, timerStoppedAt, now) / 60),
  )
}

function getHourFromDateTime(dateTime: string | undefined) {
  if (!dateTime) {
    return undefined
  }

  const parsedDate = new Date(dateTime)

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined
  }

  return parsedDate.getHours()
}

function hasIncomeInSameHour(
  incomes: ServiceIncome[],
  date: string,
  dateTime: string,
  excludedIncomeId?: number,
) {
  const hour = getHourFromDateTime(dateTime)

  if (hour === undefined) {
    return false
  }

  return incomes.some((income) => {
    if (excludedIncomeId && income.id === excludedIncomeId) {
      return false
    }

    if (income.date !== date) {
      return false
    }

    const incomeHour = getHourFromDateTime(
      income.timerStartedAt ?? income.createdAt ?? income.timerStoppedAt,
    )

    return incomeHour === hour
  })
}

export function IncomePage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [date, setDate] = useState(getTodayInputDate())
  const [duration, setDuration] = useState(60)
  const [totalAmount, setTotalAmount] = useState(0)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [paymentType, setPaymentType] = useState(paymentTypes[0].value)
  const [percentage, setPercentage] = useState(50)
  const [exchangeRate, setExchangeRate] = useState(EUR_COP_DEFAULT_RATE)
  const [exchangeRateSource, setExchangeRateSource] =
    useState<ExchangeRateResolutionSource>('default')
  const [convertedValues, setConvertedValues] = useState({
    baseCurrencyValue: 0,
    secondaryCurrencyValue: 0,
    eurValue: 0,
    copValue: 0,
  })
  const [timerStartedAt, setTimerStartedAt] = useState<string>()
  const [timerStoppedAt, setTimerStoppedAt] = useState<string>()
  const [now, setNow] = useState(new Date())
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [incomePage, setIncomePage] = useState(1)

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentIncomes] = await Promise.all([
        getSettings(),
        listServiceIncomes({ newestFirst: true }),
      ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setPercentage(currentSettings.incomePercentage)
      setCurrency(currentSettings.defaultCurrency)
      setIncomes(currentIncomes)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [date])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const realGain = useMemo(
    () => roundMoney((totalAmount * percentage) / 100),
    [percentage, totalAmount],
  )

  const elapsedSeconds = useMemo(
    () => getElapsedSeconds(timerStartedAt, timerStoppedAt, now),
    [now, timerStartedAt, timerStoppedAt],
  )

  const effectiveDuration = useMemo(
    () =>
      getActualDurationMinutes(duration, timerStartedAt, timerStoppedAt, now),
    [duration, now, timerStartedAt, timerStoppedAt],
  )
  const totalIncomePages = Math.max(
    1,
    Math.ceil(incomes.length / INCOMES_PER_PAGE),
  )
  const currentIncomePage = Math.min(incomePage, totalIncomePages)
  const paginatedIncomes = useMemo(() => {
    const startIndex = (currentIncomePage - 1) * INCOMES_PER_PAGE

    return incomes.slice(startIndex, startIndex + INCOMES_PER_PAGE)
  }, [currentIncomePage, incomes])

  useEffect(() => {
    let isMounted = true

    async function convertIncomeValue() {
      if (!settings) {
        return
      }

      const conversionOptions = {
        date,
        manualRate: exchangeRate,
        manualEurCopRate: exchangeRate,
        useApi: settings.rateMode === 'automatic',
      }
      const [convertedPairValue, convertedEurCopValue] = await Promise.all([
        convertCurrencyPair(
          realGain,
          currency,
          settings.secondaryCurrency,
          conversionOptions,
        ),
        convertCurrencyToEurCop(realGain, currency, conversionOptions),
      ])

      if (!isMounted) {
        return
      }

      setConvertedValues({
        baseCurrencyValue: convertedPairValue.primaryValue,
        secondaryCurrencyValue: convertedPairValue.secondaryValue,
        eurValue: convertedEurCopValue.eurValue,
        copValue: convertedEurCopValue.copValue,
      })
      setExchangeRate(convertedPairValue.rate)
      setExchangeRateSource(convertedPairValue.source)
    }

    convertIncomeValue()

    return () => {
      isMounted = false
    }
  }, [currency, date, exchangeRate, realGain, settings])

  async function reloadIncomes() {
    const currentIncomes = await listServiceIncomes({ newestFirst: true })
    setIncomes(currentIncomes)
  }

  function handleStartTimer() {
    const startedAt = new Date().toISOString()
    setTimerStartedAt(startedAt)
    setTimerStoppedAt(undefined)
    setDate(startedAt.slice(0, 10))
    setSaveStatus('idle')
  }

  function handleStopTimer() {
    const stoppedAt = new Date().toISOString()
    setTimerStoppedAt(stoppedAt)
    setDuration(
      getActualDurationMinutes(duration, timerStartedAt, stoppedAt, new Date()),
    )
  }

  function handleResetTimer() {
    const restartedAt = new Date().toISOString()
    setTimerStartedAt(restartedAt)
    setTimerStoppedAt(undefined)
    setDate(restartedAt.slice(0, 10))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    setSaveStatus('saving')

    try {
      const registrationDateTime = timerStartedAt ?? new Date().toISOString()

      if (hasIncomeInSameHour(incomes, date, registrationDateTime)) {
        setSaveStatus('duplicateHour')
        return
      }

      const finalTimerStoppedAt = timerStartedAt
        ? (timerStoppedAt ?? new Date().toISOString())
        : undefined
      const finalDuration = getActualDurationMinutes(
        duration,
        timerStartedAt,
        finalTimerStoppedAt,
        new Date(),
      )

      await saveExchangeRate({
        baseCurrency: currency,
        targetCurrency: settings.secondaryCurrency,
        rate: exchangeRate,
        date,
        source:
          settings.rateMode === 'automatic' && exchangeRateSource === 'api'
            ? 'api'
            : 'manual',
      })

      await createServiceIncome({
        date,
        status: timerStartedAt ? 'EJECUCION' : 'PENDIENTE',
        paymentType,
        duration: finalDuration,
        totalAmount,
        currency,
        percentage,
        realGain,
        eurValue: roundMoney(convertedValues.eurValue),
        copValue: roundMoney(convertedValues.copValue),
        exchangeRateUsed: exchangeRate,
        baseCurrency: currency,
        secondaryCurrency: settings.secondaryCurrency,
        baseCurrencyValue: roundMoney(convertedValues.baseCurrencyValue),
        secondaryCurrencyValue: roundMoney(
          convertedValues.secondaryCurrencyValue,
        ),
        exchangeRateBaseToSecondary: exchangeRate,
        actualDuration: finalDuration,
        timerStartedAt,
        timerStoppedAt: finalTimerStoppedAt,
        country: settings.country,
        city: settings.city,
      })

      setTotalAmount(0)
      setPaymentType(paymentTypes[0].value)
      setDuration(60)
      setDate(getTodayInputDate())
      setTimerStartedAt(undefined)
      setTimerStoppedAt(undefined)
      setSaveStatus('saved')
      setIncomePage(1)
      await reloadIncomes()
    } catch {
      setSaveStatus('error')
    }
  }

  async function handleStartIncomeTimer(income: ServiceIncome) {
    if (!income.id || getIncomeStatus(income) === 'FINALIZADO') {
      return
    }

    const startedAt = new Date().toISOString()
    const startedDate = startedAt.slice(0, 10)

    if (hasIncomeInSameHour(incomes, startedDate, startedAt, income.id)) {
      window.alert('Ya existe un ingreso registrado en esa misma hora.')
      return
    }

    await updateServiceIncome(income.id, {
      actualDuration: undefined,
      date: startedDate,
      status: 'EJECUCION',
      timerStartedAt: startedAt,
      timerStoppedAt: undefined,
    })
    await reloadIncomes()
  }

  async function handleCompleteIncome(income: ServiceIncome) {
    if (!income.id || getIncomeStatus(income) === 'FINALIZADO') {
      return
    }

    const stoppedAt = new Date().toISOString()
    const actualDuration = getActualDurationMinutes(
      income.actualDuration ?? income.duration,
      income.timerStartedAt,
      stoppedAt,
      new Date(),
    )

    await updateServiceIncome(income.id, {
      actualDuration,
      status: 'FINALIZADO',
      timerStoppedAt: income.timerStartedAt ? stoppedAt : income.timerStoppedAt,
    })
    await reloadIncomes()
  }

  async function handleDeleteIncome(income: ServiceIncome) {
    if (!income.id) {
      return
    }

    const shouldDelete = window.confirm(
      `¿Eliminar el ingreso #${income.id} del ${income.date}?`,
    )

    if (!shouldDelete) {
      return
    }

    await deleteServiceIncome(income.id)
    await reloadIncomes()
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-emerald-700">Ingresos</p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Registrar ingreso
        </h1>
      </header>

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Fecha</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Duración en minutos
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={0}
              onChange={(event) => setDuration(Number(event.target.value))}
              type="number"
              value={duration}
            />
          </label>
        </div>

        <section className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              Contador de servicio
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 ring-1 ring-slate-200">
                <Clock3 className="size-4" aria-hidden="true" />
                {formatElapsedTime(elapsedSeconds)}
              </span>
              <span className="text-sm font-medium text-slate-500">
                Duración real: {effectiveDuration} min
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={Boolean(timerStartedAt && !timerStoppedAt)}
              onClick={handleStartTimer}
              title="Iniciar contador"
              type="button"
            >
              <Play className="size-4" aria-hidden="true" />
              <span className="sr-only">Iniciar contador</span>
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={!timerStartedAt || Boolean(timerStoppedAt)}
              onClick={handleStopTimer}
              title="Detener contador"
              type="button"
            >
              <Square className="size-4" aria-hidden="true" />
              <span className="sr-only">Detener contador</span>
            </button>
            <button
              className="inline-flex h-10 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              disabled={!timerStartedAt}
              onClick={handleResetTimer}
              title="Reiniciar contador"
              type="button"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="sr-only">Reiniciar contador</span>
            </button>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Importe total
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={0}
              onChange={(event) => setTotalAmount(Number(event.target.value))}
              step="0.01"
              type="number"
              value={totalAmount}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Moneda</span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
              value={currency}
            >
              {currencies.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <span className="text-xs font-medium text-slate-500">
              Según el país seleccionado en Configuración
            </span>
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Tipo de pago
            </span>
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setPaymentType(event.target.value)}
              value={paymentType}
            >
              {paymentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Porcentaje de ganancia
            </span>
            <div className="flex items-center gap-3">
              <input
                className="h-11 w-28 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                max={100}
                min={0}
                onChange={(event) => setPercentage(Number(event.target.value))}
                type="number"
                value={percentage}
              />
              <span className="text-sm font-medium text-slate-500">%</span>
            </div>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Cambio {currency} a {settings.secondaryCurrency}
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              disabled={settings.rateMode === 'automatic'}
              min={1}
              onChange={(event) => setExchangeRate(Number(event.target.value))}
              step="0.01"
              type="number"
              value={exchangeRate}
            />
            <span className="text-xs font-medium text-slate-500">
              {settings.rateMode === 'automatic'
                ? exchangeRateSource === 'api'
                  ? 'API online'
                  : exchangeRateSource === 'offline'
                    ? 'Fallback offline'
                    : 'Tasa por defecto'
                : 'Manual'}
            </span>
          </label>
        </div>

        <div className="grid gap-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase text-emerald-700">
              Ganancia real
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {formatCurrency(realGain, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-emerald-700">
              Valor {currency}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {formatCurrency(convertedValues.baseCurrencyValue, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-emerald-700">
              Valor {settings.secondaryCurrency}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {formatCurrency(
                convertedValues.secondaryCurrencyValue,
                settings.secondaryCurrency,
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500" role="status">
            {saveStatus === 'saved' && 'Ingreso guardado'}
            {saveStatus === 'duplicateHour' &&
              'Ya existe un ingreso registrado en esa misma hora'}
            {saveStatus === 'error' && 'No se pudo guardar'}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={saveStatus === 'saving' || totalAmount <= 0}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saveStatus === 'saving' ? 'Guardando' : 'Guardar ingreso'}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="size-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">
            Ingresos recientes
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {incomes.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Todavía no hay ingresos registrados.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {paginatedIncomes.map((income) => {
                const status = getIncomeStatus(income)
                const isFinalized = status === 'FINALIZADO'
                const elapsedSeconds = getElapsedSeconds(
                  income.timerStartedAt,
                  income.timerStoppedAt,
                  now,
                )

                return (
                  <li className="flex flex-col gap-3 p-4" key={income.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-slate-950">
                            #{income.id ?? '-'} · {income.date}
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
                          {income.actualDuration ?? income.duration} min ·{' '}
                          {income.percentage}% ·{' '}
                          {getPaymentTypeLabel(income.paymentType)}
                        </p>
                        {income.timerStartedAt && (
                          <p className="mt-1 text-sm font-medium text-slate-500">
                            Contador: {formatElapsedTime(elapsedSeconds)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950">
                          {formatCurrency(
                            income.realGain,
                            income.currency as CurrencyCode,
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatCurrency(income.eurValue, 'EUR')}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isFinalized}
                        onClick={() => handleStartIncomeTimer(income)}
                        type="button"
                      >
                        <Play className="size-4" aria-hidden="true" />
                        {income.timerStartedAt ? 'Reiniciar' : 'Iniciar'}
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        disabled={isFinalized}
                        onClick={() => handleCompleteIncome(income)}
                        type="button"
                      >
                        <Check className="size-4" aria-hidden="true" />
                        Cumplido
                      </button>
                      <button
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-rose-200 px-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                        onClick={() => handleDeleteIncome(income)}
                        type="button"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Eliminar
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {incomes.length > INCOMES_PER_PAGE ? (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-500">
              Página {currentIncomePage} de {totalIncomePages} · {incomes.length}{' '}
              registros
            </p>
            <div className="flex items-center gap-2">
              <button
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentIncomePage === 1}
                onClick={() =>
                  setIncomePage((currentPage) => Math.max(1, currentPage - 1))
                }
                type="button"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </button>
              <button
                className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={currentIncomePage === totalIncomePages}
                onClick={() =>
                  setIncomePage((currentPage) =>
                    Math.min(totalIncomePages, currentPage + 1),
                  )
                }
                type="button"
              >
                Siguiente
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

export default IncomePage
