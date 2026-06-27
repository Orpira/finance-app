import { Plus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { PageHeader } from '../../components/layout/PageHeader'
import { SensitiveAmount } from '../../components/SensitiveAmount'
import { useSensitiveValues } from '../../hooks/useSensitiveValues'
import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  type ExchangeRateResolutionSource,
} from '../../services/currencyConversionService'
import { saveExchangeRate } from '../../services/exchangeRateService'
import {
  createExpense,
  getAdjustmentCapacity,
  getExpenseById,
  updateExpense,
} from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { ExpenseType } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  EUR_COP_DEFAULT_RATE,
  formatCurrency,
  getTodayInputDate,
  roundMoney,
} from '../../utils/currency'
import { isLocationSeasonClosed } from '../../utils/locationSeasons'
import { getActiveEarningPeriod, isEarningPeriodClosed } from '../../services/earningPeriodService'
import type { EarningPeriod } from '../../types/earningPeriod'
import type { AdjustmentCapacity } from '../../utils/expenseAdjustments'
import { ADJUSTMENT_LIMIT_ERROR } from '../../utils/expenseAdjustments'
import {
  isBasicMode,
  recordBelongsToUsageMode,
  requiresSeason,
} from '../../utils/usageMode'
import { isServiceIncome } from '../../utils/incomeTypes'

type SaveStatus = 'idle' | 'saving' | 'error'
type CrossIncomeChoice = 'yes' | 'no'

const expenseCategories = [
  'Transporte',
  'Hotel',
  'Alimentación',
  'Publicidad',
  'Otros',
]

function formatRateUpdatedAt(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

export function ExpensesPage() {
  const { hidden: sensitiveValuesHidden } = useSensitiveValues()
  const { expenseId } = useParams()
  const navigate = useNavigate()
  const parsedExpenseId = expenseId ? Number(expenseId) : null
  const isEditing = Number.isFinite(parsedExpenseId) && parsedExpenseId !== null
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [activePeriod, setActivePeriod] = useState<EarningPeriod | null>(null)
  const [expenseType, setExpenseType] = useState<ExpenseType>('gasto')
  const [date, setDate] = useState(getTodayInputDate())
  const [category, setCategory] = useState(expenseCategories[0])
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
  const [expenseCountry, setExpenseCountry] = useState<string | undefined>()
  const [expenseCity, setExpenseCity] = useState<string | undefined>()
  const [expenseCreatedAt, setExpenseCreatedAt] = useState<string | undefined>()
  const [crossIncome, setCrossIncome] = useState<CrossIncomeChoice>('no')
  const [relatedIncomeId, setRelatedIncomeId] = useState('')
  const [notes, setNotes] = useState('')
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [exchangeRate, setExchangeRate] = useState(EUR_COP_DEFAULT_RATE)
  const [exchangeRateSource, setExchangeRateSource] =
    useState<ExchangeRateResolutionSource>('default')
  const [convertedValues, setConvertedValues] = useState({
    baseCurrencyValue: 0,
    secondaryCurrencyValue: 0,
    eurValue: 0,
    copValue: 0,
    eurCopRate: EUR_COP_DEFAULT_RATE,
  })
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [validationError, setValidationError] = useState('')
  const [adjustmentCapacity, setAdjustmentCapacity] =
    useState<AdjustmentCapacity | null>(null)
  const hasSelectedRelatedIncome = incomes.some(
    (income) => income.id === Number(relatedIncomeId),
  )
  const isBasicUser = isBasicMode(settings ?? undefined)

  const proposedAdjustmentValue = (() => {
    if (!adjustmentCapacity || !settings) return 0
    if (currency === adjustmentCapacity.currency) return amount
    if (settings.secondaryCurrency === adjustmentCapacity.currency) {
      return convertedValues.secondaryCurrencyValue
    }
    if (adjustmentCapacity.currency === 'EUR') return convertedValues.eurValue
    if (adjustmentCapacity.currency === 'COP') return convertedValues.copValue
    return Number.NaN
  })()
  const adjustmentLimitExceeded =
    expenseType === 'ajuste' &&
    crossIncome === 'yes' &&
    adjustmentCapacity !== null &&
    (!Number.isFinite(proposedAdjustmentValue) ||
      roundMoney(proposedAdjustmentValue) > adjustmentCapacity.availableAmount)

  useEffect(() => {
    let isMounted = true

    async function loadInitialData() {
      const [currentSettings, currentIncomes, currentPeriod] = await Promise.all([
        getSettings(),
        listServiceIncomes({ newestFirst: true }),
        getActiveEarningPeriod(),
      ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setCurrency(
        (!isBasicMode(currentSettings) && currentPeriod?.baseCurrency
          ? currentPeriod.baseCurrency
          : currentSettings.defaultCurrency) as CurrencyCode,
      )
      if (isBasicMode(currentSettings) && !parsedExpenseId) {
        setCategory('Otros')
      }
      setIncomes(
        currentIncomes.filter((income) =>
          recordBelongsToUsageMode(income, currentSettings.usageMode),
        ),
      )
      setActivePeriod(currentPeriod ?? null)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [parsedExpenseId])

  useEffect(() => {
    let isMounted = true

    async function loadExpenseForEdit() {
      if (!parsedExpenseId || !Number.isFinite(parsedExpenseId)) {
        return
      }

      const [currentExpense, currentSettings] = await Promise.all([
        getExpenseById(parsedExpenseId),
        getSettings(),
      ])

      if (!isMounted || !currentExpense) {
        return
      }

      if (
        !recordBelongsToUsageMode(
          currentExpense,
          currentSettings.usageMode,
        )
      ) {
        window.alert('Este egreso pertenece a otro modo de uso.')
        navigate('/expenses', { replace: true })
        return
      }

      if (
        requiresSeason(currentSettings) &&
        ((await isEarningPeriodClosed(
          currentExpense.earningPeriodId ?? currentExpense.seasonPeriodId,
        )) ||
          isLocationSeasonClosed(
            currentExpense,
            currentSettings.closedLocationSeasons,
          ))
      ) {
        window.alert(
          'Este gasto pertenece a una temporada cerrada. Solo puede consultarse desde el historial y usarse en reportes.',
        )
        navigate('/expenses', { replace: true })
        return
      }

      setExpenseType(
        isBasicMode(currentSettings) ? 'gasto' : currentExpense.type ?? 'gasto',
      )
      setDate(currentExpense.date)
      setCategory(
        isBasicMode(currentSettings) && currentExpense.category === 'Ajuste'
          ? 'Otros'
          : currentExpense.category,
      )
      setAmount(currentExpense.amount)
      setCurrency(currentExpense.currency as CurrencyCode)
      setExpenseCountry(currentExpense.country)
      setExpenseCity(currentExpense.city)
      setExpenseCreatedAt(currentExpense.createdAt)
      setCrossIncome(currentExpense.relatedIncomeId ? 'yes' : 'no')
      setRelatedIncomeId(
        currentExpense.relatedIncomeId
          ? String(currentExpense.relatedIncomeId)
          : '',
      )
      setNotes(currentExpense.notes ?? '')

      if (currentExpense.exchangeRateBaseToSecondary) {
        setExchangeRate(currentExpense.exchangeRateBaseToSecondary)
      }
    }

    loadExpenseForEdit()

    return () => {
      isMounted = false
    }
  }, [navigate, parsedExpenseId])

  useEffect(() => {
    let isMounted = true
    const incomeId = Number(relatedIncomeId)

    if (
      expenseType !== 'ajuste' ||
      crossIncome !== 'yes' ||
      !Number.isFinite(incomeId) ||
      incomeId <= 0
    ) {
      return
    }

    getAdjustmentCapacity(incomeId, parsedExpenseId ?? undefined)
      .then((capacity) => {
        if (isMounted) setAdjustmentCapacity(capacity)
      })
      .catch((error: unknown) => {
        if (!isMounted) return
        setAdjustmentCapacity(null)
        setValidationError(
          error instanceof Error ? error.message : 'No se pudo validar el ajuste.',
        )
      })

    return () => {
      isMounted = false
    }
  }, [crossIncome, expenseType, parsedExpenseId, relatedIncomeId])

  useEffect(() => {
    let isMounted = true

    async function convertExpenseValue() {
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
          amount,
          currency,
          settings.secondaryCurrency,
          conversionOptions,
        ),
        convertCurrencyToEurCop(amount, currency, conversionOptions),
      ])
      if (!isMounted) {
        return
      }

      setConvertedValues({
        baseCurrencyValue: convertedPairValue.primaryValue,
        secondaryCurrencyValue: convertedPairValue.secondaryValue,
        eurValue: convertedEurCopValue.eurValue,
        copValue: convertedEurCopValue.copValue,
        eurCopRate: convertedEurCopValue.eurCopRate,
      })
      setExchangeRate(convertedPairValue.rate)
      setExchangeRateSource(convertedPairValue.source)
    }

    convertExpenseValue()

    return () => {
      isMounted = false
    }
  }, [amount, currency, date, exchangeRate, isEditing, settings])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    if (amount <= 0) {
      setValidationError('La cantidad debe ser mayor que 0.')
      return
    }

    if (adjustmentLimitExceeded) {
      setValidationError(ADJUSTMENT_LIMIT_ERROR)
      return
    }

    if (
      !isBasicUser &&
      expenseType === 'ajuste' &&
      crossIncome === 'yes' &&
      !hasSelectedRelatedIncome
    ) {
      setValidationError('Selecciona el ingreso relacionado.')
      return
    }

    if (notes.length > 500) {
      setValidationError('Las observaciones no pueden superar 500 caracteres.')
      return
    }

    setValidationError('')
    setSaveStatus('saving')

    try {
      const now = new Date()
      const effectiveExpenseType = isBasicUser ? 'gasto' : expenseType
      const expenseDate =
        (isBasicUser || effectiveExpenseType === 'ajuste') && !isEditing
          ? getTodayInputDate()
          : date

      await saveExchangeRate({
        baseCurrency: currency,
        targetCurrency: settings.secondaryCurrency,
        rate: exchangeRate,
        date: expenseDate,
        source:
          settings.rateMode === 'automatic' && exchangeRateSource === 'api'
            ? 'api'
            : 'manual',
      })

      const expenseInput = {
        type: effectiveExpenseType,
        date: expenseDate,
        category: effectiveExpenseType === 'ajuste' ? 'Ajuste' : category,
        amount,
        currency,
        eurValue: roundMoney(convertedValues.eurValue),
        copValue: roundMoney(convertedValues.copValue),
        baseCurrency: currency,
        secondaryCurrency: settings.secondaryCurrency,
        baseCurrencyValue: roundMoney(convertedValues.baseCurrencyValue),
        secondaryCurrencyValue: roundMoney(
          convertedValues.secondaryCurrencyValue,
        ),
        exchangeRateBaseToSecondary: exchangeRate,
        exchangeRateUsed: exchangeRate,
        eurCopExchangeRateUsed: convertedValues.eurCopRate,
        relatedIncomeId:
          effectiveExpenseType === 'ajuste' && crossIncome === 'yes'
            ? Number(relatedIncomeId)
            : undefined,
        notes:
          notes.trim()
            ? notes.trim()
            : undefined,
        createdAt: expenseCreatedAt ?? now.toISOString(),
        country: expenseCountry ?? settings.country,
        city: isBasicUser ? undefined : expenseCity ?? settings.city,
      }

      if (isEditing && parsedExpenseId) {
        await updateExpense(parsedExpenseId, expenseInput)
      } else {
        await createExpense(expenseInput)
      }

      navigate('/expenses')
    } catch (error: unknown) {
      setSaveStatus('error')
      setValidationError(
        error instanceof Error ? error.message : 'No se pudo guardar el egreso.',
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
          Selecciona una moneda en Configuración antes de registrar egresos.
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

  const readOnlyDateTime = expenseCreatedAt
    ? formatRateUpdatedAt(expenseCreatedAt)
    : new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date())

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        backLabel="Egresos"
        backTo="/expenses"
        eyebrow="Egresos"
        title={isEditing ? 'Modificar egreso' : 'Registrar egreso'}
      />

      <form
        className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        onSubmit={handleSubmit}
      >
        {!isBasicUser && <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-slate-700">
            Tipo de egreso
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {([
              { label: 'Gasto', value: 'gasto' },
              { label: 'Ajuste', value: 'ajuste' },
            ] as const).map((option) => (
              <label
                className={[
                  'flex h-11 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold transition',
                  expenseType === option.value
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
                key={option.value}
              >
                <input
                  checked={expenseType === option.value}
                  className="sr-only"
                  name="expenseType"
                  onChange={() => {
                    setExpenseType(option.value)
                    setAdjustmentCapacity(null)
                    if (option.value === 'gasto' && category === 'Ajuste') {
                      setCategory(expenseCategories[0])
                    }
                    setValidationError('')
                  }}
                  type="radio"
                  value={option.value}
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>}

        {isBasicUser ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fecha y hora
            </p>
            <p className="mt-1 font-medium text-slate-900">
              {readOnlyDateTime}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Se asignan automáticamente al guardar.
            </p>
          </div>
        ) : expenseType === 'gasto' ? (
          <div className="grid gap-4 sm:grid-cols-2">
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
              <span className="text-sm font-medium text-slate-700">
                Categoría
              </span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => setCategory(event.target.value)}
                value={category}
              >
                {expenseCategories.map((categoryOption) => (
                  <option key={categoryOption} value={categoryOption}>
                    {categoryOption}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <p className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-800">
            La fecha y hora del ajuste se registran automáticamente al guardar.
          </p>
        )}

        <div className="grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              {expenseType === 'ajuste' ? 'Cantidad que deseas ajustar' : 'Importe'}
            </span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={0.01}
              onChange={(event) => setAmount(Number(event.target.value))}
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </label>

        </div>

        {isBasicUser && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">
              Observación <span className="font-normal text-slate-500">(opcional)</span>
            </span>
            <textarea
              className="min-h-24 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              maxLength={500}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Añade una nota sobre este egreso"
              value={notes}
            />
          </label>
        )}

        {!isBasicUser && expenseType === 'ajuste' && (
          <div className="flex flex-col gap-4 rounded-lg border border-amber-200 bg-amber-50/60 p-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                ¿Cruzar este ajuste con un ingreso registrado?
              </span>
              <select
                className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                onChange={(event) => {
                  const choice = event.target.value as CrossIncomeChoice
                  setCrossIncome(choice)
                  if (choice === 'no') {
                    setRelatedIncomeId('')
                    setAdjustmentCapacity(null)
                  }
                  setValidationError('')
                }}
                value={crossIncome}
              >
                <option value="no">No</option>
                <option value="yes">Sí</option>
              </select>
            </label>

            {crossIncome === 'yes' && (
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700">
                  Ingreso relacionado
                </span>
                <select
                  className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
                  disabled={incomes.length === 0}
                  onChange={(event) => {
                    const nextIncomeId = event.target.value
                    setRelatedIncomeId(nextIncomeId)
                    setAdjustmentCapacity(null)
                    const selectedIncome = incomes.find(
                      (income) => income.id === Number(nextIncomeId),
                    )
                    if (!isEditing && selectedIncome) {
                      setCurrency(selectedIncome.currency as CurrencyCode)
                    }
                    setValidationError('')
                  }}
                  required
                  value={relatedIncomeId}
                >
                  <option value="">
                    {incomes.length === 0
                      ? 'No hay ingresos registrados'
                      : 'Selecciona un ingreso'}
                  </option>
                  {incomes.map((income) => (
                    <option key={income.id} value={income.id}>
                      {new Intl.DateTimeFormat('es-ES').format(
                        new Date(`${income.date}T00:00`),
                      )}{' '}
                      · {sensitiveValuesHidden
                        ? '****'
                        : formatCurrency(
                            income.totalAmount,
                            income.currency as CurrencyCode,
                          )}
                      {' · '}{isServiceIncome(income) ? 'Ganancia real' : 'Monto efectivo'} {sensitiveValuesHidden
                        ? '****'
                        : formatCurrency(
                            income.realGain,
                            income.currency as CurrencyCode,
                          )}
                      {income.city ? ` · ${income.city}` : ''}
                      {income.country ? `, ${income.country}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {crossIncome === 'yes' && adjustmentCapacity && (
              <div className="grid gap-3 rounded-lg border border-amber-200 bg-white p-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ingreso original
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    <SensitiveAmount
                      hidden={sensitiveValuesHidden}
                      value={formatCurrency(
                        adjustmentCapacity.incomeAmount,
                        adjustmentCapacity.currency as CurrencyCode,
                      )}
                    />
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ajustes aplicados
                  </p>
                  <p className="mt-1 font-semibold text-slate-900">
                    <SensitiveAmount
                      hidden={sensitiveValuesHidden}
                      value={formatCurrency(
                        adjustmentCapacity.adjustedAmount,
                        adjustmentCapacity.currency as CurrencyCode,
                      )}
                    />
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Disponible para ajustar
                  </p>
                  <p className="mt-1 font-semibold text-emerald-800">
                    <SensitiveAmount
                      hidden={sensitiveValuesHidden}
                      value={formatCurrency(
                        adjustmentCapacity.availableAmount,
                        adjustmentCapacity.currency as CurrencyCode,
                      )}
                    />
                  </p>
                </div>
                {adjustmentLimitExceeded && (
                  <p className="text-sm font-semibold text-red-700 sm:col-span-3" role="alert">
                    {ADJUSTMENT_LIMIT_ERROR}
                  </p>
                )}
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-slate-700">
                Observaciones <span className="font-normal text-slate-500">(opcional)</span>
              </span>
              <textarea
                className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                maxLength={500}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setValidationError('')
                }}
                placeholder="Motivo o detalle del ajuste"
                value={notes}
              />
              <span className="text-right text-xs text-slate-500">
                {notes.length}/500
              </span>
            </label>
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500" role="status">
            {validationError || (saveStatus === 'error' && 'No se pudo guardar')}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={
              saveStatus === 'saving' ||
              amount <= 0 ||
              notes.length > 500 ||
              adjustmentLimitExceeded ||
              (expenseType === 'ajuste' &&
                crossIncome === 'yes' &&
                !hasSelectedRelatedIncome)
            }
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saveStatus === 'saving'
              ? 'Guardando'
              : isEditing
                ? `Actualizar ${isBasicUser ? 'egreso' : expenseType}`
                : `Guardar ${isBasicUser ? 'egreso' : expenseType}`}
          </button>
        </div>
      </form>
    </section>
  )
}

export default ExpensesPage
