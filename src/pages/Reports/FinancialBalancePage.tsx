import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { buildBalanceReport } from '../../services/balanceReportService'
import { listExpenses } from '../../services/expenseService'
import { listServiceIncomes } from '../../services/incomeService'
import { getSettings } from '../../services/settingsService'
import type { Expense } from '../../types/expense'
import type { ServiceIncome } from '../../types/service'
import type { AppSettings } from '../../types/settings'
import { formatCurrency } from '../../utils/currency'
import { recordBelongsToUsageMode, resolveActiveUsageMode } from '../../utils/usageMode'

function todayLocal(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/**
 * Vista de lectura: reutiliza el motor financiero existente.
 * No equivale a un Estado de Situación Financiera NIIF.
 */
export default function FinancialBalancePage() {
  const [cutoff, setCutoff] = useState(todayLocal)
  const [level, setLevel] = useState(2)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [incomes, setIncomes] = useState<ServiceIncome[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        const mode = resolveActiveUsageMode(configuration)
        setSettings(configuration)
        setIncomes(incomeRecords.filter(item => item.date <= cutoff && recordBelongsToUsageMode(item, mode)))
        setExpenses(expenseRecords.filter(item => item.date <= cutoff && recordBelongsToUsageMode(item, mode)))
      } catch {
        if (active) setError('No se pudo calcular el balance para esta fecha.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [cutoff])

  const currency = settings?.defaultCurrency ?? 'EUR'
  const report = useMemo(() => buildBalanceReport({ incomes, expenses, currency }), [incomes, expenses, currency])
  const money = (value: number) => formatCurrency(value, currency)

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader backLabel="Reportes" backTo="/reports" eyebrow="Reportes" title="Balance financiero" />
      <p className="text-sm text-slate-600">
        Balance acumulado de movimientos registrados. No es un Estado de Situación Financiera NIIF
        ni acredita el saldo disponible en entidades bancarias.
      </p>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Fecha de corte
          <input aria-label="Fecha de corte" className="rounded-lg border border-slate-300 p-2"
            type="date" value={cutoff} max={todayLocal()} onChange={event => setCutoff(event.target.value || todayLocal())} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700">
          Nivel de detalle
          <select className="rounded-lg border border-slate-300 p-2" value={level}
            onChange={event => setLevel(Number(event.target.value))}>
            <option value={1}>1 · Resumen</option>
            <option value={2}>2 · Componentes</option>
            <option value={3}>3 · Tipos de movimiento</option>
            <option value={4}>4 · Ajustes individuales</option>
          </select>
        </label>
      </div>
      {loading ? <p role="status">Calculando balance…</p> : error ? (
        <p role="alert" className="text-red-700">{error}</p>
      ) : (
        <>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="text-sm text-emerald-800">Balance neto acumulado hasta {cutoff}</p>
            <p className="mt-1 text-3xl font-bold text-emerald-950">{money(report.generalBalance)}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Total recibido</p>
              <p className="text-xl font-semibold">{money(report.incomeGrossTotal)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm text-slate-600">Egresos</p>
              <p className="text-xl font-semibold">{money(report.expenseTotal)}</p>
            </div>
          </div>
          {level >= 2 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Componentes del balance</h2>
              <dl className="mt-3 space-y-2">
                <div className="flex justify-between gap-2"><dt>Ingresos recibidos</dt><dd>{money(report.incomeGrossTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Egresos</dt><dd>{money(report.expenseTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Ajustes positivos</dt><dd>{money(report.adjustmentsPositiveTotal)}</dd></div>
                <div className="flex justify-between gap-2"><dt>Ajustes negativos</dt><dd>{money(report.adjustmentsNegativeTotal)}</dd></div>
                <div className="flex justify-between gap-2 border-t pt-2 font-semibold"><dt>Impacto neto de ajustes</dt><dd>{money(report.adjustmentImpactTotal)}</dd></div>
              </dl>
            </div>
          )}
          {level >= 3 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {([{ title: 'Ingresos por tipo', rows: report.incomesByType }, { title: 'Egresos por tipo', rows: report.expensesByType }]).map(group => (
                <div key={group.title} className="rounded-xl border border-slate-200 bg-white p-4">
                  <h2 className="font-semibold">{group.title}</h2>
                  {group.rows.length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin registros</p> :
                    <ul className="mt-3 space-y-2">{group.rows.map(row => (
                      <li key={row.type} className="flex justify-between gap-3 text-sm">
                        <span>{row.label} ({row.count})</span><span>{money(row.total)}</span>
                      </li>
                    ))}</ul>}
                </div>
              ))}
            </div>
          )}
          {level >= 4 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="font-semibold">Trazabilidad de ajustes</h2>
              {report.adjustments.length === 0 ? <p className="mt-2 text-sm text-slate-500">Sin ajustes</p> :
                <ul className="mt-3 divide-y divide-slate-100">{report.adjustments.map((item, index) => (
                  <li key={item.origin + '-' + (item.id ?? index)} className="flex justify-between gap-3 py-2 text-sm">
                    <span>{item.date} · {item.label} · {item.origin === 'income' ? 'Ingreso' : 'Egreso'}</span>
                    <span>{money(item.value)}</span>
                  </li>
                ))}</ul>}
              <p className="mt-3 text-xs text-slate-500">Para consultar todos los movimientos individuales, utiliza la sección Movimientos.</p>
              <Link className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline" to="/movements">Ver movimientos</Link>
            </div>
          )}
          {!report.hasData && <p className="text-sm text-slate-500">No hay movimientos registrados hasta la fecha de corte.</p>}
        </>
      )}
    </section>
  )
}
