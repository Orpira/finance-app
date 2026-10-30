import type {
  BalanceTotals,
  GeneralBalanceResult,
  GeneralBalanceSectionId,
  GroupedAmount,
} from './generalBalanceService'
import { GENERAL_BALANCE_SECTIONS } from './generalBalanceService'

/** Máximo de movimientos individuales incluidos en el PDF (rendimiento en móvil). */
export const GENERAL_BALANCE_EXPORT_MOVEMENT_LIMIT = 500

type Money = (value: number) => string

/** Importe que resta: "-X", pero nunca "-0". */
function minus(money: Money, value: number) {
  return value === 0 ? money(0) : `-${money(value)}`
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function getPeriodLabel(result: Pick<GeneralBalanceResult, 'from' | 'to'>) {
  return result.from ? `${result.from} a ${result.to}` : `Todo el historial hasta ${result.to}`
}

function sectionTitle(id: GeneralBalanceSectionId) {
  return GENERAL_BALANCE_SECTIONS.find((section) => section.id === id)?.label ?? id
}

interface Row { label: string; value: string; strong?: boolean }

function summaryRows(result: GeneralBalanceResult, money: Money): Row[] {
  return [
    { label: result.from ? 'Saldo inicial' : 'Saldo inicial (sin movimientos previos)', value: money(result.opening.balance) },
    { label: 'Total recibido en el periodo', value: money(result.period.totalReceived) },
    { label: 'Egresos del periodo', value: minus(money, result.period.expenses) },
    { label: 'Impacto neto de ajustes', value: money(result.period.adjustmentImpact) },
    { label: 'Variación del periodo', value: money(result.period.balance) },
    { label: 'Saldo final', value: money(result.closing.balance), strong: true },
  ]
}

function componentRows(totals: BalanceTotals, money: Money): Row[] {
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

function groupRows(rows: readonly GroupedAmount[], money: Money): Row[] {
  return rows.map((row) => ({ label: `${row.label} (${row.count})`, value: money(row.total) }))
}

interface Block { title: string; groups: { subtitle?: string; rows: Row[]; empty?: string }[]; note?: string }

export function buildGeneralBalanceBlocks(
  result: GeneralBalanceResult,
  sections: readonly GeneralBalanceSectionId[],
  money: Money,
): Block[] {
  const selected = new Set(sections)
  const blocks: Block[] = [{ title: 'Resumen', groups: [{ rows: summaryRows(result, money) }] }]

  if (selected.has('components')) {
    blocks.push({ title: sectionTitle('components'), groups: [{ rows: componentRows(result.period, money) }] })
  }
  if (selected.has('incomeBreakdown')) {
    blocks.push({
      title: sectionTitle('incomeBreakdown'),
      groups: [
        { subtitle: 'Por tipo', rows: groupRows(result.incomesByType, money), empty: 'Sin ingresos' },
        { subtitle: 'Por tipo de pago', rows: groupRows(result.incomesByPaymentType, money), empty: 'Sin ingresos' },
        ...(result.usageMode === 'basic'
          ? [{ subtitle: 'Por categoría', rows: groupRows(result.incomesByCategory, money), empty: 'Sin ingresos' }]
          : []),
        { subtitle: 'Por ubicación', rows: groupRows(result.incomesByLocation, money), empty: 'Sin ingresos' },
      ],
    })
  }
  if (selected.has('expenseBreakdown')) {
    blocks.push({
      title: sectionTitle('expenseBreakdown'),
      groups: [
        { subtitle: 'Por categoría', rows: groupRows(result.expensesByCategory, money), empty: 'Sin egresos' },
        { subtitle: 'Por ubicación', rows: groupRows(result.expensesByLocation, money), empty: 'Sin egresos' },
      ],
    })
  }
  if (selected.has('seasons') && result.usageMode === 'professional') {
    blocks.push({
      title: sectionTitle('seasons'),
      groups: result.seasons.length === 0
        ? [{ rows: [], empty: 'Sin movimientos por temporada en el periodo' }]
        : result.seasons.map((season) => ({
            subtitle: `${season.name}${season.status === 'active' ? ' · Activa' : season.status === 'closed' ? ' · Cerrada' : ''}`,
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
    blocks.push({
      title: sectionTitle('wallets'),
      groups: !result.wallets || result.wallets.wallets.length === 0
        ? [{ rows: [], empty: 'Sin wallets con saldo o actividad' }]
        : [
            ...result.wallets.wallets.map((wallet) => ({
              subtitle: `${wallet.walletName}${wallet.isArchived ? ' · Archivada' : ''}`,
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
                { label: 'Transferencias en el periodo', value: `${result.wallets.transferCount} · ${money(result.wallets.totalMoved)}` },
              ],
            },
          ],
      note: reconciliation?.hasCurrencyMismatchTransfers
        ? 'Hay transferencias en otra moneda que no se incluyen en los saldos por wallet.'
        : 'Las transferencias internas no son ingresos ni egresos: solo mueven dinero entre wallets.',
    })
  }
  if (selected.has('reportStatus')) {
    blocks.push({
      title: sectionTitle('reportStatus'),
      groups: [{
        rows: result.reportStatus.map((row) => ({
          label: row.label,
          value: `Ingresos ${money(row.incomeTotal)} (${row.incomeCount}) · Egresos ${money(row.expenseTotal)} (${row.expenseCount})`,
        })),
      }],
    })
  }
  if (selected.has('activity') && result.usageMode === 'professional') {
    blocks.push({
      title: sectionTitle('activity'),
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
      title: sectionTitle('adjustments'),
      groups: [{
        rows: result.adjustments.map((item) => ({
          label: `${item.date} · ${item.label} · ${item.origin === 'income' ? 'Ingreso' : 'Egreso'}`,
          value: money(item.value),
        })),
        empty: 'Sin ajustes en el periodo',
      }],
    })
  }
  if (selected.has('movements')) {
    const shown = result.movements.slice(0, GENERAL_BALANCE_EXPORT_MOVEMENT_LIMIT)
    blocks.push({
      title: sectionTitle('movements'),
      groups: [{
        rows: shown.map((movement) => ({
          label: `${movement.date} · ${movement.label} · ${movement.detail}`,
          value: money(movement.amount),
        })),
        empty: 'Sin movimientos en el periodo',
      }],
      note: result.movements.length > shown.length
        ? `Se muestran ${shown.length} de ${result.movements.length} movimientos. Consulta el resto en Movimientos.`
        : undefined,
    })
  }
  return blocks
}

const DISCLAIMER =
  'Balance calculado a partir de los registros de Private Balance para el modo activo. No es un saldo bancario certificado ni un Estado de Situación Financiera NIIF: la plataforma no registra activos, pasivos ni patrimonio.'

function header(result: GeneralBalanceResult) {
  return {
    title: 'Balance general',
    lines: [
      `Periodo: ${getPeriodLabel(result)}`,
      `Modo: ${result.usageMode === 'basic' ? 'Básico' : 'Profesional'} · Moneda: ${result.currency}`,
    ],
  }
}

export function buildGeneralBalanceText(
  result: GeneralBalanceResult,
  sections: readonly GeneralBalanceSectionId[],
  money: Money,
): string {
  const head = header(result)
  const lines: string[] = [`${head.title} — Private Balance`, ...head.lines, '']
  for (const block of buildGeneralBalanceBlocks(result, sections, money)) {
    lines.push(block.title.toUpperCase())
    for (const group of block.groups) {
      if (group.subtitle) lines.push(`  ${group.subtitle}`)
      if (group.rows.length === 0 && group.empty) lines.push(`    ${group.empty}`)
      for (const row of group.rows) lines.push(`    ${row.label}: ${row.value}`)
    }
    if (block.note) lines.push(`  ${block.note}`)
    lines.push('')
  }
  lines.push(DISCLAIMER)
  return lines.join('\n')
}

export function buildGeneralBalanceHtml(
  result: GeneralBalanceResult,
  sections: readonly GeneralBalanceSectionId[],
  money: Money,
): string {
  const head = header(result)
  const body = buildGeneralBalanceBlocks(result, sections, money).map((block) => {
    const groups = block.groups.map((group) => {
      const subtitle = group.subtitle ? `<h3>${escapeHtml(group.subtitle)}</h3>` : ''
      const rows = group.rows.length === 0 && group.empty
        ? `<p class="muted">${escapeHtml(group.empty)}</p>`
        : `<table>${group.rows.map((row) =>
            `<tr${row.strong ? ' class="strong"' : ''}><td>${escapeHtml(row.label)}</td><td class="num">${escapeHtml(row.value)}</td></tr>`,
          ).join('')}</table>`
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
td { border-bottom: 1px solid #f1f5f9; padding: 4px 0; }
td.num { text-align: right; white-space: nowrap; }
tr.strong td { font-weight: 700; }
.muted { color: #64748b; font-size: 11px; }
</style></head>
<body><h1>${escapeHtml(head.title)}</h1>${head.lines.map((line) => `<p class="muted">${escapeHtml(line)}</p>`).join('')}
${body}
<p class="muted" style="margin-top:24px">${escapeHtml(DISCLAIMER)}</p></body></html>`
}
