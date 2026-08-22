import { ArrowRightLeft, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import {
  getCurrencyQuoteTargets,
  loadCurrencyQuotes,
  type CurrencyQuote,
  type CurrencyQuoteSource,
} from '../../services/currencyQuoteService'
import type { CurrencyCode, RateMode } from '../../types/settings'
import { currencies } from '../../utils/countries'
import { formatCurrency, roundMoney } from '../../utils/currency'

interface CurrencyQuoteCardProps {
  defaultCurrency: CurrencyCode
  secondaryCurrency: CurrencyCode
  rateMode: RateMode
  title: string
}

const SOURCE_LABELS: Record<CurrencyQuoteSource, string> = {
  api: 'Frankfurter',
  cache: 'Caché local',
  manual: 'Tasa manual',
  reference: 'Referencia local',
  unavailable: 'No disponible',
}

function currentCivilDate() {
  return new Date().toLocaleDateString('en-CA')
}

function formatQuoteDate(date: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' })
    .format(new Date(`${date}T00:00`))
}

export function CurrencyQuoteCard({
  defaultCurrency,
  secondaryCurrency,
  rateMode,
  title,
}: CurrencyQuoteCardProps) {
  const [amount, setAmount] = useState('1')
  const [baseCurrency, setBaseCurrency] = useState(defaultCurrency)
  const [quotes, setQuotes] = useState<CurrencyQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const latestRequestId = useRef(0)

  useEffect(() => () => {
    latestRequestId.current += 1
  }, [])

  useEffect(() => {
    let active = true
    const requestId = ++latestRequestId.current

    void loadCurrencyQuotes({
      allowNetwork: rateMode === 'automatic',
      baseCurrency,
      date: currentCivilDate(),
      targetCurrencies: getCurrencyQuoteTargets(baseCurrency, secondaryCurrency),
    })
      .then((nextQuotes) => {
        if (active && latestRequestId.current === requestId) setQuotes(nextQuotes)
      })
      .catch(() => {
        if (active && latestRequestId.current === requestId) {
          setError('No se pudieron cargar las cotizaciones guardadas.')
        }
      })
      .finally(() => {
        if (active && latestRequestId.current === requestId) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [baseCurrency, rateMode, secondaryCurrency])

  async function refreshQuotes() {
    const requestId = ++latestRequestId.current
    setLoading(true)
    setError('')

    try {
      const nextQuotes = await loadCurrencyQuotes({
        allowNetwork: true,
        baseCurrency,
        date: currentCivilDate(),
        forceRefresh: true,
        targetCurrencies: getCurrencyQuoteTargets(baseCurrency, secondaryCurrency),
      })
      if (latestRequestId.current === requestId) setQuotes(nextQuotes)
    } catch {
      if (latestRequestId.current === requestId) {
        setError('No fue posible actualizar. Se mantienen las últimas cotizaciones disponibles.')
      }
    } finally {
      if (latestRequestId.current === requestId) setLoading(false)
    }
  }

  function changeBaseCurrency(nextCurrency: CurrencyCode) {
    latestRequestId.current += 1
    setError('')
    setLoading(true)
    setQuotes([])
    setBaseCurrency(nextCurrency)
  }

  const numericAmount = Number(amount)
  const validAmount = Number.isFinite(numericAmount) && numericAmount >= 0

  return (
    <section aria-labelledby="currency-quote-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200" id="currency-quote-title">
          <ArrowRightLeft aria-hidden="true" className="size-5 text-cyan-700 dark:text-cyan-300" />
          {title}
        </h2>
        <button
          aria-label="Actualizar cotizaciones"
          className="flex size-10 shrink-0 items-center justify-center rounded-md text-cyan-800 transition hover:bg-cyan-50 focus:outline-none focus:ring-2 focus:ring-cyan-600 disabled:cursor-wait disabled:opacity-50 dark:text-cyan-200 dark:hover:bg-cyan-950"
          disabled={loading}
          onClick={() => void refreshQuotes()}
          title="Actualizar cotizaciones"
          type="button"
        >
          <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 dark:border-slate-800">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Importe
            <input
              className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-base font-semibold text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              inputMode="decimal"
              min="0"
              onChange={(event) => setAmount(event.target.value)}
              step="0.01"
              type="number"
              value={amount}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Moneda base
            <select
              className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              onChange={(event) => changeBaseCurrency(event.target.value as CurrencyCode)}
              value={baseCurrency}
            >
              {currencies.map((currency) => (
                <option key={currency.value} value={currency.value}>{currency.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div aria-busy={loading} aria-live="polite">
          {quotes.length === 0 && loading ? (
            <p className="px-4 py-7 text-center text-sm text-slate-500 dark:text-slate-400">Consultando cotizaciones...</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {quotes.map((quote) => (
                <li className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3" key={quote.targetCurrency}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {baseCurrency} a {quote.targetCurrency}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {SOURCE_LABELS[quote.source]} · {formatQuoteDate(quote.date)}
                    </p>
                  </div>
                  <p className="max-w-44 text-right text-lg font-semibold text-slate-950 dark:text-white">
                    {quote.rate !== null && validAmount
                      ? formatCurrency(roundMoney(numericAmount * quote.rate), quote.targetCurrency)
                      : 'No disponible'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {(error || rateMode === 'manual') && (
          <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {error || 'Actualización automática desactivada. Usa el botón de actualizar para consultar Frankfurter.'}
          </p>
        )}
      </div>
    </section>
  )
}