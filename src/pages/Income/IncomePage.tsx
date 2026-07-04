import { Plus } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ServiceDurationSelect } from '../../components/forms/ServiceDurationSelect'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  createServiceIncome,
  getServiceIncomeById,
  listServiceIncomes,
  updateServiceIncome,
} from '../../services/incomeService'
import { saveExchangeRate } from '../../services/exchangeRateService'
import { getSettings } from '../../services/settingsService'
import { getActiveEarningPeriod, isEarningPeriodClosed } from '../../services/earningPeriodService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  type ExchangeRateResolutionSource,
} from '../../services/currencyConversionService'
import type { ServiceIncome, ServiceIncomeType } from '../../types/service'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  EUR_COP_DEFAULT_RATE,
  roundMoney,
} from '../../utils/currency'
import { paymentTypes } from '../../utils/paymentTypes'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import {
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
} from '../../utils/usageMode'
import {
  getIncomeType,
  isAdjustmentIncome,
  isServiceIncome,
} from '../../utils/incomeTypes'
import {
  getNumericDurationLabel,
  getServiceDurationOption,
  isServiceDurationLabel,
  type ServiceDurationLabel,
} from '../../utils/serviceDuration'
import { isReported } from '../../catalogs/reportStatuses'
import { useDialog } from '../../components/dialogs/useDialog'

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

function formatInputDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatReadOnlyDateTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
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
  const { alert } = useDialog()
  const { incomeId } = useParams()
  const navigate = useNavigate()
  const parsedIncomeId = incomeId ? Number(incomeId) : null
  const isEditing = Number.isFinite(parsedIncomeId) && parsedIncomeId !== null
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activePeriod, setActivePeriod] = useState<EarningPeriod | null>(null)
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [editingIncome, setEditingIncome] = useState<ServiceIncome | null>(null)
  const [incomeType, setIncomeType] = useState<ServiceIncomeType>('ingreso')
  const [date, setDate] = useState(() => formatInputDate(new Date()))
  const [duration, setDuration] = useState(0)
  const [durationLabel, setDurationLabel] =
    useState<ServiceDurationLabel | ''>('')
  const [durationSelectionChanged, setDurationSelectionChanged] =
    useState(false)
  const [totalAmount, setTotalAmount] = useState(0)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [paymentType, setPaymentType] = useState(paymentTypes[0].value)
  const [notes, setNotes] = useState('')
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
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentIncomes, currentIncome] = await Promise.all([
        getSettings(),
        listServiceIncomes({ newestFirst: true }),
        parsedIncomeId ? getServiceIncomeById(parsedIncomeId) : undefined,
      ])
      const currentPeriod = await getActiveEarningPeriod()

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setActivePeriod(currentPeriod ?? null)
      setIncomes(
        currentIncomes.filter((income) =>
          recordBelongsToUsageMode(income, currentSettings.usageMode),
        ),
      )

      if (currentIncome) {
        if (
          !recordBelongsToUsageMode(
            currentIncome,
            currentSettings.usageMode,
          )
        ) {
          await alert({
            type: 'warning',
            title: 'Ingreso no disponible',
            message: 'Este ingreso pertenece a otro modo de uso.',
          })
          navigate('/income', { replace: true })
          return
        }

        if (isReported(currentIncome)) {
          await alert({
            type: 'info',
            title: 'Ingreso reportado',
            message: 'Este ingreso ya fue reportado y solo puede consultarse.',
          })
          navigate('/income', { replace: true })
          return
        }

        if (
          requiresSeason(currentSettings) &&
          ((await isEarningPeriodClosed(
            currentIncome.earningPeriodId ?? currentIncome.seasonPeriodId,
          )) ||
            isLocationSeasonClosed(
              currentIncome,
              currentSettings.closedLocationSeasons,
            ))
        ) {
          await alert({
            type: 'info',
            title: 'Temporada cerrada',
            message: 'Este ingreso pertenece a una temporada cerrada. Solo puede consultarse desde el historial y usarse en reportes.',
          })
          navigate('/income', { replace: true })
          return
        }

        setEditingIncome(currentIncome)
        setIncomeType(getIncomeType(currentIncome))
        setDate(currentIncome.date)
        const currentDuration =
          currentIncome.actualDuration ?? currentIncome.duration
        setDuration(currentDuration)
        setDurationLabel(
          isServiceDurationLabel(currentIncome.durationLabel)
            ? currentIncome.durationLabel
            : getNumericDurationLabel(currentDuration) ?? '',
        )
        setDurationSelectionChanged(false)
        setTotalAmount(currentIncome.totalAmount)
        setCurrency(currentIncome.currency as CurrencyCode)
        setPaymentType(currentIncome.paymentType ?? paymentTypes[0].value)
        setNotes(currentIncome.notes ?? '')
        setPercentage(currentIncome.percentage ?? 0)
        setExchangeRate(
          currentIncome.exchangeRateBaseToSecondary ??
            currentIncome.exchangeRateUsed ??
            EUR_COP_DEFAULT_RATE,
        )
      } else {
        setPercentage(currentPeriod?.percentage ?? currentSettings.incomePercentage)
        setCurrency(
          (currentPeriod?.baseCurrency as CurrencyCode | undefined) ??
            currentSettings.defaultCurrency,
        )
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [alert, navigate, parsedIncomeId])

  const isBasicUser = isBasicMode(settings ?? undefined)
  const isServiceType = isBasicUser || isServiceIncome({ type: incomeType })
  const usesServiceDuration = !isBasicUser && isServiceType
  const isAdjustmentType = !isBasicUser && isAdjustmentIncome({ type: incomeType })
  const realGain = useMemo(
    () =>
      roundMoney(
        isBasicUser || isAdjustmentType
          ? totalAmount
          : isServiceType
            ? (totalAmount * percentage) / 100
            : editingIncome?.realGain ?? totalAmount,
      ),
    [editingIncome?.realGain, isAdjustmentType, isBasicUser, isServiceType, percentage, totalAmount],
  )

  useEffect(() => {
    let isMounted = true

    async function convertIncomeValue() {
      if (!settings) {
        return
      }

      const conversionOptions = {
        date,
        manualRate:
          settings.rateMode === 'manual' && isEditing
            ? exchangeRate
            : undefined,
        manualEurCopRate:
          settings.rateMode === 'manual' && isEditing
            ? exchangeRate
            : undefined,
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
  }, [currency, date, exchangeRate, isEditing, realGain, settings])

  function handleDurationChange(nextLabel: ServiceDurationLabel) {
    const selectedOption = getServiceDurationOption(nextLabel)

    if (!selectedOption) {
      return
    }

    setDuration(selectedOption.durationMinutes)
    setDurationLabel(selectedOption.durationLabel)
    setDurationSelectionChanged(true)
    setSaveError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    if (usesServiceDuration && !durationLabel) {
      setSaveStatus('error')
      setSaveError('Selecciona una duración antes de guardar.')
      return
    }

    setSaveStatus('saving')
    setSaveError('')

    try {
      const now = new Date()
      const registrationDate = isEditing ? date : formatInputDate(now)
      const registrationDateTime = `${registrationDate}T${formatInputTime(now)}`

      if (
        !isEditing &&
        !isBasicUser &&
        isServiceType &&
        hasIncomeAtSameDateTime(
          incomes,
          registrationDate,
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
        date: registrationDate,
        source:
          settings.rateMode === 'automatic' && exchangeRateSource === 'api'
            ? 'api'
            : 'manual',
      })

      const incomeValues = {
        status: editingIncome?.status ?? 'FINALIZADO',
        type: isBasicUser ? 'ingreso' : incomeType,
        date: registrationDate,
        paymentType: isAdjustmentType ? undefined : paymentType,
        duration: isBasicUser
          ? editingIncome?.duration ?? 0
          : isAdjustmentType
            ? 0
            : duration,
        durationLabel: isBasicUser
          ? editingIncome?.durationLabel
          : isAdjustmentType
            ? undefined
            : durationSelectionChanged
              ? durationLabel || undefined
              : editingIncome?.durationLabel,
        notes: notes.trim() || undefined,
        totalAmount,
        currency,
        earningPeriodId: editingIncome?.earningPeriodId ?? activePeriod?.id,
        earningPercentage: isAdjustmentType
          ? 0
          : isServiceType
          ? isBasicUser
            ? 100
            : editingIncome?.earningPercentage ??
              editingIncome?.percentage ??
              activePeriod?.percentage ??
              percentage
          : editingIncome?.earningPercentage ?? percentage,
        percentage: isAdjustmentType
          ? 0
          : isServiceType
            ? isBasicUser ? 100 : percentage
            : editingIncome?.percentage ?? percentage,
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
        actualDuration: isBasicUser
          ? editingIncome?.actualDuration ?? 0
          : isAdjustmentType
            ? 0
            : duration,
        country: editingIncome?.country ?? settings.country,
        city: isBasicUser ? undefined : editingIncome?.city ?? settings.city,
      }

      if (isEditing && parsedIncomeId) {
        await updateServiceIncome(parsedIncomeId, incomeValues)
        navigate('/income')
        return
      }

      await createServiceIncome({
        ...incomeValues,
        createdAt: registrationDateTime,
        date: registrationDate,
      })
      navigate('/income')
    } catch (error: unknown) {
      setSaveStatus('error')
      setSaveError(
        error instanceof Error ? error.message : 'No se pudo guardar el ingreso.',
      )
    }
  }

  if (!settings) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Cargando...</p>
      </section>
    )
  }

  if (!settings.defaultCurrency) {
    return (
      <section className="mx-auto flex min-h-[60dvh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-semibold">Falta configurar la moneda</h1>
        <p className="text-sm text-slate-500">
          Selecciona una moneda en Configuración antes de registrar ingresos.
        </p>
        <button
          className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white"
          onClick={() => navigate('/settings')}
          type="button"
        >
          Ir a Configuración
        </button>
      </section>
    )
  }

  if (!isEditing && !isBasicUser && !activePeriod) {
    return <section className="mx-auto flex min-h-[60dvh] max-w-2xl flex-col items-center justify-center gap-4 text-center"><h1 className="text-2xl font-semibold">No hay una temporada activa</h1><p className="text-sm text-slate-500">Crea una temporada para registrar actividad.</p><button className="h-11 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white" onClick={() => navigate('/temporadas')} type="button">Ir a Temporadas</button></section>
  }

  const readOnlyDateTime = editingIncome?.createdAt
    ? formatReadOnlyDateTime(editingIncome.createdAt)
    : new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())

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
        {!isBasicUser && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-slate-700">
              Tipo de ingreso
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: 'Servicio', value: 'ingreso' },
                { label: 'Ajuste', value: 'ajuste' },
              ] as const).map((option) => (
                <label
                  className={[
                    'flex h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold transition',
                    incomeType === option.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                  key={option.value}
                >
                  <input
                    checked={incomeType === option.value}
                    className="sr-only"
                    name="incomeType"
                    onChange={() => setIncomeType(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {isEditing && incomeType === 'otro' && (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            Este registro histórico se conserva como “Otro ingreso histórico”.
          </p>
        )}

        {!isEditing || isBasicUser ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:!text-slate-300">
              Fecha y hora
            </p>
            <p className="mt-1 font-medium text-slate-900 dark:!text-white">
              {readOnlyDateTime}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:!text-slate-300">
              Se asignan automáticamente al guardar.
            </p>
          </div>
        ) : (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Fecha del ingreso
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setDate(event.target.value)}
              required
              type="date"
              value={date}
            />
            <span className="text-xs text-slate-500">
              La hora original del registro se conserva.
            </span>
          </label>
        )}

        {usesServiceDuration && (
          <ServiceDurationSelect
            onChange={handleDurationChange}
            value={durationLabel}
          />
        )}

        <div className="grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              {isServiceType ? 'Importe total' : 'Cantidad del ajuste'}
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
        </div>

        {!isBasicUser && isServiceType && <div className="grid gap-4">
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
        </div>}

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">
            Observación <span className="font-normal text-slate-500">(opcional)</span>
          </span>
          <textarea
            className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
            maxLength={500}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Añade una nota sobre este ingreso"
            value={notes}
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500" role="status">
            {saveStatus === 'duplicateHour' &&
              'Ya existe un ingreso registrado en esa misma fecha y hora'}
            {saveStatus === 'error' && (saveError || 'No se pudo guardar')}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              saveStatus === 'saving' ||
              totalAmount <= 0
            }
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saveStatus === 'saving'
              ? 'Guardando'
              : isEditing
                ? `Actualizar ${incomeType === 'ajuste' ? 'ajuste' : 'ingreso'}`
                : `Guardar ${incomeType === 'ajuste' ? 'ajuste' : 'ingreso'}`}
          </button>
        </div>
      </form>
    </section>
  )
}

export default IncomePage
