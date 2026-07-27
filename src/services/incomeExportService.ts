import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

import { getIncomeDisplayName } from '../utils/activityLabels'
import { getStoredIncomeValue } from '../utils/financeStats'
import { getIncomeTypeLabel } from '../utils/incomeTypes'
import { getPaymentTypeLabel } from '../utils/paymentTypes'
import { canMarkAsReported, getRecordReportBadge } from '../utils/reportStatus'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode, UsageMode } from '../types/settings'

export interface IncomeExportRow {
  id: number | string
  description: string
  type: string
  serviceDate: string
  createdAt: string
  status: string
  reportedAt: string
  reportReference: string
  reportNotes: string
  paymentType: string
  country: string
  city: string
  amount: number
  currency: CurrencyCode
}

const EXPORT_COLUMNS: Array<{ key: keyof IncomeExportRow; header: string }> = [
  { key: 'id', header: 'ID' },
  { key: 'description', header: 'Ingreso' },
  { key: 'type', header: 'Tipo' },
  { key: 'serviceDate', header: 'Fecha de ingreso' },
  { key: 'createdAt', header: 'Fecha de creación' },
  { key: 'status', header: 'Estado' },
  { key: 'reportedAt', header: 'Fecha de reporte' },
  { key: 'reportReference', header: 'Referencia' },
  { key: 'reportNotes', header: 'Notas' },
  { key: 'paymentType', header: 'Tipo de pago' },
  { key: 'country', header: 'País' },
  { key: 'city', header: 'Ciudad' },
  { key: 'amount', header: 'Monto' },
  { key: 'currency', header: 'Moneda' },
]

function formatDateTime(value?: string) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export function buildIncomeExportRows(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
  usageMode: UsageMode,
): IncomeExportRow[] {
  return incomes.map((income) => {
    const badge = getRecordReportBadge(income)
    const isReportable = canMarkAsReported(income, usageMode)

    return {
      id: income.id ?? '',
      description: getIncomeDisplayName(income),
      type: getIncomeTypeLabel(income),
      serviceDate: income.date,
      createdAt: formatDateTime(income.createdAt),
      status: isReportable ? badge.label : 'No aplica',
      reportedAt: isReportable && badge.isReported ? formatDateTime(badge.reportedAt) : '',
      reportReference: isReportable ? badge.reportReference ?? '' : '',
      reportNotes: isReportable ? badge.reportNotes ?? '' : '',
      paymentType: getPaymentTypeLabel(income.paymentType),
      country: income.country ?? '',
      city: income.city ?? '',
      amount: getStoredIncomeValue(income, currency),
      currency,
    }
  })
}

function escapeCsvValue(value: unknown) {
  const stringValue = String(value ?? '')

  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`
  }

  return stringValue
}

export function buildIncomeCsv(rows: IncomeExportRow[]) {
  const header = EXPORT_COLUMNS.map((column) => escapeCsvValue(column.header)).join(',')
  const lines = rows.map((row) =>
    EXPORT_COLUMNS.map((column) => escapeCsvValue(row[column.key])).join(','),
  )

  // El BOM UTF-8 evita que Excel rompa los acentos al abrir el CSV directamente.
  return ['﻿' + header, ...lines].join('\r\n')
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function xmlCell(value: unknown, type: 'String' | 'Number' = 'String') {
  return `<Cell><Data ss:Type="${type}">${xmlEscape(value)}</Data></Cell>`
}

/**
 * Genera un libro Excel real en formato SpreadsheetML (XML plano), sin depender de
 * librerías como 'xlsx'/'exceljs' (ambas con vulnerabilidades altas conocidas en npm).
 * Excel, LibreOffice y Google Sheets lo abren de forma nativa.
 */
export function buildIncomeSpreadsheetXml(rows: IncomeExportRow[]) {
  const headerRow = `<Row>${EXPORT_COLUMNS.map((column) => xmlCell(column.header)).join('')}</Row>`
  const dataRows = rows
    .map(
      (row) =>
        `<Row>${EXPORT_COLUMNS.map((column) =>
          xmlCell(row[column.key], column.key === 'amount' ? 'Number' : 'String'),
        ).join('')}</Row>`,
    )
    .join('')

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet" xmlns:html="http://www.w3.org/TR/REC-html40">
  <Worksheet ss:Name="Ingresos">
    <Table>
      ${headerRow}
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function downloadTextFileWeb(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = fileName
  link.rel = 'noopener'
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()
  link.remove()

  window.setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}

async function shareTextFile(
  content: string,
  fileName: string,
  mimeType: string,
  dialogTitle: string,
) {
  if (Capacitor.isNativePlatform()) {
    const savedFile = await Filesystem.writeFile({
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
      path: fileName,
    })

    await Share.share({
      dialogTitle,
      files: [savedFile.uri],
      title: dialogTitle,
    })
    return
  }

  downloadTextFileWeb(content, fileName, mimeType)
}

export async function shareIncomesAsCsv(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
  usageMode: UsageMode,
  fileName: string,
) {
  const rows = buildIncomeExportRows(incomes, currency, usageMode)
  const csv = buildIncomeCsv(rows)

  await shareTextFile(
    csv,
    `${sanitizeFileName(fileName) || 'ingresos'}.csv`,
    'text/csv;charset=utf-8',
    'Exportar CSV de ingresos',
  )
}

export async function shareIncomesAsExcel(
  incomes: ServiceIncome[],
  currency: CurrencyCode,
  usageMode: UsageMode,
  fileName: string,
) {
  const rows = buildIncomeExportRows(incomes, currency, usageMode)
  const xml = buildIncomeSpreadsheetXml(rows)

  await shareTextFile(
    xml,
    `${sanitizeFileName(fileName) || 'ingresos'}.xls`,
    'application/vnd.ms-excel',
    'Exportar Excel de ingresos',
  )
}
