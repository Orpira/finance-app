import type { CurrencyCode } from '../types/settings'
import { listExpenses } from './expenseService'
import { listServiceIncomes } from './incomeService'
import { getSettings } from './settingsService'
import { buildFinancialCopilotSnapshot } from './financialCopilotService'

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
  const readModel = buildFinancialCopilotSnapshot({
    asOfDate: input.periodEnd,
    settings,
    currentIncomes: incomes,
    previousIncomes: [],
    currentExpenses: expenses,
    previousExpenses: [],
    pendingIncome: { count: 0, overdueCount: 0 },
    appointments: [],
  })
  const title = 'Reporte financiero'
  const text = [
    title,
    `Periodo: ${input.periodStart} a ${input.periodEnd}`,
    `Ingresos: ${formatMoney(readModel.currentMonth.income, settings.defaultCurrency)} (${readModel.currentMonth.incomeCount})`,
    `Gastos: ${formatMoney(readModel.currentMonth.expenses, settings.defaultCurrency)} (${readModel.currentMonth.expenseCount})`,
    `Balance: ${formatMoney(readModel.currentMonth.income - readModel.currentMonth.expenses, settings.defaultCurrency)}`,
  ].join('\n')
  const html = `<main><h1>${title}</h1><p>${text.split('\n').slice(1).join('</p><p>')}</p></main>`
  const fileName = `private-balance-${input.periodStart}-${input.periodEnd}`
  const { shareReportPdf } = await import('./reportShareService')
  await shareReportPdf({ fileName, html, text, title })
  return `${fileName}.pdf`
}
