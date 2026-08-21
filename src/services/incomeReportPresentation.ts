import { countries } from '../utils/countries'
import { formatCurrency } from '../utils/currency'
import { getStoredIncomeValue } from '../utils/financeStats'
import { getIncomeDisplayName } from '../utils/activityLabels'
import { getIncomeTypeLabel, isServiceIncome } from '../utils/incomeTypes'
import { getPaymentTypeLabel } from '../utils/paymentTypes'
import { canMarkAsReported, getRecordReportBadge } from '../utils/reportStatus'
import { getIncomeDurationDisplay } from '../utils/serviceDuration'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode, UsageMode } from '../types/settings'
import {
  formatIncomeDurationSubtotal,
  getIncomeDurationTotalMinutes,
} from './incomeReport.service'

export interface IncomeReportPresentationOptions {
  incomes: readonly ServiceIncome[]
  primaryCurrency: CurrencyCode
  usageMode: UsageMode
  adjustmentCounts?: ReadonlyMap<number, number>
  dateTotal?: number
  totalDurationMinutes?: number
  totalLabel?: string
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function formatDateTime(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function countryLabel(code?: string) {
  if (!code) return 'Sin país'
  return countries.find((country) => country.value === code)?.label ?? code
}

function originalAmount(income: ServiceIncome) {
  return formatCurrency(
    income.totalIncome ?? income.totalAmount,
    income.currency as CurrencyCode,
  )
}

function convertedAmount(income: ServiceIncome, currency: CurrencyCode) {
  return formatCurrency(getStoredIncomeValue(income, currency), currency)
}

function recordMetadata(
  income: ServiceIncome,
  usageMode: UsageMode,
  adjustmentCounts: ReadonlyMap<number, number>,
) {
  const isBasic = usageMode === 'basic'
  const isReportable = canMarkAsReported(income, usageMode)
  const badge = getRecordReportBadge(income)
  const adjustmentCount = income.id
    ? adjustmentCounts.get(income.id) ?? 0
    : 0

  return {
    adjustmentCount,
    badge,
    isReportable,
    items: [
      formatDateTime(income.createdAt)
        ? `Creado: ${formatDateTime(income.createdAt)}`
        : '',
      !isBasic ? `Estado: ${isReportable ? badge.label : 'No aplica'}` : '',
      !isBasic && isReportable && badge.isReported
        ? `Reportado: ${formatDateTime(badge.reportedAt)}`
        : '',
      !isBasic && isReportable && badge.reportReference
        ? `Referencia: ${badge.reportReference}`
        : '',
      !isBasic && isReportable && badge.reportNotes
        ? `Notas: ${badge.reportNotes}`
        : '',
      adjustmentCount > 0
        ? `Afectado por ajuste (${adjustmentCount})`
        : 'Sin ajustes',
    ].filter(Boolean),
  }
}

export function buildIncomeDateTableHtml(
  options: IncomeReportPresentationOptions,
) {
  const {
    incomes,
    primaryCurrency,
    usageMode,
    adjustmentCounts = new Map(),
  } = options
  const isBasic = usageMode === 'basic'
  const dateTotal = options.dateTotal ?? incomes.reduce(
    (total, income) => total + getStoredIncomeValue(income, primaryCurrency),
    0,
  )
  const duration = options.totalDurationMinutes ??
    getIncomeDurationTotalMinutes(incomes)
  const rows = incomes.map((income) => {
    const metadata = recordMetadata(income, usageMode, adjustmentCounts)

    return `
      <tr data-income-id="${escapeHtml(String(income.id ?? ''))}">
        <td class="income-name">
          ${escapeHtml(getIncomeDisplayName(income))}
          <span class="record-meta">${escapeHtml(metadata.items.join(' · '))}</span>
        </td>
        <td>${escapeHtml(getIncomeTypeLabel(income))}</td>
        <td>${escapeHtml(getPaymentTypeLabel(income.paymentType))}</td>
        <td>${escapeHtml(countryLabel(income.country))}</td>
        <td>${escapeHtml(income.city || 'Sin ciudad')}</td>
        ${!isBasic ? `<td>${isServiceIncome(income) ? escapeHtml(getIncomeDurationDisplay(income)) : 'No aplica'}</td>` : ''}
        <td class="amount">${escapeHtml(originalAmount(income))}</td>
        <td class="amount">${escapeHtml(convertedAmount(income, primaryCurrency))}</td>
      </tr>
    `
  }).join('')

  return `
    <div class="income-table-scroll">
    <table class="income-date-table">
      <thead><tr>
        <th class="income-name">Servicio / ingreso</th>
        <th>Tipo</th>
        <th>Tipo de pago</th>
        <th>País</th>
        <th>Ciudad</th>
        ${!isBasic ? '<th>Duración</th>' : ''}
        <th class="amount">Importe original</th>
        <th class="amount">Importe convertido</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td colspan="${isBasic ? 6 : 7}">Subtotal fecha${!isBasic ? ` · ${formatIncomeDurationSubtotal(duration)}` : ''}</td>
        <td class="amount">${escapeHtml(formatCurrency(dateTotal, primaryCurrency))}</td>
      </tr></tfoot>
    </table>
    </div>
  `
}

export function buildIncomeDateText(options: IncomeReportPresentationOptions) {
  const {
    incomes,
    primaryCurrency,
    usageMode,
    adjustmentCounts = new Map(),
    totalLabel = 'Total valor',
  } = options
  const isBasic = usageMode === 'basic'
  const duration = options.totalDurationMinutes ??
    getIncomeDurationTotalMinutes(incomes)
  const total = options.dateTotal ?? incomes.reduce(
    (sum, income) => sum + getStoredIncomeValue(income, primaryCurrency),
    0,
  )
  const rows = incomes.map((income) => {
    const metadata = recordMetadata(income, usageMode, adjustmentCounts)

    return [
      `- ${getIncomeDisplayName(income)}`,
      `Clase: ${getIncomeTypeLabel(income)}`,
      `Tipo: ${getPaymentTypeLabel(income.paymentType)}`,
      `País: ${countryLabel(income.country)}`,
      `Ciudad: ${income.city || 'Sin ciudad'}`,
      !isBasic
        ? `Duración: ${isServiceIncome(income) ? getIncomeDurationDisplay(income) : 'No aplica'}`
        : '',
      `Fecha de ingreso: ${income.date}`,
      formatDateTime(income.createdAt)
        ? `Fecha de creación: ${formatDateTime(income.createdAt)}`
        : '',
      ...metadata.items.filter((item) => !item.startsWith('Creado:')),
      `Importe original: ${originalAmount(income)}`,
      `Importe convertido: ${convertedAmount(income, primaryCurrency)}`,
    ].filter(Boolean).join(' | ')
  }).join('\n')

  return [
    rows,
    !isBasic
      ? `Total duración: ${formatIncomeDurationSubtotal(duration)}`
      : '',
    `${totalLabel}: ${formatCurrency(total, primaryCurrency)}`,
  ].filter(Boolean).join('\n')
}
