import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'

import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import { formatCurrency } from '../utils/currency'
import { downloadBlob, downloadText } from '../utils/download'
import {
  calculateBestIncomeDay,
  calculateFinancialTotals,
  getStoredExpenseValue,
  getStoredIncomeValue,
} from '../utils/financeStats'

interface ReportExportInput {
  expenses: Expense[]
  incomes: ServiceIncome[]
  label: string
  primaryCurrency: CurrencyCode
  range: {
    from: string
    to: string
  }
  secondaryCurrency: CurrencyCode
}

function buildSummary(input: ReportExportInput) {
  const totals = calculateFinancialTotals(
    input.incomes,
    input.expenses,
    input.primaryCurrency,
    input.secondaryCurrency,
  )
  const bestDay = calculateBestIncomeDay(input.incomes, input.primaryCurrency)

  return { bestDay, totals }
}

function escapeCsvValue(value: string | number) {
  const text = String(value)

  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

export function exportReportPdf(input: ReportExportInput) {
  const { bestDay, totals } = buildSummary(input)
  const document = new jsPDF()
  const lines = [
    `Reporte ${input.label}`,
    `${input.range.from} - ${input.range.to}`,
    '',
    `Ingresos: ${formatCurrency(totals.primaryIncome, input.primaryCurrency)}`,
    `Ganancia real: ${formatCurrency(totals.primaryIncome, input.primaryCurrency)}`,
    `Gastos: ${formatCurrency(totals.primaryExpenses, input.primaryCurrency)}`,
    `Ganancia neta: ${formatCurrency(totals.primaryNet, input.primaryCurrency)}`,
    `Mejor día: ${bestDay.count > 0 ? bestDay.weekday : '-'}`,
    `Promedio mejor día: ${formatCurrency(bestDay.average, input.primaryCurrency)}`,
    `Servicios: ${totals.serviceCount}`,
    `Minutos: ${totals.serviceMinutes}`,
    '',
    'Detalle de gastos',
    ...input.expenses.map(
      (expense) =>
        `${expense.date} - ${expense.category} - ${formatCurrency(
          getStoredExpenseValue(expense, input.primaryCurrency),
          input.primaryCurrency,
        )}`,
    ),
  ]

  lines.forEach((line, index) => {
    document.text(line, 12, 16 + index * 8)
  })

  document.save(`reporte-${input.label.toLowerCase()}.pdf`)
}

export async function exportReportXlsx(input: ReportExportInput) {
  const { bestDay, totals } = buildSummary(input)
  const workbook = new ExcelJS.Workbook()
  const summarySheet = workbook.addWorksheet('Resumen')
  const incomesSheet = workbook.addWorksheet('Ingresos')
  const expensesSheet = workbook.addWorksheet('Gastos')

  summarySheet.addRows([
    ['Reporte', input.label],
    ['Desde', input.range.from],
    ['Hasta', input.range.to],
    ['Ingresos', totals.primaryIncome],
    ['Ganancia real', totals.primaryIncome],
    ['Gastos', totals.primaryExpenses],
    ['Ganancia neta', totals.primaryNet],
    ['Mejor día', bestDay.count > 0 ? bestDay.weekday : '-'],
    ['Promedio mejor día', bestDay.average],
    ['Servicios', totals.serviceCount],
    ['Minutos', totals.serviceMinutes],
  ])

  incomesSheet.columns = [
    { header: 'Fecha', key: 'date' },
    { header: 'Duración', key: 'duration' },
    { header: 'Valor', key: 'value' },
    { header: 'Moneda', key: 'currency' },
  ]
  input.incomes.forEach((income) => {
    incomesSheet.addRow({
      currency: input.primaryCurrency,
      date: income.date,
      duration: income.duration,
      value: getStoredIncomeValue(income, input.primaryCurrency),
    })
  })

  expensesSheet.columns = [
    { header: 'Fecha', key: 'date' },
    { header: 'Categoría', key: 'category' },
    { header: 'Valor', key: 'value' },
    { header: 'Moneda', key: 'currency' },
  ]
  input.expenses.forEach((expense) => {
    expensesSheet.addRow({
      category: expense.category,
      currency: input.primaryCurrency,
      date: expense.date,
      value: getStoredExpenseValue(expense, input.primaryCurrency),
    })
  })

  const buffer = await workbook.xlsx.writeBuffer()

  await downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `reporte-${input.label.toLowerCase()}.xlsx`,
  )
}

export async function exportReportCsv(input: ReportExportInput) {
  const { bestDay, totals } = buildSummary(input)
  const rows = [
    ['Tipo', 'Concepto', 'Valor', 'Moneda'],
    ['Resumen', 'Ingresos', totals.primaryIncome, input.primaryCurrency],
    ['Resumen', 'Ganancia real', totals.primaryIncome, input.primaryCurrency],
    ['Resumen', 'Gastos', totals.primaryExpenses, input.primaryCurrency],
    ['Resumen', 'Ganancia neta', totals.primaryNet, input.primaryCurrency],
    ['Resumen', 'Mejor día', bestDay.count > 0 ? bestDay.weekday : '-', ''],
    ['Resumen', 'Servicios', totals.serviceCount, ''],
    ...input.incomes.map((income) => [
      'Ingreso',
      income.date,
      getStoredIncomeValue(income, input.primaryCurrency),
      input.primaryCurrency,
    ]),
    ...input.expenses.map((expense) => [
      'Gasto',
      `${expense.date} ${expense.category}`,
      getStoredExpenseValue(expense, input.primaryCurrency),
      input.primaryCurrency,
    ]),
  ]
  const content = rows
    .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
    .join('\n')

  await downloadText(
    content,
    `reporte-${input.label.toLowerCase()}.csv`,
    'text/csv;charset=utf-8',
  )
}
