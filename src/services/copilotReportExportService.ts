import type { CurrencyCode } from '../types/settings'
import { calculateFinancialTotals } from '../utils/financeStats'
import { listExpenses } from './expenseService'
import { listServiceIncomes } from './incomeService'
import { shareReportPdf } from './reportShareService'
import { getSettings } from './settingsService'

function formatMoney(value: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(value)
}

export async function exportCopilotPeriodReport(input: {
  readonly periodStart: string
  readonly periodEnd: string
}): Promise<string> {
  const [settings, incomes, expenses] = await Promise.all([
    getSettings(),
    listServiceIncomes({ from: input.periodStart, to: input.periodEnd }),
    listExpenses({ from: input.periodStart, to: input.periodEnd }),
  ])
  const totals = calculateFinancialTotals(incomes, expenses, settings.defaultCurrency, settings.secondaryCurrency)
  const title = 'Reporte financiero'
  const text = [
    title,
    `Periodo: ${input.periodStart} a ${input.periodEnd}`,
    `Ingresos: ${formatMoney(totals.primaryIncome, settings.defaultCurrency)} (${incomes.length})`,
    `Gastos: ${formatMoney(totals.primaryExpenses, settings.defaultCurrency)} (${expenses.length})`,
    `Balance: ${formatMoney(totals.primaryIncome - totals.primaryExpenses, settings.defaultCurrency)}`,
  ].join('\n')
  const html = `<main><h1>${title}</h1><p>${text.split('\n').slice(1).join('</p><p>')}</p></main>`
  const fileName = `private-balance-${input.periodStart}-${input.periodEnd}`
  await shareReportPdf({ fileName, html, text, title })
  return `${fileName}.pdf`
}
