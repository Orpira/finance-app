import type { BalanceReportResult } from './balanceReportService'
import { runFinancialEngine } from './financialEngineAdapter'
import type { Expense } from '../types/expense'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import { roundMoney } from '../utils/currency'

/**
 * Balance Financiero a fecha de corte (vista de solo lectura).
 *
 * No introduce fórmulas nuevas: delega en `runFinancialEngine`, que a su vez
 * usa `buildBalanceReport`. Solo añade el filtro acumulado por fecha civil
 * (todos los movimientos con fecha <= corte) y expone P y A, derivados de los
 * totales que el motor ya calcula:
 *
 *   P (ingresos principales) = netProfit + expenseTotal   (netProfit = P - E)
 *   A (ingresos adicionales) = incomeGrossTotal - P       (incomeGrossTotal = P + A)
 *   Balance neto             = generalBalance             ((P + A) - E + ajustes)
 *
 * Las transferencias internas entre Wallets viven en otra tabla y no se pasan
 * al motor, por lo que nunca cuentan como ingreso ni egreso.
 * No es un Estado de Situación Financiera NIIF ni un saldo bancario.
 */
export interface FinancialBalanceInput {
  readonly incomes: readonly ServiceIncome[]
  readonly expenses: readonly Expense[]
  readonly currency: CurrencyCode
  readonly usageMode: 'basic' | 'professional'
  /** Fecha civil de corte, formato YYYY-MM-DD (inclusive). */
  readonly cutoff: string
}

export interface FinancialBalanceResult {
  readonly cutoff: string
  readonly currency: CurrencyCode
  readonly usageMode: 'basic' | 'professional'
  readonly principalIncomeTotal: number
  readonly additionalIncomeTotal: number
  readonly report: BalanceReportResult
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
}

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function isValidCutoff(value: string): boolean {
  if (!CIVIL_DATE_PATTERN.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function isOnOrBeforeCutoff(date: string | undefined, cutoff: string): boolean {
  if (!date) return false
  return date.slice(0, 10) <= cutoff
}

export function buildFinancialBalanceAsOf(input: FinancialBalanceInput): FinancialBalanceResult {
  if (!isValidCutoff(input.cutoff)) {
    // Fail-closed: no se inventa un balance con una fecha inválida.
    throw new Error('INVALID_FINANCIAL_BALANCE_CUTOFF')
  }

  const incomes = input.incomes.filter((income) => isOnOrBeforeCutoff(income.date, input.cutoff))
  const expenses = input.expenses.filter((expense) => isOnOrBeforeCutoff(expense.date, input.cutoff))

  const engine = runFinancialEngine({
    incomes,
    expenses,
    currency: input.currency,
    usageMode: input.usageMode,
  })

  const report = engine.balanceReport
  const principalIncomeTotal = roundMoney(report.netProfit + report.expenseTotal)
  const additionalIncomeTotal = roundMoney(report.incomeGrossTotal - principalIncomeTotal)

  return {
    cutoff: input.cutoff,
    currency: input.currency,
    usageMode: input.usageMode,
    principalIncomeTotal,
    additionalIncomeTotal,
    report,
    incomeCount: engine.incomeCount,
    expenseCount: engine.expenseCount,
    adjustmentCount: engine.adjustmentCount,
  }
}

/** Resumen en texto plano; usa exactamente las mismas cifras que la pantalla. */
export function buildFinancialBalanceText(
  result: FinancialBalanceResult,
  formatMoney: (value: number) => string,
): string {
  const { report } = result
  const modeLabel = result.usageMode === 'basic' ? 'Básico' : 'Profesional'
  return [
    'Balance financiero — Private Balance',
    `Fecha de corte: ${result.cutoff}`,
    `Modo: ${modeLabel}`,
    '',
    `Balance neto acumulado: ${formatMoney(report.generalBalance)}`,
    `Total recibido: ${formatMoney(report.incomeGrossTotal)}`,
    `  Ingresos principales: ${formatMoney(result.principalIncomeTotal)}`,
    `  Ingresos adicionales: ${formatMoney(result.additionalIncomeTotal)}`,
    `Egresos: ${formatMoney(report.expenseTotal)}`,
    `Impacto neto de ajustes: ${formatMoney(report.adjustmentImpactTotal)}`,
    '',
    'Balance estimado a partir de los registros. No es un saldo bancario certificado ni un estado financiero NIIF.',
  ].join('\n')
}
