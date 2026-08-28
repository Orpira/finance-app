import { Plus } from 'lucide-react'
import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { ServiceDurationSelect } from '../../components/forms/ServiceDurationSelect'
import {
  IncomeAdditionalsSection,
  type IncomeAdditionalItem,
} from '../../components/income/IncomeAdditionalsSection'
import { PageHeader } from '../../components/layout/PageHeader'
import type { IncomeCalculationMethod, WorkedTimeUnit } from '../../catalogs/incomeCalculationMethods'
import {
  WORKED_TIME_UNITS,
  getWorkedTimeUnitForMethod,
  shouldCollectPaymentTypeAtRegistration,
} from '../../catalogs/incomeCalculationMethods'
import {
  addIncomeAdditional,
  deleteIncomeAdditional,
  listIncomeAdditionals,
} from '../../services/incomeAdditionalService'
import {
  createServiceIncome,
  getServiceIncomeById,
  listServiceIncomes,
  updateServiceIncome,
} from '../../services/incomeService'
import { saveExchangeRate } from '../../services/exchangeRateService'
import { getSettings } from '../../services/settingsService'
import {
  getActiveEarningPeriod,
  getEarningPeriodById,
  isEarningPeriodClosed,
} from '../../services/earningPeriodService'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  type ExchangeRateResolutionSource,
} from '../../services/currencyConversionService'
import type { IncomeAdditional } from '../../types/incomeAdditional'
import type { ServiceIncome, ServiceIncomeType } from '../../types/service'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  EUR_COP_DEFAULT_RATE,
  formatCurrency,
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
  getIncomeRegistrationTypeLabel,
  isAdjustmentIncome,
  isServiceIncome,
} from '../../utils/incomeTypes'
import {
  getEffectiveFinancialDuration,
  getNumericDurationLabel,
  getServiceDurationOption,
  isServiceDurationLabel,
  type ServiceDurationLabel,
} from '../../utils/serviceDuration'
import { runIncomeCalculation } from '../../utils/incomeCalculation/incomeCalculatorRegistry'
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

function toAdditionalItems(additionals: IncomeAdditional[]): IncomeAdditionalItem[] {
  return additionals
    .filter((additional): additional is IncomeAdditional & { id: number } => additional.id !== undefined)
    .map((additional) => ({
      id: additional.id,
      amount: additional.amount,
      description: additional.description,
    }))
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
  const [editingPeriod, setEditingPeriod] = useState<EarningPeriod | null>(null)
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
  const [workedTime, setWorkedTime] = useState(0)
  const [workedTimeUnit, setWorkedTimeUnit] = useState<WorkedTimeUnit>('minutes')
  const [hourlyRateApplied, setHourlyRateApplied] = useState(0)
  const [hasAdditionalsOnCreate, setHasAdditionalsOnCreate] = useState<'yes' | 'no'>('no')
  const [draftAdditionals, setDraftAdditionals] = useState<IncomeAdditionalItem[]>([])
  const [persistedAdditionals, setPersistedAdditionals] = useState<IncomeAdditionalItem[]>([])
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [paymentType, setPaymentType] = useState(paymentTypes[0].value)
  const [notes, setNotes] = useState('')
  const [timerPreference, setTimerPreference] = useState<'yes' | 'no' | ''>('')
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
      const currentIncomePeriodId = currentIncome?.earningPeriodId ?? currentIncome?.seasonPeriodId
      const currentIncomePeriod = currentIncomePeriodId
        ? await getEarningPeriodById(currentIncomePeriodId)
        : undefined

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setActivePeriod(currentPeriod ?? null)
      setEditingPeriod(currentIncomePeriod ?? null)
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
        const currentDuration = getEffectiveFinancialDuration(currentIncome) ?? 0
        setDuration(currentDuration)
        setDurationLabel(
          isServiceDurationLabel(currentIncome.durationLabel)
            ? currentIncome.durationLabel
            : getNumericDurationLabel(currentDuration) ?? '',
        )
        setDurationSelectionChanged(false)
        setTotalAmount(currentIncome.totalAmount)
        setWorkedTime(currentIncome.workedTime ?? 0)
        setWorkedTimeUnit(currentIncome.workedTimeUnit ?? currentSettings.workedTimeUnit)
        setHourlyRateApplied(
          currentIncome.hourlyRateApplied ?? currentSettings.hourlyRate,
        )
        setCurrency(currentIncome.currency as CurrencyCode)
        setPaymentType(currentIncome.paymentType ?? paymentTypes[0].value)
        setNotes(currentIncome.notes ?? '')
        setTimerPreference(currentIncome.timerUsed === false ? 'no' : 'yes')
        setPercentage(currentIncome.percentage ?? 0)
        setExchangeRate(
          currentIncome.exchangeRateBaseToSecondary ??
            currentIncome.exchangeRateUsed ??
            EUR_COP_DEFAULT_RATE,
        )
        if (currentIncome.id) {
          setPersistedAdditionals(toAdditionalItems(await listIncomeAdditionals(currentIncome.id)))
        }
      } else {
        setPercentage(currentPeriod?.percentage ?? currentSettings.incomePercentage)
        setCurrency(
          (currentPeriod?.baseCurrency as CurrencyCode | undefined) ??
            currentSettings.defaultCurrency,
        )
        setHourlyRateApplied(currentSettings.hourlyRate)
      }
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [alert, navigate, parsedIncomeId])

  async function refreshEditingIncomeAfterAdditionalsChange() {
    if (!parsedIncomeId) {
      return
    }

    const [updatedIncome, updatedAdditionals] = await Promise.all([
      getServiceIncomeById(parsedIncomeId),
      listIncomeAdditionals(parsedIncomeId),
    ])

    if (updatedIncome) {
      setEditingIncome(updatedIncome)
    }
    setPersistedAdditionals(toAdditionalItems(updatedAdditionals))
  }

  async function handleAddPersistedAdditional(input: { amount: number; description?: string }) {
    if (!parsedIncomeId) {
      return
    }

    await addIncomeAdditional(parsedIncomeId, input)
    await refreshEditingIncomeAfterAdditionalsChange()
  }

  async function handleDeletePersistedAdditional(id: number | string) {
    if (!parsedIncomeId) {
      return
    }

    await deleteIncomeAdditional(Number(id), parsedIncomeId)
    await refreshEditingIncomeAfterAdditionalsChange()
  }

  function handleAddDraftAdditional(input: { amount: number; description?: string }) {
    setDraftAdditionals((current) => [
      ...current,
      { id: crypto.randomUUID(), amount: input.amount, description: input.description },
    ])
  }

  function handleDeleteDraftAdditional(id: number | string) {
    setDraftAdditionals((current) => current.filter((item) => item.id !== id))
  }

  const isBasicUser = isBasicMode(settings ?? undefined)
  const isServiceType = isBasicUser || isServiceIncome({ type: incomeType })
  const isAdjustmentType = !isBasicUser && isAdjustmentIncome({ type: incomeType })
  const registrationMethod = editingIncome
    ? editingIncome.incomeCalculationMethod ?? 'service_duration'
    : settings?.incomeCalculationMethod ?? 'service_duration'
  // El método de cálculo solo aplica a la actividad profesional. Los
  // ajustes y el modo básico conservan exactamente el flujo existente
  // (equivalente a 'service_duration' con additionalsTotal=0).
  const effectiveMethod: IncomeCalculationMethod =
    isBasicUser || isAdjustmentType
      ? 'service_duration'
      : registrationMethod
  const persistedMethod = editingIncome?.incomeCalculationMethod ?? effectiveMethod
  const usesServiceDuration =
    !isBasicUser && isServiceType && effectiveMethod === 'service_duration'
  const usesHourlyWorkday =
    !isBasicUser && isServiceType && effectiveMethod === 'hourly_workday'
  // "Jornada por horas" no pide tipo de pago al crearse (se persiste
  // "Efectivo" por defecto), pero al editar sí se puede modificar, igual
  // que en "Servicio por tiempo".
  const collectsPaymentType =
    !isBasicUser &&
    isServiceType &&
    (shouldCollectPaymentTypeAtRegistration(effectiveMethod) || (isEditing && usesHourlyWorkday))
  // Al editar un ingreso existente se respeta la unidad con la que se
  // guardó originalmente (workedTimeUnit ya viene cargada desde
  // editingIncome) para no reinterpretar datos históricos; para uno nuevo se
  // deriva siempre del método vigente.
  const effectiveWorkedTimeUnit: WorkedTimeUnit = editingIncome
    ? workedTimeUnit
    : getWorkedTimeUnitForMethod(effectiveMethod)
  // additionalsTotal es solo informativo (usado para el snapshot inicial del
  // ingreso al crear); nunca entra al motor de cálculo — el total del
  // registro (realGain/totalAmount) es siempre exclusivamente el importe de
  // horas/servicio trabajado, sin adicionales. Los adicionales viven aparte
  // y solo se suman a métricas de Ingresos y balance general.
  const draftAdditionalsTotal = draftAdditionals.reduce((sum, item) => sum + item.amount, 0)
  const additionalsTotal =
    editingIncome?.additionalsTotal ??
    (hasAdditionalsOnCreate === 'yes' ? roundMoney(draftAdditionalsTotal) : 0)
  const calculation = useMemo(() => {
    try {
      return runIncomeCalculation(effectiveMethod, {
        totalAmount,
        percentage,
        usageMode: isBasicUser ? 'basic' : 'professional',
        incomeType,
        workedTime,
        workedTimeUnit: effectiveWorkedTimeUnit,
        hourlyRate: hourlyRateApplied,
        storedRealGain: editingIncome?.realGain,
      })
    } catch {
      // Input incompleto durante la edición en vivo (p.ej. tiempo trabajado
      // aún no ingresado en Jornada por horas). La validación real ocurre en
      // handleSubmit antes de guardar.
      return { realGain: 0 }
    }
  }, [
    editingIncome?.realGain,
    effectiveMethod,
    effectiveWorkedTimeUnit,
    hourlyRateApplied,
    incomeType,
    isBasicUser,
    percentage,
    totalAmount,
    workedTime,
  ])
  const realGain = calculation.realGain
  const principalAmount = usesHourlyWorkday ? calculation.realGain : totalAmount

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

    if (usesHourlyWorkday && (!workedTime || workedTime <= 0)) {
      setSaveStatus('error')
      setSaveError('Ingresa el tiempo trabajado antes de guardar.')
      return
    }

    if (usesHourlyWorkday && (!hourlyRateApplied || hourlyRateApplied <= 0)) {
      setSaveStatus('error')
      setSaveError('El valor por hora debe ser mayor a cero.')
      return
    }

    if (!isEditing && usesServiceDuration && !timerPreference) {
      setSaveStatus('error')
      setSaveError('Indica si deseas activar el cronómetro para este servicio.')
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
        paymentType: !isAdjustmentType && collectsPaymentType ? paymentType : undefined,
        duration: isBasicUser
          ? editingIncome?.duration ?? 0
          : isAdjustmentType || usesHourlyWorkday
            ? 0
            : duration,
        durationLabel: isBasicUser
          ? editingIncome?.durationLabel
          : isAdjustmentType || usesHourlyWorkday
            ? undefined
            : durationSelectionChanged
              ? durationLabel || undefined
              : editingIncome?.durationLabel,
        notes: notes.trim() || undefined,
        timerUsed: usesServiceDuration
          ? isEditing
            ? editingIncome?.timerUsed
            : timerPreference === 'yes'
          : false,
        totalAmount: principalAmount,
        // Snapshot: el método nunca se sobreescribe al editar (incomeService.ts
        // lo refuerza descartando este campo en las actualizaciones).
        incomeCalculationMethod: persistedMethod,
        additionalsTotal,
        workedTime: usesHourlyWorkday ? workedTime : undefined,
        workedTimeUnit:
          !isBasicUser && isServiceType ? effectiveWorkedTimeUnit : undefined,
        hourlyRateApplied: usesHourlyWorkday ? hourlyRateApplied : undefined,
        currency,
        earningPeriodId:
          editingIncome?.earningPeriodId ??
          editingIncome?.seasonPeriodId ??
          activePeriod?.id,
        // "Jornada por horas" no usa el % de temporada (100% para la
        // profesional): no se captura/persiste ningún porcentaje para ese método.
        earningPercentage: isAdjustmentType || usesHourlyWorkday
          ? 0
          : isServiceType
          ? isBasicUser
            ? 100
            : editingIncome?.earningPercentage ??
              editingIncome?.percentage ??
              activePeriod?.percentage ??
              percentage
          : editingIncome?.earningPercentage ?? percentage,
        percentage: isAdjustmentType || usesHourlyWorkday
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
          : isAdjustmentType || usesHourlyWorkday
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

      const newIncomeId = await createServiceIncome({
        ...incomeValues,
        createdAt: registrationDateTime,
        date: registrationDate,
      })

      if (hasAdditionalsOnCreate === 'yes' && draftAdditionals.length > 0) {
        for (const draftAdditional of draftAdditionals) {
          await addIncomeAdditional(newIncomeId, {
            amount: draftAdditional.amount,
            description: draftAdditional.description,
          })
        }
      }

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
              Tipo de registro
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                {
                  label: getIncomeRegistrationTypeLabel(registrationMethod),
                  value: 'ingreso',
                },
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
              min={(editingPeriod ?? activePeriod)?.startDate.slice(0, 10)}
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
            unit={effectiveWorkedTimeUnit}
            value={durationLabel}
          />
        )}

        {!isEditing && usesServiceDuration && (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-slate-700">
              ¿Deseas activar el cronómetro para este servicio?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: 'Sí, activar', value: 'yes' },
                { label: 'No, registrar sin cronómetro', value: 'no' },
              ] as const).map((option) => (
                <label
                  className={[
                    'flex min-h-11 cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-center text-sm font-semibold transition',
                    timerPreference === option.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                  key={option.value}
                >
                  <input
                    checked={timerPreference === option.value}
                    className="sr-only"
                    name="timerPreference"
                    onChange={() => {
                      setTimerPreference(option.value)
                      setSaveError('')
                    }}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Si eliges “No”, el ingreso se guardará igualmente y no se mostrará
              ningún aviso al finalizar la duración.
            </p>
          </fieldset>
        )}

        {usesHourlyWorkday ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Tiempo trabajado
              </span>
              <div className="flex items-center gap-3">
                <input
                  className="h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  min={0}
                  onChange={(event) => setWorkedTime(Number(event.target.value))}
                  step={effectiveWorkedTimeUnit === 'hours' ? '0.25' : '1'}
                  type="number"
                  value={workedTime}
                />
                <span className="text-sm font-medium text-slate-500">
                  {WORKED_TIME_UNITS.find((unit) => unit.code === effectiveWorkedTimeUnit)?.label}
                </span>
              </div>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Total calculado
              </span>
              <p className="h-11 rounded-md border border-slate-200 bg-slate-50 px-3 text-base font-semibold text-slate-950 flex items-center">
                {formatCurrency(calculation.realGain, currency)}
              </p>
              <span className="text-xs text-slate-500">
                Tiempo trabajado × valor por hora. Los Adicionales se suman
                aparte, no están incluidos en este total.
              </span>
            </div>
          </div>
        ) : (
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
        )}

        {!isBasicUser && isServiceType && isEditing && (
          <IncomeAdditionalsSection
            additionals={persistedAdditionals}
            currency={currency}
            defaultOpen
            onAdd={handleAddPersistedAdditional}
            onDelete={handleDeletePersistedAdditional}
          />
        )}

        {!isBasicUser && isServiceType && !isEditing && (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-slate-700">
              ¿Este ingreso tiene un adicional?
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                { label: 'No', value: 'no' },
                { label: 'Sí', value: 'yes' },
              ] as const).map((option) => (
                <label
                  className={[
                    'flex h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold transition',
                    hasAdditionalsOnCreate === option.value
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                  ].join(' ')}
                  key={option.value}
                >
                  <input
                    checked={hasAdditionalsOnCreate === option.value}
                    className="sr-only"
                    name="hasAdditionalsOnCreate"
                    onChange={() => setHasAdditionalsOnCreate(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </div>

            {hasAdditionalsOnCreate === 'yes' && (
              <IncomeAdditionalsSection
                additionals={draftAdditionals}
                currency={currency}
                defaultOpen
                onAdd={handleAddDraftAdditional}
                onDelete={handleDeleteDraftAdditional}
              />
            )}
          </fieldset>
        )}

        {collectsPaymentType && <div className="grid gap-4">
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
              (usesHourlyWorkday ? principalAmount <= 0 : totalAmount <= 0)
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
