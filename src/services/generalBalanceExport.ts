import type {
  BalanceTotals,
  GeneralBalanceMovement,
  GeneralBalanceResult,
  GeneralBalanceSectionId,
  GroupedAmount,
} from './generalBalanceService'
import { GENERAL_BALANCE_SECTIONS, getAvailableSections, getSectionsForLevel } from './generalBalanceService'
import { roundMoney } from '../utils/currency'

/**
 * Presentación del Balance General: convierte el resultado del servicio y
 * las opciones elegidas por el usuario en bloques que comparten la pantalla
 * y el PDF. No calcula saldos: solo selecciona, agrupa y ordena lo que el
 * servicio ya calculó. Los filtros afectan solo al detalle de registros;
 * el resumen y los saldos son siempre los del modo completo.
 */

/** Máximo de movimientos individuales mostrados/exportados (rendimiento en móvil). */
export const GENERAL_BALANCE_EXPORT_MOVEMENT_LIMIT = 500

type Money = (value: number) => string
type UsageMode = 'basic' | 'professional'

export type MovementKind = GeneralBalanceMovement['kind']
export type DetailGroupBy = 'none' | 'month' | 'category' | 'wallet' | 'season' | 'paymentType' | 'kind'
export type DetailColumn = 'category' | 'wallet' | 'paymentType' | 'location' | 'season' | 'reportStatus' | 'notes'
export type DetailSort = 'dateDesc' | 'dateAsc' | 'amountDesc'
export type ReportTemplateId = 'executive' | 'analysis' | 'audit'

export interface GeneralBalanceDetailOptions {
  readonly groupBy: DetailGroupBy
  readonly columns: readonly DetailColumn[]
  readonly kinds: readonly MovementKind[]
  /** `null` = todas. */
  readonly categoryKeys: readonly string[] | null
  readonly walletIds: readonly string[] | null
  readonly seasonKeys: readonly string[] | null
  readonly sort: DetailSort
  /** Lista de transferencias internas con sus notas (solo Personal). */
  readonly showTransfers: boolean
  /** Porcentaje sobre el total en los desgloses. */
  readonly showShares: boolean
}

export interface GeneralBalanceReportOptions {
  readonly sections: readonly GeneralBalanceSectionId[]
  readonly detail: GeneralBalanceDetailOptions
}

interface Choice<T extends string> { readonly value: T; readonly label: string; readonly modes: readonly UsageMode[] }

const BOTH: readonly UsageMode[] = ['basic', 'professional']

export const DETAIL_GROUP_OPTIONS: readonly Choice<DetailGroupBy>[] = [
  { value: 'none', label: 'Sin agrupar', modes: BOTH },
  { value: 'month', label: 'Mes', modes: BOTH },
  { value: 'category', label: 'Categoría', modes: BOTH },
  { value: 'wallet', label: 'Wallet', modes: ['basic'] },
  { value: 'season', label: 'Temporada', modes: ['professional'] },
  { value: 'paymentType', label: 'Tipo de pago', modes: BOTH },
  { value: 'kind', label: 'Tipo de movimiento', modes: BOTH },
]

export const DETAIL_COLUMN_OPTIONS: readonly Choice<DetailColumn>[] = [
  { value: 'category', label: 'Categoría', modes: BOTH },
  { value: 'wallet', label: 'Wallet', modes: ['basic'] },
  { value: 'season', label: 'Temporada', modes: ['professional'] },
  { value: 'paymentType', label: 'Tipo de pago', modes: BOTH },
  { value: 'location', label: 'Ubicación', modes: BOTH },
  { value: 'reportStatus', label: 'Estado de reporte', modes: BOTH },
  { value: 'notes', label: 'Notas y observaciones', modes: BOTH },
]

export const DETAIL_SORT_OPTIONS: readonly { value: DetailSort; label: string }[] = [
  { value: 'dateDesc', label: 'Más recientes primero' },
  { value: 'dateAsc', label: 'Más antiguos primero' },
  { value: 'amountDesc', label: 'Mayor importe primero' },
]

export const MOVEMENT_KIND_OPTIONS: readonly { value: MovementKind; label: string }[] = [
  { value: 'income', label: 'Ingresos' },
  { value: 'expense', label: 'Egresos' },
  { value: 'adjustment', label: 'Ajustes' },
]

export function availableChoices<T extends string>(choices: readonly Choice<T>[], usageMode: UsageMode) {
  return choices.filter((choice) => choice.modes.includes(usageMode))
}

export const REPORT_TEMPLATES: readonly { id: ReportTemplateId; label: string; description: string }[] = [
  { id: 'executive', label: 'Ejecutivo', description: 'Saldos y componentes. Una página, sin detalle de registros.' },
  { id: 'analysis', label: 'Análisis', description: 'Desgloses con porcentajes por categoría, wallet o temporada.' },
  { id: 'audit', label: 'Auditoría', description: 'Todo: cada registro con categoría, wallet, notas y transferencias.' },
]

export function defaultDetailOptions(usageMode: UsageMode): GeneralBalanceDetailOptions {
  return {
    groupBy: 'none',
    columns: usageMode === 'basic' ? ['category', 'wallet'] : ['category', 'season'],
    kinds: ['income', 'expense', 'adjustment'],
    categoryKeys: null,
    walletIds: null,
    seasonKeys: null,
    sort: 'dateDesc',
    showTransfers: false,
    showShares: true,
  }
}

export function buildTemplateOptions(template: ReportTemplateId, usageMode: UsageMode): GeneralBalanceReportOptions {
  const base = defaultDetailOptions(usageMode)
  if (template === 'executive') {
    return { sections: getSectionsForLevel(2, usageMode), detail: { ...base, showShares: false } }
  }
  if (template === 'analysis') {
    return { sections: getSectionsForLevel(3, usageMode), detail: { ...base, showShares: true } }
  }
  return {
    sections: getSectionsForLevel(4, usageMode),
    detail: {
      ...base,
      groupBy: usageMode === 'basic' ? 'category' : 'season',
      columns: availableChoices(DETAIL_COLUMN_OPTIONS, usageMode).map((choice) => choice.value),
      showTransfers: usageMode === 'basic',
      showShares: true,
    },
  }
}

/** Descarta opciones que no existen en el modo (p. ej. tras cambiar de espacio). */
export function normalizeReportOptions(
  options: GeneralBalanceReportOptions,
  usageMode: UsageMode,
): GeneralBalanceReportOptions {
  const sectionIds = new Set(getAvailableSections(usageMode).map((section) => section.id))
  const groupIds = new Set(availableChoices(DETAIL_GROUP_OPTIONS, usageMode).map((choice) => choice.value))
  const columnIds = new Set(availableChoices(DETAIL_COLUMN_OPTIONS, usageMode).map((choice) => choice.value))
  const fallback = defaultDetailOptions(usageMode)
  const detail = { ...fallback, ...options.detail }
  return {
    sections: options.sections.filter((id) => sectionIds.has(id)),
    detail: {
      ...detail,
      groupBy: groupIds.has(detail.groupBy) ? detail.groupBy : 'none',
      columns: detail.columns.filter((column) => columnIds.has(column)),
      kinds: detail.kinds.length > 0 ? detail.kinds : fallback.kinds,
      walletIds: usageMode === 'basic' ? detail.walletIds : null,
      seasonKeys: usageMode === 'professional' ? detail.seasonKeys : null,
      showTransfers: usageMode === 'basic' && detail.showTransfers,
    },
  }
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function getPeriodLabel(result: Pick<GeneralBalanceResult, 'from' | 'to'>) {
  return result.from ? `${result.from} a ${result.to}` : `Todo el historial hasta ${result.to}`
}

/** Importe que resta: "-X", pero nunca "-0". */
function minus(money: Money, value: number) {
  return value === 0 ? money(0) : `-${money(value)}`
}

function share(value: number, total: number) {
  if (total === 0) return ''
  return `${Math.round((value / total) * 1000) / 10} %`
}

function sectionTitle(id: GeneralBalanceSectionId) {
  return GENERAL_BALANCE_SECTIONS.find((section) => section.id === id)?.label ?? id
}

export interface ReportRow {
  readonly label: string
  readonly value: string
  readonly strong?: boolean
  /** Atributos secundarios del registro (categoría, wallet…). */
  readonly secondary?: readonly string[]
  readonly note?: string
}

export interface ReportGroup {
  readonly subtitle?: string
  /** Resumen del grupo (n.º de registros y subtotal). */
  readonly summary?: string
  readonly rows: readonly ReportRow[]
  readonly empty?: string
}

export interface ReportBlock {
  readonly id: 'summary' | GeneralBalanceSectionId | 'transfers'
  readonly title: string
  /** Cifra clave visible aunque la sección esté plegada. */
  readonly headline?: string
  readonly groups: readonly ReportGroup[]
  readonly note?: string
}

function summaryRows(result: GeneralBalanceResult, money: Money): ReportRow[] {
  return [
    { label: result.from ? 'Saldo inicial' : 'Saldo inicial (sin movimientos previos)', value: money(result.opening.balance) },
    { label: 'Total recibido en el periodo', value: money(result.period.totalReceived) },
    { label: 'Egresos del periodo', value: minus(money, result.period.expenses) },
    { label: 'Impacto neto de ajustes', value: money(result.period.adjustmentImpact) },
    { label: 'Variación del periodo', value: money(result.period.balance) },
    { label: 'Saldo final', value: money(result.closing.balance), strong: true },
  ]
}

function componentRows(totals: BalanceTotals, money: Money): ReportRow[] {
  return [
    { label: 'Ingresos principales (P)', value: money(totals.principalIncome) },
    { label: 'Ingresos adicionales (A)', value: money(totals.additionalIncome) },
    { label: 'Total recibido (P + A)', value: money(totals.totalReceived) },
    { label: 'Egresos (E)', value: minus(money, totals.expenses) },
    { label: 'Resultado de la actividad (P - E)', value: money(totals.activityResult) },
    { label: 'Ajustes positivos', value: money(totals.adjustmentsPositive) },
    { label: 'Ajustes negativos', value: minus(money, totals.adjustmentsNegative) },
    { label: 'Balance del periodo', value: money(totals.balance), strong: true },
  ]
}

/** Un desglose por ubicación solo aporta si algún registro tiene ubicación. */
function hasLocations(rows: readonly GroupedAmount[]) {
  return rows.some((row) => row.label !== 'Sin ubicación')
}

function groupRows(rows: readonly GroupedAmount[], total: number, money: Money, showShares: boolean): ReportRow[] {
  return rows.map((row) => {
    const pct = showShares ? share(row.total, total) : ''
    return { label: `${row.label} (${row.count})`, value: pct ? `${money(row.total)} · ${pct}` : money(row.total) }
  })
}

// --- Detalle de registros -------------------------------------------------

const KIND_LABEL: Record<MovementKind, string> = { income: 'Ingresos', expense: 'Egresos', adjustment: 'Ajustes' }

function monthLabel(date: string) {
  const [year, month] = date.split('-').map(Number)
  if (!year || !month) return date
  const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function groupKeyOf(movement: GeneralBalanceMovement, groupBy: DetailGroupBy): { key: string; label: string } {
  switch (groupBy) {
    case 'month': return { key: movement.date.slice(0, 7), label: monthLabel(movement.date) }
    case 'category': return { key: movement.categoryKey, label: `${movement.categoryLabel} · ${movement.origin === 'income' ? 'ingreso' : 'egreso'}` }
    case 'wallet': return { key: movement.walletId ?? '', label: movement.walletName ?? 'Sin wallet' }
    case 'season': return { key: String(movement.seasonId ?? 'none'), label: movement.seasonName ?? 'Sin temporada' }
    case 'paymentType': return { key: movement.paymentTypeLabel ?? '', label: movement.paymentTypeLabel ?? 'Sin tipo de pago (ajustes y egresos)' }
    case 'kind': return { key: movement.kind, label: KIND_LABEL[movement.kind] }
    default: return { key: 'all', label: '' }
  }
}

export function selectMovements(
  result: GeneralBalanceResult,
  detail: GeneralBalanceDetailOptions,
): GeneralBalanceMovement[] {
  const kinds = new Set(detail.kinds)
  const categories = detail.categoryKeys ? new Set(detail.categoryKeys) : null
  const wallets = detail.walletIds ? new Set(detail.walletIds) : null
  const seasons = detail.seasonKeys ? new Set(detail.seasonKeys) : null
  const filtered = result.movements.filter((movement) =>
    kinds.has(movement.kind) &&
    (!categories || categories.has(movement.categoryKey)) &&
    (!wallets || wallets.has(movement.walletId ?? '')) &&
    (!seasons || seasons.has(String(movement.seasonId ?? 'none'))),
  )
  const sorted = [...filtered]
  if (detail.sort === 'dateAsc') sorted.sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0))
  else if (detail.sort === 'amountDesc') sorted.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount) || b.date.localeCompare(a.date))
  return sorted
}

function movementRow(movement: GeneralBalanceMovement, columns: ReadonlySet<DetailColumn>, groupBy: DetailGroupBy, money: Money): ReportRow {
  const secondary: string[] = []
  // No se repite el atributo por el que ya se agrupa.
  if (columns.has('category') && groupBy !== 'category') secondary.push(movement.categoryLabel)
  if (columns.has('wallet') && groupBy !== 'wallet' && movement.walletName) secondary.push(movement.walletName)
  if (columns.has('season') && groupBy !== 'season' && movement.seasonName) secondary.push(movement.seasonName)
  if (columns.has('paymentType') && groupBy !== 'paymentType' && movement.paymentTypeLabel) secondary.push(movement.paymentTypeLabel)
  if (columns.has('location') && movement.locationLabel !== 'Sin ubicación') secondary.push(movement.locationLabel)
  if (columns.has('reportStatus')) secondary.push(movement.reportStatusLabel)
  return {
    label: `${movement.date} · ${movement.label}`,
    value: money(movement.amount),
    secondary: secondary.length > 0 ? secondary : undefined,
    note: columns.has('notes') ? movement.notes : undefined,
  }
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? 'registro' : 'registros'}`
}

function buildMovementsBlock(result: GeneralBalanceResult, detail: GeneralBalanceDetailOptions, money: Money): ReportBlock {
  const selected = selectMovements(result, detail)
  const shown = selected.slice(0, GENERAL_BALANCE_EXPORT_MOVEMENT_LIMIT)
  const columns = new Set(detail.columns)
  const total = roundMoney(selected.reduce((sum, movement) => sum + movement.amount, 0))

  let groups: ReportGroup[]
  if (detail.groupBy === 'none') {
    groups = [{ rows: shown.map((movement) => movementRow(movement, columns, 'none', money)), empty: 'Sin movimientos con estos criterios' }]
  } else {
    const map = new Map<string, { label: string; rank: number; items: GeneralBalanceMovement[] }>()
    for (const movement of shown) {
      const { key, label } = groupKeyOf(movement, detail.groupBy)
      const rank = movement.kind === 'income' ? 0 : movement.kind === 'expense' ? 1 : 2
      const entry = map.get(key) ?? { label, rank, items: [] }
      entry.rank = Math.min(entry.rank, rank)
      entry.items.push(movement)
      map.set(key, entry)
    }
    const entries = Array.from(map.values())
    if (detail.groupBy === 'month') entries.sort((a, b) => b.items[0].date.localeCompare(a.items[0].date))
    else entries.sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'es'))
    groups = entries.map((entry) => {
      const subtotal = roundMoney(entry.items.reduce((sum, movement) => sum + movement.amount, 0))
      return {
        subtitle: entry.label,
        summary: `${countLabel(entry.items.length)} · ${money(subtotal)}`,
        rows: entry.items.map((movement) => movementRow(movement, columns, detail.groupBy, money)),
      }
    })
    if (groups.length === 0) groups = [{ rows: [], empty: 'Sin movimientos con estos criterios' }]
  }

  const notes: string[] = []
  if (selected.length < result.movements.length) {
    notes.push(`Detalle filtrado: ${selected.length} de ${result.movements.length} registros. Los saldos del resumen no cambian con los filtros.`)
  }
  if (shown.length < selected.length) {
    notes.push(`Se muestran ${shown.length} de ${selected.length} registros. Acota el periodo o los filtros para ver el resto.`)
  }
  return {
    id: 'movements',
    title: sectionTitle('movements'),
    headline: `${countLabel(selected.length)} · neto ${money(total)}`,
    groups,
    note: notes.length > 0 ? notes.join(' ') : undefined,
  }
}

// --- Bloques --------------------------------------------------------------

export function buildGeneralBalanceBlocks(
  result: GeneralBalanceResult,
  options: GeneralBalanceReportOptions,
  money: Money,
): ReportBlock[] {
  const { detail } = normalizeReportOptions(options, result.usageMode)
  const selected = new Set(options.sections)
  const totalReceived = result.period.totalReceived
  const totalExpenses = result.period.expenses
  const blocks: ReportBlock[] = [{
    id: 'summary',
    title: 'Resumen',
    headline: `Saldo final ${money(result.closing.balance)}`,
    groups: [{ rows: summaryRows(result, money) }],
  }]

  if (selected.has('components')) {
    blocks.push({
      id: 'components',
      title: sectionTitle('components'),
      headline: `Balance del periodo ${money(result.period.balance)}`,
      groups: [{ rows: componentRows(result.period, money) }],
    })
  }
  if (selected.has('incomeBreakdown')) {
    blocks.push({
      id: 'incomeBreakdown',
      title: sectionTitle('incomeBreakdown'),
      headline: `Total recibido ${money(totalReceived)}`,
      groups: [
        ...(result.usageMode === 'basic'
          ? [{ subtitle: 'Por categoría', rows: groupRows(result.incomesByCategory, totalReceived, money, detail.showShares), empty: 'Sin ingresos' }]
          : [{ subtitle: 'Por tipo', rows: groupRows(result.incomesByType, totalReceived, money, detail.showShares), empty: 'Sin ingresos' }]),
        { subtitle: 'Por tipo de pago', rows: groupRows(result.incomesByPaymentType, totalReceived, money, detail.showShares), empty: 'Sin ingresos' },
        ...(hasLocations(result.incomesByLocation)
          ? [{ subtitle: 'Por ubicación', rows: groupRows(result.incomesByLocation, totalReceived, money, detail.showShares) }]
          : []),
      ],
    })
  }
  if (selected.has('expenseBreakdown')) {
    blocks.push({
      id: 'expenseBreakdown',
      title: sectionTitle('expenseBreakdown'),
      headline: `Egresos ${money(totalExpenses)}`,
      groups: [
        { subtitle: 'Por categoría', rows: groupRows(result.expensesByCategory, totalExpenses, money, detail.showShares), empty: 'Sin egresos' },
        ...(hasLocations(result.expensesByLocation)
          ? [{ subtitle: 'Por ubicación', rows: groupRows(result.expensesByLocation, totalExpenses, money, detail.showShares) }]
          : []),
      ],
    })
  }
  if (selected.has('seasons') && result.usageMode === 'professional') {
    blocks.push({
      id: 'seasons',
      title: sectionTitle('seasons'),
      headline: `${result.seasons.length} ${result.seasons.length === 1 ? 'temporada' : 'temporadas'}`,
      groups: result.seasons.length === 0
        ? [{ rows: [], empty: 'Sin movimientos por temporada en el periodo' }]
        : result.seasons.map((season) => ({
            subtitle: `${season.name}${season.status === 'active' ? ' · Activa' : season.status === 'closed' ? ' · Cerrada' : ''}`,
            summary: detail.showShares && result.period.balance !== 0
              ? `${share(season.totals.balance, result.period.balance)} del balance del periodo`
              : undefined,
            rows: [
              { label: 'Total recibido', value: money(season.totals.totalReceived) },
              { label: 'Egresos', value: minus(money, season.totals.expenses) },
              { label: 'Ajustes', value: money(season.totals.adjustmentImpact) },
              { label: 'Balance en el periodo', value: money(season.totals.balance), strong: true },
              ...(season.goal !== null && season.goalResult !== null
                ? [{ label: 'Meta (hasta el corte)', value: `${money(season.goalResult)} de ${money(season.goal)} · ${season.goalPercentage ?? 0} %` }]
                : []),
            ],
          })),
    })
  }
  if (selected.has('wallets') && result.usageMode === 'basic') {
    const reconciliation = result.walletReconciliation
    const walletSections = result.wallets?.wallets ?? []
    const totalAvailable = result.wallets?.totalAvailable ?? 0
    blocks.push({
      id: 'wallets',
      title: sectionTitle('wallets'),
      headline: `Suma de wallets ${money(totalAvailable)}`,
      groups: walletSections.length === 0
        ? [{ rows: [], empty: 'Sin wallets con saldo o actividad' }]
        : [
            ...walletSections.map((wallet) => ({
              subtitle: `${wallet.walletName}${wallet.isDefault ? ' · Predeterminada' : ''}${wallet.isArchived ? ' · Archivada' : ''}`,
              summary: detail.showShares && totalAvailable !== 0
                ? `${share(wallet.closingBalance, totalAvailable)} del total en wallets`
                : undefined,
              rows: [
                { label: 'Saldo inicial', value: money(wallet.openingBalance) },
                { label: 'Ingresos', value: money(wallet.externalIncomeTotal) },
                { label: 'Transferencias recibidas', value: money(wallet.transferReceivedTotal) },
                { label: 'Egresos', value: minus(money, wallet.expenseTotal) },
                { label: 'Transferencias enviadas', value: minus(money, wallet.transferSentTotal) },
                { label: 'Ajustes', value: money(wallet.adjustmentTotal) },
                { label: 'Saldo final', value: money(wallet.closingBalance), strong: true },
              ],
            })),
            {
              subtitle: 'Conciliación',
              rows: [
                { label: 'Suma de wallets', value: money(reconciliation?.walletsTotal ?? 0) },
                { label: 'Saldo final general', value: money(reconciliation?.generalClosing ?? 0) },
                { label: 'Movimientos sin wallet asignada', value: money(reconciliation?.unassignedDifference ?? 0) },
              ],
            },
          ],
      note: reconciliation?.hasCurrencyMismatchTransfers
        ? 'Hay transferencias en otra moneda que no se incluyen en los saldos por wallet.'
        : undefined,
    })
    if (detail.showTransfers) {
      const movedTotal = roundMoney(result.transfers.reduce((sum, transfer) => sum + transfer.amount, 0))
      blocks.push({
        id: 'transfers',
        title: 'Transferencias internas',
        headline: `${countLabel(result.transfers.length)} · ${money(movedTotal)} movidos`,
        groups: [{
          rows: result.transfers.map((transfer) => ({
            label: `${transfer.date} · ${transfer.fromWalletName} → ${transfer.toWalletName}`,
            value: transfer.currency === result.currency ? money(transfer.amount) : `${transfer.amount} ${transfer.currency}`,
            note: detail.columns.includes('notes') ? transfer.notes : undefined,
          })),
          empty: 'Sin transferencias en el periodo',
        }],
        note: 'Las transferencias solo mueven dinero entre wallets: no son ingresos ni egresos y no cambian el balance.',
      })
    }
  }
  if (selected.has('reportStatus')) {
    const statusRows: ReportRow[] = result.reportStatus.flatMap((row) => [
      ...(row.incomeCount > 0 ? [{ label: `${row.label} · ingresos (${row.incomeCount})`, value: money(row.incomeTotal) }] : []),
      ...(row.expenseCount > 0 ? [{ label: `${row.label} · egresos (${row.expenseCount})`, value: minus(money, row.expenseTotal) }] : []),
    ])
    const pending = result.reportStatus.filter((row) => row.code !== 'reported')
      .reduce((sum, row) => sum + row.incomeCount + row.expenseCount, 0)
    blocks.push({
      id: 'reportStatus',
      title: sectionTitle('reportStatus'),
      headline: `${pending} ${pending === 1 ? 'registro' : 'registros'} sin reportar`,
      groups: [{ rows: statusRows, empty: 'Sin ingresos ni egresos en el periodo' }],
    })
  }
  if (selected.has('activity') && result.usageMode === 'professional') {
    blocks.push({
      id: 'activity',
      title: sectionTitle('activity'),
      headline: formatMinutes(result.activity.actualMinutes),
      groups: [{
        rows: [
          { label: 'Servicios e ingresos registrados', value: String(result.activity.serviceCount) },
          { label: 'Tiempo programado', value: formatMinutes(result.activity.scheduledMinutes) },
          { label: 'Tiempo efectivo', value: formatMinutes(result.activity.actualMinutes) },
        ],
      }],
    })
  }
  if (selected.has('adjustments')) {
    blocks.push({
      id: 'adjustments',
      title: sectionTitle('adjustments'),
      headline: `Impacto ${money(result.period.adjustmentImpact)}`,
      groups: [{
        rows: result.adjustments.map((item) => ({
          label: `${item.date} · ${item.label}`,
          value: money(item.value),
          secondary: [item.origin === 'income' ? 'Registrado como ingreso' : 'Registrado como egreso'],
        })),
        empty: 'Sin ajustes en el periodo',
      }],
    })
  }
  if (selected.has('movements')) {
    blocks.push(buildMovementsBlock(result, detail, money))
  }
  return blocks
}

/** Descripción breve de la configuración activa (cabecera del PDF y de la pantalla). */
export function describeOptions(result: GeneralBalanceResult, options: GeneralBalanceReportOptions): string[] {
  const { detail, sections } = normalizeReportOptions(options, result.usageMode)
  const parts: string[] = []
  const sectionLabels = sections.map((id) => sectionTitle(id))
  parts.push(sectionLabels.length > 0 ? `Secciones: Resumen, ${sectionLabels.join(', ')}` : 'Secciones: Resumen')
  if (sections.includes('movements')) {
    const group = DETAIL_GROUP_OPTIONS.find((choice) => choice.value === detail.groupBy)?.label ?? ''
    const filters: string[] = []
    if (detail.kinds.length < 3) filters.push(detail.kinds.map((kind) => KIND_LABEL[kind]).join(' y '))
    if (detail.categoryKeys) filters.push(`${detail.categoryKeys.length} categorías`)
    if (detail.walletIds) filters.push(`${detail.walletIds.length} wallets`)
    if (detail.seasonKeys) filters.push(`${detail.seasonKeys.length} temporadas`)
    parts.push(`Detalle: ${detail.groupBy === 'none' ? 'sin agrupar' : `agrupado por ${group.toLowerCase()}`}${filters.length ? ` · filtros: ${filters.join(', ')}` : ''}`)
  }
  return parts
}

const DISCLAIMER =
  'Balance calculado a partir de los registros de Private Balance para el modo activo. No es un saldo bancario certificado ni un Estado de Situación Financiera NIIF: la plataforma no registra activos, pasivos ni patrimonio.'

function header(result: GeneralBalanceResult, options: GeneralBalanceReportOptions) {
  return {
    title: 'Balance general',
    lines: [
      `Periodo: ${getPeriodLabel(result)}`,
      `Modo: ${result.usageMode === 'basic' ? 'Personal' : 'Profesional'} · Moneda: ${result.currency}`,
      ...describeOptions(result, options),
    ],
  }
}

export function buildGeneralBalanceText(
  result: GeneralBalanceResult,
  options: GeneralBalanceReportOptions,
  money: Money,
): string {
  const head = header(result, options)
  const lines: string[] = [`${head.title} — Private Balance`, ...head.lines, '']
  for (const block of buildGeneralBalanceBlocks(result, options, money)) {
    lines.push(block.title.toUpperCase())
    for (const group of block.groups) {
      if (group.subtitle) lines.push(`  ${group.subtitle}${group.summary ? ` (${group.summary})` : ''}`)
      if (group.rows.length === 0 && group.empty) lines.push(`    ${group.empty}`)
      for (const row of group.rows) {
        lines.push(`    ${row.label}: ${row.value}`)
        if (row.secondary?.length) lines.push(`      ${row.secondary.join(' · ')}`)
        if (row.note) lines.push(`      Nota: ${row.note}`)
      }
    }
    if (block.note) lines.push(`  ${block.note}`)
    lines.push('')
  }
  lines.push(DISCLAIMER)
  return lines.join('\n')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function buildGeneralBalanceHtml(
  result: GeneralBalanceResult,
  options: GeneralBalanceReportOptions,
  money: Money,
): string {
  const head = header(result, options)
  const body = buildGeneralBalanceBlocks(result, options, money).map((block) => {
    const groups = block.groups.map((group) => {
      const subtitle = group.subtitle
        ? `<h3>${escapeHtml(group.subtitle)}${group.summary ? ` <span class="muted">· ${escapeHtml(group.summary)}</span>` : ''}</h3>`
        : ''
      const rows = group.rows.length === 0 && group.empty
        ? `<p class="muted">${escapeHtml(group.empty)}</p>`
        : `<table>${group.rows.map((row) => {
            const extra = [
              row.secondary?.length ? `<div class="meta">${escapeHtml(row.secondary.join(' · '))}</div>` : '',
              row.note ? `<div class="note">Nota: ${escapeHtml(row.note)}</div>` : '',
            ].join('')
            return `<tr${row.strong ? ' class="strong"' : ''}><td>${escapeHtml(row.label)}${extra}</td><td class="num">${escapeHtml(row.value)}</td></tr>`
          }).join('')}</table>`
      return subtitle + rows
    }).join('')
    const note = block.note ? `<p class="muted">${escapeHtml(block.note)}</p>` : ''
    return `<section><h2>${escapeHtml(block.title)}</h2>${groups}${note}</section>`
  }).join('')

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" /><title>${escapeHtml(head.title)}</title>
<style>
body { color: #0f172a; font-family: Inter, Arial, sans-serif; font-size: 12px; line-height: 1.45; margin: 0; padding: 24px; }
h1 { font-size: 22px; margin: 0 0 6px; }
h2 { border-bottom: 1px solid #cbd5e1; font-size: 15px; margin: 22px 0 8px; padding-bottom: 4px; }
h3 { color: #0f766e; font-size: 12px; margin: 12px 0 4px; }
table { border-collapse: collapse; width: 100%; }
td { border-bottom: 1px solid #f1f5f9; padding: 4px 0; vertical-align: top; }
td.num { padding-left: 12px; text-align: right; white-space: nowrap; }
tr.strong td { font-weight: 700; }
.muted { color: #64748b; font-size: 11px; font-weight: 400; }
.meta { color: #64748b; font-size: 10.5px; }
.note { color: #334155; font-size: 10.5px; font-style: italic; }
</style></head>
<body><h1>${escapeHtml(head.title)}</h1>${head.lines.map((line) => `<p class="muted">${escapeHtml(line)}</p>`).join('')}
${body}
<p class="muted" style="margin-top:24px">${escapeHtml(DISCLAIMER)}</p></body></html>`
}
