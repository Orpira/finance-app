import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import {
  buildFinancialBalanceAsOf,
  buildFinancialBalanceText,
  isValidCutoff,
  type FinancialBalanceResult,
} from '../../services/financialBalanceService'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { AppSettings } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { resolveActiveUsageMode } from '../../utils/usageMode'

function todayLocal(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const mutedClass = 'text-sm text-slate-600 dark:text-slate-400'

/**
 * Vista de solo lectura: reutiliza el motor financiero existente vía
 * `buildFinancialBalanceAsOf`. No equivale a un Estado de Situación
 * Financiera NIIF ni a un saldo bancario.
 */
export default function FinancialBalancePage() {
  const [cutoff, setCutoff] = useState(todayLocal)
  const [level, setLevel] = useState(2)
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [result, setResult] = useState<FinancialBalanceResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    function handleSettingsChanged() {
      setSettingsVersion((value) => value + 1)
    }
    window.addEventListener('finance-app:settings-changed', handleSettingsChanged)
    return () => window.removeEventListener('finance-app:settings-changed', handleSettingsChanged)
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [configuration, incomeRecords, expenseRecords] = await Promise.all([
          getSettings(),
          listServiceIncomes({ to: cutoff, newestFirst: true }),
          listExpenses({ to: cutoff, newestFirst: true }),
        ])
        if (!active) return
        const settings = configuration as AppSettings
        setResult(
          buildFinancialBalanceAsOf({
            incomes: incomeRecords,
            expenses: expenseRecords,
            currency: settings.defaultCurrency ?? 'EUR',
            usageMode: resolveActiveUsageMode(settings),
            cutoff,
          }),
        )
      } catch {
        if (active) {
          setResult(null)
          setError('No se pudo calcular el balance para esta fecha.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [cutoff, settingsVersion])

  const money = useMemo(
    () => (value: number) => formatCurrency(value, result?.currency ?? 'EUR'),
    [result?.currency],
  )

  async function handleExport() {
    if (!result) return
    setExporting(true)
    try {
      const { shareReportPdf } = await import('../../services/reportShareService')
      const title = `Balance financiero ${result.cutoff}`
      await shareReportPdf({
        fileName: `balance-financiero-${result.cutoff}`,
        html: '',
        text: buildFinancialBalanceText(result, money),
        title,
      })
    } catch {
      setError('No se pudo generar el PDF del balance.')
    } finally {
      setExporting(false)
    }
  }

  const report = result?.report

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader backLabel="Reportes" backTo="/reports" eyebrow="Reportes" title="Balance financiero" />
      <p className={mutedClass}>
        Balance acumulado de los movimientos registrados hasta la fecha de corte. No es un Estado de
        Situación Financiera NIIF ni acredita el saldo disponible en entidades bancarias.
      </p>
      <div className={`grid gap-3 sm:grid-cols-2 ${cardClass}`}>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Fecha de corte
          <input
            aria-label="Fecha de corte"
            className="h-11 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
            max={todayLocal()}
            onChange={(event) => {
              const value = event.target.value
              setCutoff(isValidCutoff(value) ? value : todayLocal())
            }}
            type="date"
            value={cutoff}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Nivel de detalle
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
            onChange={(event) => setLevel(Number(event.target.value))}
            value={level}
          >
            <option value={1}>1 · General</option>
            <option value={2}>2 · Componentes</option>
            <option value={3}>3 · Desglose por tipo</option>
            <option value={4}>4 · Detalle de ajustes</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className={mutedClass} role="status">Calculando balance…</p>
      ) : error && !report ? (
        <p className="text-red-700 dark:text-red-400" role="alert">{error}</p>
      ) : report && result ? (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">
              Balance neto acumulado hasta {result.cutoff} · Modo {result.usageMode === 'basic' ? 'Básico' : 'Profesional'}
            </p>
            <p className="mt-1 text-3xl font-bold text-emerald-950 dark:text-emerald-100">{money(report.generalBalance)}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cardClass}>
              <p className={mutedClass}>Total recibido</p>
              <p className="text-xl font-semibold text-slate-950 dark:text-white">{money(report.incomeGrossTotal)}</p>
            </div>
            <div className={cardClass}>
              <p className={mutedClass}>Egresos</p>
              <p className="text-xl font-semibold text-slate-950 dark:text-white">{money(report.expenseTotal)}</p>
            </div>
          </div>

          {level >= 2 && (
            <div className={cardClass}>
              <h2 className="font-semibold text-slate-950 dark:text-white">Componentes del balance</h2>
              <dl className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex justify-between gap-2"><dt>Ingresos principales</dt><dd>{money(result.principalIncomeTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Ingresos adicionales</dt><dd>{money(result.additionalIncomeTotal)}</dd></div>
                <div className="flex justify-between gap-2 font-medium"><dt>Total recibido</dt><dd>{money(report.incomeGrossTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Egresos</dt><dd>-{money(report.expenseTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Ajustes positivos</dt><dd>{money(report.adjustmentsPositiveTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Ajustes negativos</dt><dd>-{money(report.adjustmentsNegativeTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Impacto neto de ajustes</dt><dd>{money(report.adjustmentImpactTotal)}</dd></div>
                <div className="flex justify-between gap-2 border-t border-slate-200 pt-2 font-semibold dark:border-slate-700"><dt>Balance neto</dt><dd>{money(report.generalBalance)}</dd></div>
              </dl>
            </div>
          )}

          {level >= 3 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Ingresos por tipo', rows: report.incomesByType },
                { title: 'Egresos por tipo', rows: report.expensesByType },
              ].map((group) => (
                <div className={cardClass} key={group.title}>
                  <h2 className="font-semibold text-slate-950 dark:text-white">{group.title}</h2>
                  {group.rows.length === 0 ? (
                    <p className={`mt-2 ${mutedClass}`}>Sin registros</p>
                  ) : (
                    <ul className="mt-3 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                      {group.rows.map((row) => (
                        <li className="flex justify-between gap-3" key={row.type}>
                          <span>{row.label} ({row.count})</span><span>{money(row.total)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}

          {level >= 4 && (
            <div className={cardClass}>
              <h2 className="font-semibold text-slate-950 dark:text-white">Trazabilidad de ajustes</h2>
              {report.adjustments.length === 0 ? (
                <p className={`mt-2 ${mutedClass}`}>Sin ajustes</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100 text-sm text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                  {report.adjustments.map((item, index) => (
                    <li className="flex justify-between gap-3 py-2" key={`${item.origin}-${item.id ?? index}`}>
                      <span>{item.date} · {item.label} · {item.origin === 'income' ? 'Ingreso' : 'Egreso'}</span>
                      <span>{money(item.value)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-slate-500">Para consultar todos los movimientos individuales, utiliza la sección Movimientos.</p>
              <Link className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-400" to="/movements">Ver movimientos</Link>
            </div>
          )}

          {!report.hasData && (
            <p className={mutedClass}>No hay movimientos registrados hasta la fecha de corte.</p>
          )}

          {error ? <p className="text-red-700 dark:text-red-400" role="alert">{error}</p> : null}

          <div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              disabled={exporting}
              onClick={() => void handleExport()}
              type="button"
            >
              <Download aria-hidden="true" className="size-4" />
              {exporting ? 'Generando PDF…' : 'Exportar PDF'}
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Balance estimado a partir de los registros, no saldo bancario certificado. Las transferencias
            entre Wallets no se cuentan como ingresos ni egresos.
          </p>
        </>
      ) : null}
    </section>
  )
}
