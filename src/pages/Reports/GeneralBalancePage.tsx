import { ChevronDown, Download, RotateCcw, StickyNote } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { listEarningPeriods } from '../../services/earningPeriodService'
import { listExpenses } from '../../services/expenseService'
import {
  availableChoices,
  buildGeneralBalanceBlocks,
  buildGeneralBalanceHtml,
  buildGeneralBalanceText,
  buildTemplateOptions,
  describeOptions,
  DETAIL_COLUMN_OPTIONS,
  DETAIL_GROUP_OPTIONS,
  DETAIL_SORT_OPTIONS,
  getPeriodLabel,
  MOVEMENT_KIND_OPTIONS,
  normalizeReportOptions,
  REPORT_TEMPLATES,
  type DetailColumn,
  type DetailGroupBy,
  type DetailSort,
  type GeneralBalanceDetailOptions,
  type GeneralBalanceReportOptions,
  type MovementKind,
  type ReportTemplateId,
} from '../../services/generalBalanceExport'
import {
  buildGeneralBalance,
  getAvailableSections,
  type FacetOption,
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

type UsageMode = 'basic' | 'professional'
type TemplateChoice = ReportTemplateId | 'custom'

interface ReportConfig {
  readonly template: TemplateChoice
  readonly options: GeneralBalanceReportOptions
}

const STORAGE_PREFIX = 'privateBalance.generalBalance.config.v1.'
const DEFAULT_TEMPLATE: ReportTemplateId = 'executive'

function todayLocal(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function startOfYear(date: string) {
  return `${date.slice(0, 4)}-01-01`
}

function defaultConfig(mode: UsageMode): ReportConfig {
  return { template: DEFAULT_TEMPLATE, options: buildTemplateOptions(DEFAULT_TEMPLATE, mode) }
}

/** Preferencia ligera por dispositivo; si el almacenamiento falla se usa la plantilla por defecto. */
function readStoredConfig(mode: UsageMode): ReportConfig | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + mode)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ReportConfig
    if (!parsed?.options?.sections || !parsed.options.detail) return null
    return { template: parsed.template ?? 'custom', options: normalizeReportOptions(parsed.options, mode) }
  } catch {
    return null
  }
}

function writeStoredConfig(mode: UsageMode, config: ReportConfig | null) {
  try {
    if (config) window.localStorage.setItem(STORAGE_PREFIX + mode, JSON.stringify(config))
    else window.localStorage.removeItem(STORAGE_PREFIX + mode)
  } catch {
    // Sin almacenamiento disponible: la configuración vive solo en esta sesión.
  }
}

const cardClass = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900'
const mutedClass = 'text-sm text-slate-600 dark:text-slate-400'
const inputClass = 'h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950'
const chipBase = 'inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition'
const chipOn = 'border-emerald-700 bg-emerald-700 text-white'
const chipOff = 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'

function Chip(props: { active: boolean; label: string; onClick: () => void; title?: string }) {
  return (
    <button
      aria-pressed={props.active}
      className={`${chipBase} ${props.active ? chipOn : chipOff}`}
      onClick={props.onClick}
      title={props.title}
      type="button"
    >
      {props.label}
    </button>
  )
}

function ConfigGroup(props: { title: string; hint?: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-lg border border-slate-200 dark:border-slate-800" open={props.defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2">
        <span>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">{props.title}</span>
          {props.hint ? <span className="block text-xs text-slate-500">{props.hint}</span> : null}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-500 transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">{props.children}</div>
    </details>
  )
}

function toggleInList<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/** Selección de facetas: `null` = todas. */
function toggleFacet(current: readonly string[] | null, all: readonly string[], key: string): string[] | null {
  const base = current ?? all
  const next = toggleInList(base, key)
  return next.length === all.length && all.every((item) => next.includes(item)) ? null : next
}

function FacetFilter(props: {
  title: string
  options: readonly FacetOption[]
  selected: readonly string[] | null
  onChange: (next: string[] | null) => void
}) {
  if (props.options.length === 0) return null
  const all = props.options.map((option) => option.key)
  const isOn = (key: string) => props.selected === null || props.selected.includes(key)
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{props.title}</p>
        <span className="flex gap-2 text-xs">
          <button className="font-semibold text-emerald-700 dark:text-emerald-400" onClick={() => props.onChange(null)} type="button">Todas</button>
          <button className="font-semibold text-slate-500" onClick={() => props.onChange([])} type="button">Ninguna</button>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {props.options.map((option) => (
          <Chip
            active={isOn(option.key)}
            key={option.key}
            label={`${option.label} · ${option.count}`}
            onClick={() => props.onChange(toggleFacet(props.selected, all, option.key))}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Balance General: estado de saldos (inicial + periodo = final) con
 * plantillas y parametrización del detalle. Vista de solo lectura sobre el
 * motor financiero existente; no es un Estado de Situación Financiera NIIF.
 */
export default function GeneralBalancePage() {
  const [to, setTo] = useState(todayLocal)
  const [from, setFrom] = useState(() => startOfYear(todayLocal()))
  const [wholeHistory, setWholeHistory] = useState(false)
  const [configs, setConfigs] = useState<Partial<Record<UsageMode, ReportConfig>>>({})
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
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

  const usageMode: UsageMode = result?.usageMode ?? 'professional'
  const storedConfig = useMemo(() => readStoredConfig(usageMode), [usageMode])
  const config = configs[usageMode] ?? storedConfig ?? defaultConfig(usageMode)
  const options = useMemo(() => normalizeReportOptions(config.options, usageMode), [config.options, usageMode])
  const detail = options.detail
  const availableSections = useMemo(() => getAvailableSections(usageMode), [usageMode])

  function saveConfig(next: ReportConfig) {
    setConfigs((current) => ({ ...current, [usageMode]: next }))
    writeStoredConfig(usageMode, next)
  }
  function applyTemplate(template: ReportTemplateId) {
    saveConfig({ template, options: buildTemplateOptions(template, usageMode) })
  }
  function updateOptions(patch: Partial<GeneralBalanceReportOptions>) {
    saveConfig({ template: 'custom', options: { ...options, ...patch } })
  }
  function updateDetail(patch: Partial<GeneralBalanceDetailOptions>) {
    updateOptions({ detail: { ...detail, ...patch } })
  }
  function resetConfig() {
    setConfigs((current) => ({ ...current, [usageMode]: defaultConfig(usageMode) }))
    writeStoredConfig(usageMode, null)
  }

  const money = useMemo(
    () => (value: number) => formatCurrency(value, result?.currency ?? 'EUR'),
    [result?.currency],
  )
  const blocks = useMemo(
    () => (result ? buildGeneralBalanceBlocks(result, options, money) : []),
    [result, options, money],
  )
  const configSummary = useMemo(() => (result ? describeOptions(result, options) : []), [result, options])
  const movementsOn = options.sections.includes('movements')
  const facets = result?.facets
  const incomeCategoryFacets = facets?.categories.filter((facet) => facet.origin === 'income') ?? []
  const expenseCategoryFacets = facets?.categories.filter((facet) => facet.origin === 'expense') ?? []
  const allCategoryKeys = facets?.categories.map((facet) => facet.key) ?? []

  function setCategoryFilter(origin: 'income' | 'expense', next: string[] | null) {
    const others = (facets?.categories ?? []).filter((facet) => facet.origin !== origin).map((facet) => facet.key)
    const currentOthers = detail.categoryKeys === null ? others : detail.categoryKeys.filter((key) => others.includes(key))
    const ownAll = (facets?.categories ?? []).filter((facet) => facet.origin === origin).map((facet) => facet.key)
    const merged = [...currentOthers, ...(next ?? ownAll)]
    updateDetail({ categoryKeys: merged.length === allCategoryKeys.length ? null : merged })
  }
  function categorySelection(origin: 'income' | 'expense') {
    if (detail.categoryKeys === null) return null
    const own = (facets?.categories ?? []).filter((facet) => facet.origin === origin).map((facet) => facet.key)
    const selected = detail.categoryKeys.filter((key) => own.includes(key))
    return selected.length === own.length ? null : selected
  }

  async function handleExport() {
    if (!result) return
    setExporting(true)
    try {
      const { shareReportPdf } = await import('../../services/reportShareService')
      await shareReportPdf({
        fileName: `balance-general-${result.from ?? 'historial'}-${result.to}`,
        html: buildGeneralBalanceHtml(result, options, money),
        text: buildGeneralBalanceText(result, options, money),
        title: `Balance general ${getPeriodLabel(result)}`,
      })
    } catch {
      setError('No se pudo generar el PDF del balance general.')
    } finally {
      setExporting(false)
    }
  }

  const templateHint = config.template === 'custom'
    ? 'Configuración personalizada. Se guarda en este dispositivo para el modo activo.'
    : REPORT_TEMPLATES.find((template) => template.id === config.template)?.description

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <PageHeader backLabel="Reportes" backTo="/reports" eyebrow="Reportes" title="Balance general" />
      <p className={mutedClass}>
        Saldo inicial, movimientos del periodo y saldo final del modo activo. Elige una plantilla o ajusta qué
        información ver; los saldos siempre corresponden al modo completo.
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

      <section aria-labelledby="gb-config-title" className={`flex flex-col gap-3 ${cardClass}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white" id="gb-config-title">Configuración del reporte</h2>
            <p className="text-xs text-slate-500">{templateHint}</p>
          </div>
          <button
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
            onClick={resetConfig}
            type="button"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Restablecer
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {REPORT_TEMPLATES.map((template) => (
            <button
              aria-pressed={config.template === template.id}
              className={`h-10 rounded-md border text-sm font-semibold transition ${config.template === template.id ? chipOn : chipOff}`}
              key={template.id}
              onClick={() => applyTemplate(template.id)}
              title={template.description}
              type="button"
            >
              {template.label}
            </button>
          ))}
          <button
            aria-pressed={config.template === 'custom'}
            className={`h-10 rounded-md border text-sm font-semibold transition ${config.template === 'custom' ? chipOn : chipOff}`}
            onClick={() => saveConfig({ template: 'custom', options })}
            type="button"
          >
            Personalizado
          </button>
        </div>

        {configSummary.length > 0 ? (
          <ul className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
            {configSummary.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : null}

        <ConfigGroup hint="Qué bloques aparecen en el reporte" title="Secciones">
          <div className="grid gap-2 sm:grid-cols-2">
            {availableSections.map((section) => (
              <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300" key={section.id}>
                <input
                  checked={options.sections.includes(section.id)}
                  className="mt-1"
                  onChange={() => updateOptions({ sections: toggleInList<GeneralBalanceSectionId>(options.sections, section.id) })}
                  type="checkbox"
                />
                <span>
                  <span className="font-medium">{section.label}</span>
                  <span className="block text-xs text-slate-500">{section.description}</span>
                </span>
              </label>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input checked={detail.showShares} onChange={() => updateDetail({ showShares: !detail.showShares })} type="checkbox" />
            Mostrar porcentajes sobre el total en los desgloses
          </label>
          {usageMode === 'basic' ? (
            <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                checked={detail.showTransfers}
                disabled={!options.sections.includes('wallets')}
                onChange={() => updateDetail({ showTransfers: !detail.showTransfers })}
                type="checkbox"
              />
              Listar transferencias internas{options.sections.includes('wallets') ? '' : ' (requiere Wallets)'}
            </label>
          ) : null}
        </ConfigGroup>

        {movementsOn ? (
          <>
            <ConfigGroup hint="Cómo se presentan los registros individuales" title="Detalle de registros">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Agrupar por
                  <select
                    className={inputClass}
                    onChange={(event) => updateDetail({ groupBy: event.target.value as DetailGroupBy })}
                    value={detail.groupBy}
                  >
                    {availableChoices(DETAIL_GROUP_OPTIONS, usageMode).map((choice) => (
                      <option key={choice.value} value={choice.value}>{choice.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Ordenar
                  <select
                    className={inputClass}
                    onChange={(event) => updateDetail({ sort: event.target.value as DetailSort })}
                    value={detail.sort}
                  >
                    {DETAIL_SORT_OPTIONS.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                </label>
              </div>
              <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Datos de cada registro</p>
              <div className="flex flex-wrap gap-2">
                {availableChoices(DETAIL_COLUMN_OPTIONS, usageMode).map((choice) => (
                  <Chip
                    active={detail.columns.includes(choice.value)}
                    key={choice.value}
                    label={choice.label}
                    onClick={() => updateDetail({ columns: toggleInList<DetailColumn>(detail.columns, choice.value) })}
                  />
                ))}
              </div>
            </ConfigGroup>

            <ConfigGroup hint="Acotan solo el detalle; los saldos no cambian" title="Filtros del detalle">
              <div className="flex flex-col gap-4">
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de movimiento</p>
                  <div className="flex flex-wrap gap-2">
                    {MOVEMENT_KIND_OPTIONS.map((choice) => (
                      <Chip
                        active={detail.kinds.includes(choice.value)}
                        key={choice.value}
                        label={choice.label}
                        onClick={() => {
                          const next = toggleInList<MovementKind>(detail.kinds, choice.value)
                          if (next.length > 0) updateDetail({ kinds: next })
                        }}
                      />
                    ))}
                  </div>
                </div>
                <FacetFilter
                  onChange={(next) => setCategoryFilter('income', next)}
                  options={incomeCategoryFacets}
                  selected={categorySelection('income')}
                  title={usageMode === 'basic' ? 'Categorías de ingreso' : 'Tipos de ingreso'}
                />
                <FacetFilter
                  onChange={(next) => setCategoryFilter('expense', next)}
                  options={expenseCategoryFacets}
                  selected={categorySelection('expense')}
                  title="Categorías de egreso"
                />
                {usageMode === 'basic' ? (
                  <FacetFilter
                    onChange={(next) => updateDetail({ walletIds: next })}
                    options={facets?.wallets ?? []}
                    selected={detail.walletIds}
                    title="Wallets"
                  />
                ) : (
                  <FacetFilter
                    onChange={(next) => updateDetail({ seasonKeys: next })}
                    options={facets?.seasons ?? []}
                    selected={detail.seasonKeys}
                    title="Temporadas"
                  />
                )}
              </div>
            </ConfigGroup>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            Activa la sección <span className="font-semibold">Movimientos</span> para ver cada registro con su categoría,
            wallet y notas, y configurar agrupación y filtros.
          </p>
        )}
      </section>

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
                Al {result.to} · {result.usageMode === 'basic' ? 'Personal' : 'Profesional'}
              </p>
            </div>
          </div>

          {blocks.length > 2 ? (
            <div className="flex justify-end gap-3 text-xs font-semibold">
              <button className="text-emerald-700 dark:text-emerald-400" onClick={() => setCollapsed(new Set())} type="button">Desplegar todo</button>
              <button className="text-slate-500" onClick={() => setCollapsed(new Set(blocks.map((block) => block.id)))} type="button">Plegar todo</button>
            </div>
          ) : null}

          {blocks.map((block) => {
            const isOpen = !collapsed.has(block.id)
            return (
              <section className={cardClass} key={block.id}>
                <button
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setCollapsed((current) => {
                    const next = new Set(current)
                    if (next.has(block.id)) next.delete(block.id)
                    else next.add(block.id)
                    return next
                  })}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold text-slate-950 dark:text-white">{block.title}</span>
                    {block.headline ? <span className="block text-xs text-slate-500">{block.headline}</span> : null}
                  </span>
                  <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 transition ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen ? (
                  <>
                    <div className={block.groups.length > 1 && block.id !== 'movements' ? 'mt-3 grid gap-4 sm:grid-cols-2' : 'mt-3 flex flex-col gap-4'}>
                      {block.groups.map((group, groupIndex) => (
                        <div key={`${block.id}-${group.subtitle ?? groupIndex}`}>
                          {group.subtitle ? (
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 border-b border-slate-100 pb-1 dark:border-slate-800">
                              <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">{group.subtitle}</h3>
                              {group.summary ? <span className="text-xs text-slate-500">{group.summary}</span> : null}
                            </div>
                          ) : null}
                          {group.rows.length === 0 && group.empty ? (
                            <p className="text-sm text-slate-500">{group.empty}</p>
                          ) : (
                            <dl className="divide-y divide-slate-50 text-sm text-slate-700 dark:divide-slate-800/60 dark:text-slate-300">
                              {group.rows.map((row, rowIndex) => (
                                <div
                                  className={[
                                    'flex justify-between gap-3 py-1',
                                    row.strong ? 'border-t border-slate-200 font-semibold dark:border-slate-700' : '',
                                  ].join(' ')}
                                  key={`${row.label}-${rowIndex}`}
                                >
                                  <dt className="min-w-0 break-words">
                                    {row.label}
                                    {row.secondary?.length ? (
                                      <span className="mt-0.5 flex flex-wrap gap-1">
                                        {row.secondary.map((item, itemIndex) => (
                                          <span
                                            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                            key={`${item}-${itemIndex}`}
                                          >
                                            {item}
                                          </span>
                                        ))}
                                      </span>
                                    ) : null}
                                    {row.note ? (
                                      <span className="mt-0.5 flex items-start gap-1 text-xs font-normal italic text-slate-500">
                                        <StickyNote aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                                        {row.note}
                                      </span>
                                    ) : null}
                                  </dt>
                                  <dd className="shrink-0 text-right tabular-nums">{row.value}</dd>
                                </div>
                              ))}
                            </dl>
                          )}
                        </div>
                      ))}
                    </div>
                    {block.note ? <p className="mt-2 text-xs text-slate-500">{block.note}</p> : null}
                    {block.id === 'movements' ? (
                      <Link className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline dark:text-emerald-400" to="/movements">
                        Abrir Movimientos
                      </Link>
                    ) : null}
                  </>
                ) : null}
              </section>
            )
          })}

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
              {exporting ? 'Generando PDF…' : 'Exportar PDF con esta configuración'}
            </button>
            <p className="mt-1 text-xs text-slate-500">El PDF incluye todas las secciones elegidas, aunque estén plegadas en pantalla.</p>
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
