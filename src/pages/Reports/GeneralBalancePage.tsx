import { Download } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { listEarningPeriods } from '../../services/earningPeriodService'
import { listExpenses } from '../../services/expenseService'
import {
  buildGeneralBalanceBlocks,
  buildGeneralBalanceHtml,
  buildGeneralBalanceText,
  getPeriodLabel,
} from '../../services/generalBalanceExport'
import {
  buildGeneralBalance,
  getAvailableSections,
  getSectionsForLevel,
  type GeneralBalanceResult,
  type GeneralBalanceSectionId,
} from '../../services/generalBalanceService'
import { isValidCutoff } from '../../services/financialBalanceService'
import { listServiceIncomes } from '../../services/incomeService'
import { listInternalTransfers } from '../../services/internalTransferService'
import { listPersonalExpenseCategories } from '../../services/personalExpenseCategoryService'
import { listPersonalIncomeCategories } from '../../services/personalIncomeCategoryService'
import { getSettings } from '../../services/settingsService'
import { listWallets } from '../../services/walletService'
import { formatCurrency } from '../../utils/currency'
import { resolveActiveUsageMode } from '../../utils/usageMode'

type Level = 1 | 2 | 3 | 4 | 'custom'

function todayLocal(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function startOfYear(date: string) {
  return `${date.slice(0, 4)}-01-01`
}

const levelOptions: Array<{ value: Level; label: string; hint: string }> = [
  { value: 1, label: '1 · General', hint: 'Saldo inicial, variación y saldo final' },
  { value: 2, label: '2 · Componentes', hint: 'Ingresos principales, adicionales, egresos y ajustes' },
  { value: 3, label: '3 · Desglose', hint: 'Categorías, pagos, ubicación, temporadas o wallets, estado de reporte' },
  { value: 4, label: '4 · Detalle', hint: 'Ajustes y movimientos individuales' },
  { value: 'custom', label: 'Personalizado', hint: 'Elige las secciones una a una' },
]

const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const mutedClass = 'text-sm text-slate-600 dark:text-slate-400'
const inputClass = 'h-11 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950'

/**
 * Balance General: estado de saldos (inicial + periodo = final) con niveles
 * de información seleccionables. Vista de solo lectura sobre el motor
 * financiero existente; no es un Estado de Situación Financiera NIIF.
 */
export default function GeneralBalancePage() {
  const [to, setTo] = useState(todayLocal)
  const [from, setFrom] = useState(() => startOfYear(todayLocal()))
  const [wholeHistory, setWholeHistory] = useState(false)
  const [level, setLevel] = useState<Level>(2)
  const [customSections, setCustomSections] = useState<GeneralBalanceSectionId[]>(['components'])
  const [settingsVersion, setSettingsVersion] = useState(0)
  const [result, setResult] = useState<GeneralBalanceResult | null>(null)
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

  const effectiveFrom = wholeHistory ? null : from
  const rangeError = !wholeHistory && from > to ? 'La fecha inicial no puede ser posterior a la fecha de corte.' : ''

  useEffect(() => {
    // El aviso de rango inválido se pinta antes que el estado de carga.
    if (rangeError) return
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const [settings, incomes, expenses, transfers, wallets, seasons, incomeCategories, expenseCategories] =
          await Promise.all([
            getSettings(),
            listServiceIncomes({ to, newestFirst: true }),
            listExpenses({ to, newestFirst: true }),
            listInternalTransfers(),
            listWallets({ archived: 'all' }),
            listEarningPeriods(),
            listPersonalIncomeCategories({ archived: 'all' }),
            listPersonalExpenseCategories({ archived: 'all' }),
          ])
        if (!active) return
        setResult(
          buildGeneralBalance({
            incomes,
            expenses,
            transfers,
            wallets,
            seasons,
            personalIncomeCategories: incomeCategories,
            personalExpenseCategories: expenseCategories,
            currency: settings.defaultCurrency ?? 'EUR',
            usageMode: resolveActiveUsageMode(settings),
            from: effectiveFrom,
            to,
          }),
        )
      } catch {
        if (active) {
          setResult(null)
          setError('No se pudo calcular el balance general. Revisa el rango de fechas o los datos de las wallets.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [to, effectiveFrom, rangeError, settingsVersion])

  const usageMode = result?.usageMode ?? 'professional'
  const availableSections = useMemo(() => getAvailableSections(usageMode), [usageMode])
  const sections = useMemo<GeneralBalanceSectionId[]>(() => {
    if (level === 'custom') {
      return customSections.filter((id) => availableSections.some((section) => section.id === id))
    }
    return getSectionsForLevel(level, usageMode)
  }, [level, customSections, availableSections, usageMode])

  const money = useMemo(
    () => (value: number) => formatCurrency(value, result?.currency ?? 'EUR'),
    [result?.currency],
  )
  const blocks = useMemo(
    () => (result ? buildGeneralBalanceBlocks(result, sections, money) : []),
    [result, sections, money],
  )

  function toggleSection(id: GeneralBalanceSectionId) {
    const base = level === 'custom' ? customSections : sections
    const next = base.includes(id) ? base.filter((item) => item !== id) : [...base, id]
    setCustomSections(next)
    setLevel('custom')
  }

  async function handleExport() {
    if (!result) return
    setExporting(true)
    try {
      const { shareReportPdf } = await import('../../services/reportShareService')
      await shareReportPdf({
        fileName: `balance-general-${result.from ?? 'historial'}-${result.to}`,
        html: buildGeneralBalanceHtml(result, sections, money),
        text: buildGeneralBalanceText(result, sections, money),
        title: `Balance general ${getPeriodLabel(result)}`,
      })
    } catch {
      setError('No se pudo generar el PDF del balance general.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader backLabel="Reportes" backTo="/reports" eyebrow="Reportes" title="Balance general" />
      <p className={mutedClass}>
        Saldo inicial, movimientos del periodo y saldo final del modo activo, con el nivel de información que elijas.
        Las cifras salen del mismo motor que el resto de reportes.
      </p>

      <div className={`grid gap-3 sm:grid-cols-3 ${cardClass}`}>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Desde
          <input
            aria-label="Fecha inicial"
            className={`${inputClass} disabled:opacity-50`}
            disabled={wholeHistory}
            max={to}
            onChange={(event) => {
              const value = event.target.value
              if (isValidCutoff(value)) setFrom(value)
            }}
            type="date"
            value={from}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-300">
          Hasta (fecha de corte)
          <input
            aria-label="Fecha de corte"
            className={inputClass}
            max={todayLocal()}
            onChange={(event) => {
              const value = event.target.value
              setTo(isValidCutoff(value) ? value : todayLocal())
            }}
            type="date"
            value={to}
          />
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <input checked={wholeHistory} onChange={(event) => setWholeHistory(event.target.checked)} type="checkbox" />
          Todo el historial
        </label>
      </div>

      <fieldset className={cardClass}>
        <legend className="px-1 text-sm font-semibold text-slate-950 dark:text-white">Nivel de información</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {levelOptions.map((option) => (
            <button
              aria-pressed={level === option.value}
              className={[
                'h-10 rounded-md border px-3 text-sm font-semibold transition',
                level === option.value
                  ? 'border-emerald-700 bg-emerald-700 text-white'
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800',
              ].join(' ')}
              key={String(option.value)}
              onClick={() => {
                if (option.value === 'custom') setCustomSections(sections)
                setLevel(option.value)
              }}
              title={option.hint}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{levelOptions.find((option) => option.value === level)?.hint}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {availableSections.map((section) => (
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300" key={section.id}>
              <input
                checked={sections.includes(section.id)}
                className="mt-1"
                onChange={() => toggleSection(section.id)}
                type="checkbox"
              />
              <span>
                <span className="font-medium">{section.label}</span>
                <span className="block text-xs text-slate-500">{section.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {rangeError ? (
        <p className="text-red-700 dark:text-red-400" role="alert">{rangeError}</p>
      ) : loading ? (
        <p className={mutedClass} role="status">Calculando balance general…</p>
      ) : error && !result ? (
        <p className="text-red-700 dark:text-red-400" role="alert">{error}</p>
      ) : result ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className={cardClass}>
              <p className={mutedClass}>Saldo inicial</p>
              <p className="text-xl font-semibold text-slate-950 dark:text-white">{money(result.opening.balance)}</p>
              <p className="text-xs text-slate-500">{result.from ? `Antes del ${result.from}` : 'Sin movimientos previos'}</p>
            </div>
            <div className={cardClass}>
              <p className={mutedClass}>Variación del periodo</p>
              <p className="text-xl font-semibold text-slate-950 dark:text-white">{money(result.period.balance)}</p>
              <p className="text-xs text-slate-500">{getPeriodLabel(result)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">Saldo final</p>
              <p className="text-2xl font-bold text-emerald-950 dark:text-emerald-100">{money(result.closing.balance)}</p>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                Al {result.to} · Modo {result.usageMode === 'basic' ? 'Básico' : 'Profesional'}
              </p>
            </div>
          </div>

          {blocks.map((block) => (
            <div className={cardClass} key={block.title}>
              <h2 className="font-semibold text-slate-950 dark:text-white">{block.title}</h2>
              <div className={block.groups.length > 1 ? 'mt-3 grid gap-4 sm:grid-cols-2' : 'mt-3'}>
                {block.groups.map((group, groupIndex) => (
                  <div key={`${block.title}-${group.subtitle ?? groupIndex}`}>
                    {group.subtitle ? (
                      <h3 className="mb-1 text-sm font-semibold text-emerald-800 dark:text-emerald-400">{group.subtitle}</h3>
                    ) : null}
                    {group.rows.length === 0 && group.empty ? (
                      <p className="text-sm text-slate-500">{group.empty}</p>
                    ) : (
                      <dl className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                        {group.rows.map((row, rowIndex) => (
                          <div
                            className={[
                              'flex justify-between gap-3',
                              row.strong ? 'border-t border-slate-200 pt-1 font-semibold dark:border-slate-700' : '',
                            ].join(' ')}
                            key={`${row.label}-${rowIndex}`}
                          >
                            <dt className="min-w-0 break-words">{row.label}</dt>
                            <dd className="shrink-0 text-right">{row.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
              </div>
              {block.note ? <p className="mt-2 text-xs text-slate-500">{block.note}</p> : null}
              {block.title === 'Movimientos' ? (
                <Link className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-400" to="/movements">
                  Ver todos en Movimientos
                </Link>
              ) : null}
            </div>
          ))}

          {!result.hasData ? <p className={mutedClass}>No hay movimientos registrados hasta la fecha de corte.</p> : null}
          {error ? <p className="text-red-700 dark:text-red-400" role="alert">{error}</p> : null}

          <div>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              disabled={exporting}
              onClick={() => void handleExport()}
              type="button"
            >
              <Download aria-hidden="true" className="size-4" />
              {exporting ? 'Generando PDF…' : 'Exportar PDF con las secciones elegidas'}
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Balance calculado a partir de los registros, no saldo bancario certificado. La plataforma no registra
            activos, pasivos ni patrimonio, por lo que este reporte no es un Estado de Situación Financiera NIIF.
            En modo Híbrido se muestra solo el espacio activo.
          </p>
        </>
      ) : null}
    </section>
  )
}
