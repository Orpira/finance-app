import { Plus } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { currencies } from '../../utils/countries'

import { PageHeader } from '../../components/layout/PageHeader'
import {
  createServiceIncome,
  getServiceIncomeById,
  listServiceIncomes,
  updateServiceIncome,
} from '../../services/incomeService'
import { saveExchangeRate } from '../../services/exchangeRateService'
import { getSettings } from '../../services/settingsService'
import { ensureActiveEarningPeriod } from '../../services/earningPeriodService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  type ExchangeRateResolutionSource,
} from '../../services/currencyConversionService'
import type { ServiceIncome } from '../../types/service'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  EUR_COP_DEFAULT_RATE,
  formatCurrency,
  getTodayInputDate,
  roundMoney,
} from '../../utils/currency'
import { paymentTypes } from '../../utils/paymentTypes'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'

type SaveStatus = 'idle' | 'saving' | 'error' | 'duplicateHour'

function getTimeFromDateTime(dateTime: string | undefined) {
  if (!dateTime) {
    return undefined
  }

  const parsedDate = new Date(dateTime)

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined
  }

  return formatInputTime(parsedDate)
}

function formatInputTime(date: Date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function hasIncomeAtSameDateTime(
  incomes: ServiceIncome[],
  date: string,
  dateTime: string,
  excludedIncomeId?: number,
) {
  const time = getTimeFromDateTime(dateTime)

  if (time === undefined) {
    return false
  }

  return incomes.some((income) => {
    if (excludedIncomeId && income.id === excludedIncomeId) {
      return false
    }

    if (income.date !== date) {
      return false
    }

    const incomeTime = getTimeFromDateTime(
      income.timerStartedAt ?? income.createdAt ?? income.timerStoppedAt,
    )

    return incomeTime === time
  })
}

export function IncomePage() {
  const { incomeId } = useParams()
  const navigate = useNavigate()
  const parsedIncomeId = incomeId ? Number(incomeId) : null
  const isEditing = Number.isFinite(parsedIncomeId) && parsedIncomeId !== null
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activePeriod, setActivePeriod] = useState<EarningPeriod | null>(null)
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [editingIncome, setEditingIncome] = useState<ServiceIncome | null>(null)
  const [date, setDate] = useState(getTodayInputDate())
  const [time, setTime] = useState(() => formatInputTime(new Date()))
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
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentIncomes, currentIncome] = await Promise.all([
        getSettings(),
        listServiceIncomes({ newestFirst: true }),
        parsedIncomeId ? getServiceIncomeById(parsedIncomeId) : undefined,
      ])
      const currentPeriod = await ensureActiveEarningPeriod(currentSettings)

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setActivePeriod(currentPeriod)
      setIncomes(currentIncomes)

      if (currentIncome) {
        if (
          isLocationSeasonClosed(
            currentIncome,
            currentSettings.closedLocationSeasons,
          )
        ) {
          window.alert(
            'Este ingreso pertenece a una temporada cerrada. Solo puede consultarse desde el historial y usarse en reportes.',
          )
          navigate('/income', { replace: true })
          return
        }

        setEditingIncome(currentIncome)
        setDate(currentIncome.date)
        setTime(
          getTimeFromDateTime(
            currentIncome.timerStartedAt ??
              currentIncome.createdAt ??
              currentIncome.timerStoppedAt,
          ) ?? formatInputTime(new Date()),
        )
        setDuration(currentIncome.actualDuration ?? currentIncome.duration)
        setTotalAmount(currentIncome.totalAmount)
        setCurrency(currentIncome.currency as CurrencyCode)
        setPaymentType(currentIncome.paymentType ?? paymentTypes[0].value)
        setPercentage(currentIncome.percentage)
        setExchangeRate(
          currentIncome.exchangeRateBaseToSecondary ??
            currentIncome.exchangeRateUsed ??
            EUR_COP_DEFAULT_RATE,
        )
      } else {
        setPercentage(currentPeriod.percentage)
        setCurrency(currentSettings.defaultCurrency)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [navigate, parsedIncomeId])

  const realGain = useMemo(
    () => roundMoney((totalAmount * percentage) / 100),
    [percentage, totalAmount],
  )

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    setSaveStatus('saving')

    try {
      const registrationDateTime = `${date}T${time}`

      if (
        hasIncomeAtSameDateTime(
          incomes,
          date,
          registrationDateTime,
          parsedIncomeId ?? undefined,
        )
      ) {
        setSaveStatus('duplicateHour')
        return
      }

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

      const incomeInput = {
        createdAt: registrationDateTime,
        date,
        status: editingIncome?.status ?? 'FINALIZADO',
        paymentType,
        duration,
        totalAmount,
        currency,
        earningPeriodId: editingIncome?.earningPeriodId ?? activePeriod?.id,
        earningPercentage:
          editingIncome?.earningPercentage ??
          editingIncome?.percentage ??
          activePeriod?.percentage ??
          percentage,
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
        actualDuration: duration,
        country: editingIncome?.country ?? settings.country,
        city: editingIncome?.city ?? settings.city,
      }

      if (isEditing && parsedIncomeId) {
        await updateServiceIncome(parsedIncomeId, incomeInput)
        navigate('/income')
        return
      }

      await createServiceIncome(incomeInput)
      navigate('/income')
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

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Ingresos"
        backTo="/income"
        eyebrow="Ingresos"
        title={isEditing ? 'Modificar ingreso' : 'Registrar ingreso'}
      />

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Fecha</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Hora</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setTime(event.target.value)}
              required
              type="time"
              value={time}
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
                className="h-11 w-28 rounded-md border border-slate-300 bg-slate-50 px-3 text-base text-slate-950 outline-none"
                disabled
                max={100}
                min={0}
                type="number"
                value={percentage}
              />
              <span className="text-sm font-medium text-slate-500">%</span>
            </div>
            <span className="text-xs font-medium text-slate-500">
              Período activo: {activePeriod?.name ?? 'Actual'}
            </span>
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
            {saveStatus === 'duplicateHour' &&
              'Ya existe un ingreso registrado en esa misma fecha y hora'}
            {saveStatus === 'error' && 'No se pudo guardar'}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={saveStatus === 'saving' || totalAmount <= 0 || !date || !time}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saveStatus === 'saving'
              ? 'Guardando'
              : isEditing
                ? 'Actualizar ingreso'
                : 'Guardar ingreso'}
          </button>
        </div>
      </form>
    </section>
  )
}

export default IncomePage
