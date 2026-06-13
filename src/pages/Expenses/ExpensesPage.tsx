import { Plus, ReceiptText } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'

import {
  convertCurrencyPair,
  convertCurrencyToEurCop,
  type ExchangeRateResolutionSource,
} from '../../services/currencyConversionService'
import { saveExchangeRate } from '../../services/exchangeRateService'
import { createExpense, listExpenses } from '../../services/expenseService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { AppSettings, CurrencyCode } from '../../types/settings'
import {
  EUR_COP_DEFAULT_RATE,
  formatCurrency,
  getTodayInputDate,
  roundMoney,
} from '../../utils/currency'
import { currencies } from '../../utils/countries'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const expenseCategories = [
  'Transporte',
  'Hotel',
  'Alimentación',
  'Publicidad',
  'Otros',
]

export function ExpensesPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [date, setDate] = useState(getTodayInputDate())
  const [category, setCategory] = useState(expenseCategories[0])
  const [amount, setAmount] = useState(0)
  const [currency, setCurrency] = useState<CurrencyCode>('EUR')
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
      const [currentSettings, currentExpenses] = await Promise.all([
        getSettings(),
        listExpenses({ newestFirst: true }),
      ])

      if (!isMounted) {
        return
      }

      setSettings(currentSettings)
      setCurrency(currentSettings.defaultCurrency)
      setExpenses(currentExpenses)
    }

    loadInitialData()

    return () => {
      isMounted = false
    }
  }, [date])

  useEffect(() => {
    let isMounted = true

    async function convertExpenseValue() {
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
      })
      setExchangeRate(convertedPairValue.rate)
      setExchangeRateSource(convertedPairValue.source)
    }

    convertExpenseValue()

    return () => {
      isMounted = false
    }
  }, [amount, currency, date, exchangeRate, settings])

  async function reloadExpenses() {
    const currentExpenses = await listExpenses({ newestFirst: true })
    setExpenses(currentExpenses)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!settings) {
      return
    }

    setSaveStatus('saving')

    try {
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

      await createExpense({
        date,
        category,
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
        country: settings.country,
        city: settings.city,
      })

      setAmount(0)
      setDate(getTodayInputDate())
      setCategory(expenseCategories[0])
      setSaveStatus('saved')
      await reloadExpenses()
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
      <header className="flex flex-col gap-1">
        <p className="text-sm font-medium text-emerald-700">Gastos</p>
        <h1 className="text-2xl font-semibold text-slate-950">
          Registrar gasto
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

        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">Importe</span>
            <input
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              min={0}
              onChange={(event) => setAmount(Number(event.target.value))}
              step="0.01"
              type="number"
              value={amount}
            />
          </label>

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
        </div>

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

        <div className="grid gap-3 rounded-lg border border-red-100 bg-red-50 p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-red-700">
              Valor {currency}
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-950">
              {formatCurrency(convertedValues.baseCurrencyValue, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-red-700">
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
            {saveStatus === 'saved' && 'Gasto guardado'}
            {saveStatus === 'error' && 'No se pudo guardar'}
          </p>

          <button
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={saveStatus === 'saving' || amount <= 0}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {saveStatus === 'saving' ? 'Guardando' : 'Guardar gasto'}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ReceiptText className="size-5 text-emerald-700" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-950">
            Gastos recientes
          </h2>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {expenses.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              Todavía no hay gastos registrados.
            </p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {expenses.slice(0, 6).map((expense) => (
                <li
                  className="flex items-center justify-between gap-4 p-4"
                  key={expense.id}
                >
                  <div>
                    <p className="font-medium text-slate-950">
                      {expense.category}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {expense.date}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-950">
                      {formatCurrency(expense.amount, expense.currency as CurrencyCode)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatCurrency(expense.eurValue, 'EUR')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </section>
  )
}

export default ExpensesPage
