import type { BalanceAdjustmentRecord, BalanceReportResult } from './balanceReportService'
import { getSeasonGoalProgress } from './earningPeriodService'
import { runFinancialEngine } from './financialEngineAdapter'
import { isValidCutoff } from './financialBalanceService'
import { buildWalletReportModel, type WalletReportModel } from './walletReportService'
import { getReportStatusLabel, normalizeReportStatus } from '../catalogs/reportStatuses'
import type { ReportStatusCode } from '../catalogs/reportStatuses'
import type { EarningPeriod } from '../types/earningPeriod'
import type { Expense } from '../types/expense'
import type { InternalTransfer } from '../types/internalTransfer'
import type { PersonalExpenseCategory } from '../types/personalExpenseCategory'
import type { PersonalIncomeCategory } from '../types/personalIncomeCategory'
import type { ServiceIncome } from '../types/service'
import type { CurrencyCode } from '../types/settings'
import type { Wallet } from '../types/wallet'
import { getExpenseDisplayName, getIncomeDisplayName } from '../utils/activityLabels'
import { countries } from '../utils/countries'
import { roundMoney } from '../utils/currency'
import {
  calculateSeasonFinancialResult,
  getStoredExpenseValue,
  getStoredIncomeValue,
  recordBelongsToEarningPeriod,
} from '../utils/financeStats'
import { getIncomeType, getIncomeTypeLabel, isAdjustmentIncome } from '../utils/incomeTypes'
import { getPaymentTypeLabel } from '../utils/paymentTypes'
import { recordBelongsToUsageMode } from '../utils/usageMode'

/**
 * Balance General (solo lectura).
 *
 * Estado de saldos de Private Balance para el modo activo:
 *   saldo inicial (acumulado antes de `from`)
 *   + movimientos del periodo [from, to]
 *   = saldo final (acumulado hasta `to`)
 *
 * Todas las cifras salen de `runFinancialEngine`/`buildBalanceReport`, sin
 * fórmulas nuevas: Balance = (P + A) - E + ajustes. Los desgloses solo
 * reparten esas mismas cifras por dimensiones que la plataforma registra
 * (tipo, tipo de pago, categoría, ubicación, temporada, wallet, estado de
 * reporte). Las transferencias internas nunca son ingreso ni egreso.
 *
 * No es un Estado de Situación Financiera NIIF: la plataforma no registra
 * activos, pasivos ni patrimonio, y no se inventan.
 */

export type GeneralBalanceSectionId =
  | 'components'
  | 'incomeBreakdown'
  | 'expenseBreakdown'
  | 'seasons'
  | 'wallets'
  | 'reportStatus'
  | 'activity'
  | 'adjustments'
  | 'movements'

export interface GeneralBalanceSectionOption {
  readonly id: GeneralBalanceSectionId
  readonly label: string
  readonly description: string
  readonly level: 2 | 3 | 4
  readonly modes: readonly ('basic' | 'professional')[]
}

export const GENERAL_BALANCE_SECTIONS: readonly GeneralBalanceSectionOption[] = [
  { id: 'components', label: 'Componentes', description: 'Ingresos principales, adicionales, egresos y ajustes.', level: 2, modes: ['basic', 'professional'] },
  { id: 'incomeBreakdown', label: 'Desglose de ingresos', description: 'Por tipo, tipo de pago, categoría y ubicación.', level: 3, modes: ['basic', 'professional'] },
  { id: 'expenseBreakdown', label: 'Desglose de egresos', description: 'Por categoría y ubicación.', level: 3, modes: ['basic', 'professional'] },
  { id: 'seasons', label: 'Temporadas', description: 'Balance por temporada y avance de la meta.', level: 3, modes: ['professional'] },
  { id: 'wallets', label: 'Wallets y transferencias', description: 'Saldo inicial y final por wallet, con transferencias internas.', level: 3, modes: ['basic'] },
  { id: 'reportStatus', label: 'Estado de reporte', description: 'Importes reportados, pendientes y sin revisar.', level: 3, modes: ['basic', 'professional'] },
  { id: 'activity', label: 'Actividad', description: 'Servicios registrados y tiempo trabajado.', level: 3, modes: ['professional'] },
  { id: 'adjustments', label: 'Detalle de ajustes', description: 'Cada ajuste aplicado en el periodo.', level: 4, modes: ['basic', 'professional'] },
  { id: 'movements', label: 'Movimientos', description: 'Ingresos y egresos individuales del periodo.', level: 4, modes: ['basic', 'professional'] },
]

export function getAvailableSections(usageMode: 'basic' | 'professional') {
  return GENERAL_BALANCE_SECTIONS.filter((section) => section.modes.includes(usageMode))
}

/** Secciones que activa cada nivel predefinido (el nivel 1 es solo el resumen). */
export function getSectionsForLevel(
  level: 1 | 2 | 3 | 4,
  usageMode: 'basic' | 'professional',
): GeneralBalanceSectionId[] {
  return getAvailableSections(usageMode)
    .filter((section) => section.level <= level)
    .map((section) => section.id)
}

export interface GeneralBalanceInput {
  readonly incomes: readonly ServiceIncome[]
  readonly expenses: readonly Expense[]
  readonly transfers: readonly InternalTransfer[]
  readonly wallets: readonly Wallet[]
  readonly seasons: readonly EarningPeriod[]
  readonly personalIncomeCategories: readonly PersonalIncomeCategory[]
  readonly personalExpenseCategories: readonly PersonalExpenseCategory[]
  readonly currency: CurrencyCode
  readonly usageMode: 'basic' | 'professional'
  /** Inicio del periodo (YYYY-MM-DD, inclusive). `null` = todo el historial. */
  readonly from: string | null
  /** Fecha de corte (YYYY-MM-DD, inclusive). */
  readonly to: string
}

export interface BalanceTotals {
  readonly principalIncome: number
  readonly additionalIncome: number
  readonly totalReceived: number
  readonly expenses: number
  readonly adjustmentsPositive: number
  readonly adjustmentsNegative: number
  readonly adjustmentImpact: number
  readonly activityResult: number
  readonly balance: number
}

export interface GroupedAmount {
  readonly key: string
  readonly label: string
  readonly count: number
  readonly total: number
}

export interface SeasonBalanceRow {
  readonly seasonId: number | null
  readonly name: string
  readonly status: 'active' | 'closed' | null
  readonly totals: BalanceTotals
  readonly goal: number | null
  readonly goalResult: number | null
  readonly goalPercentage: number | null
}

export interface ReportStatusRow {
  readonly code: ReportStatusCode
  readonly label: string
  readonly incomeCount: number
  readonly incomeTotal: number
  readonly expenseCount: number
  readonly expenseTotal: number
}

export interface GeneralBalanceMovement {
  readonly kind: 'income' | 'expense' | 'adjustment'
  readonly origin: 'income' | 'expense'
  readonly id?: number
  readonly date: string
  readonly label: string
  /** Importe con signo según su efecto en el balance. */
  readonly amount: number
  readonly categoryKey: string
  readonly categoryLabel: string
  readonly walletId?: string
  readonly walletName?: string
  readonly paymentTypeLabel?: string
  readonly locationLabel: string
  readonly seasonId: number | null
  readonly seasonName?: string
  readonly reportStatusLabel: string
  readonly notes?: string
}

export interface GeneralBalanceTransfer {
  readonly id: string
  readonly date: string
  readonly fromWalletId: string
  readonly fromWalletName: string
  readonly toWalletId: string
  readonly toWalletName: string
  readonly amount: number
  readonly currency: string
  readonly notes?: string
}

export interface FacetOption {
  readonly key: string
  readonly label: string
  readonly count: number
}

export interface GeneralBalanceFacets {
  readonly categories: readonly (FacetOption & { readonly origin: 'income' | 'expense' })[]
  readonly wallets: readonly FacetOption[]
  readonly seasons: readonly FacetOption[]
}

export interface WalletReconciliation {
  readonly walletsTotal: number
  readonly generalClosing: number
  readonly unassignedDifference: number
  readonly hasCurrencyMismatchTransfers: boolean
}

export interface GeneralBalanceResult {
  readonly currency: CurrencyCode
  readonly usageMode: 'basic' | 'professional'
  readonly from: string | null
  readonly to: string
  readonly opening: BalanceTotals
  readonly period: BalanceTotals
  readonly closing: BalanceTotals
  readonly hasData: boolean
  readonly incomeCount: number
  readonly expenseCount: number
  readonly adjustmentCount: number
  readonly incomesByType: readonly GroupedAmount[]
  readonly incomesByPaymentType: readonly GroupedAmount[]
  readonly incomesByCategory: readonly GroupedAmount[]
  readonly incomesByLocation: readonly GroupedAmount[]
  readonly expensesByCategory: readonly GroupedAmount[]
  readonly expensesByLocation: readonly GroupedAmount[]
  readonly seasons: readonly SeasonBalanceRow[]
  readonly wallets: WalletReportModel | null
  readonly walletReconciliation: WalletReconciliation | null
  readonly reportStatus: readonly ReportStatusRow[]
  readonly activity: {
    readonly serviceCount: number
    readonly scheduledMinutes: number
    readonly actualMinutes: number
  }
  readonly adjustments: readonly BalanceAdjustmentRecord[]
  readonly movements: readonly GeneralBalanceMovement[]
  /** Transferencias internas del periodo (solo Personal). Nunca afectan al balance. */
  readonly transfers: readonly GeneralBalanceTransfer[]
  readonly facets: GeneralBalanceFacets
}

export class GeneralBalanceIntegrityError extends Error {}

function toTotals(report: BalanceReportResult): BalanceTotals {
  const principalIncome = roundMoney(report.netProfit + report.expenseTotal)
  return {
    principalIncome,
    additionalIncome: roundMoney(report.incomeGrossTotal - principalIncome),
    totalReceived: report.incomeGrossTotal,
    expenses: report.expenseTotal,
    adjustmentsPositive: report.adjustmentsPositiveTotal,
    adjustmentsNegative: report.adjustmentsNegativeTotal,
    adjustmentImpact: report.adjustmentImpactTotal,
    activityResult: report.netProfit,
    balance: report.generalBalance,
  }
}

const EMPTY_TOTALS: BalanceTotals = {
  principalIncome: 0,
  additionalIncome: 0,
  totalReceived: 0,
  expenses: 0,
  adjustmentsPositive: 0,
  adjustmentsNegative: 0,
  adjustmentImpact: 0,
  activityResult: 0,
  balance: 0,
}

function civilDate(date: string | undefined) {
  return (date ?? '').slice(0, 10)
}

function groupAmounts<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
  labelOf: (key: string, item: T) => string,
  valueOf: (item: T) => number,
): GroupedAmount[] {
  const map = new Map<string, { key: string; label: string; count: number; total: number }>()
  for (const item of items) {
    const key = keyOf(item)
    const current = map.get(key) ?? { key, label: labelOf(key, item), count: 0, total: 0 }
    current.count += 1
    current.total = roundMoney(current.total + valueOf(item))
    map.set(key, current)
  }
  return Array.from(map.values()).sort(
    (left, right) => right.total - left.total || left.label.localeCompare(right.label, 'es'),
  )
}

function countryLabel(code: string) {
  return countries.find((country) => country.value === code)?.label ?? code
}

function locationKey(record: { country?: string; city?: string }) {
  return `${record.country ?? ''}|${record.city ?? ''}`
}

function locationLabel(key: string) {
  const [country, city] = key.split('|')
  if (!country && !city) return 'Sin ubicación'
  return [country ? countryLabel(country) : 'Sin país', city || 'Sin ciudad'].join(' · ')
}

function seasonKey(record: { earningPeriodId?: number; seasonPeriodId?: number }) {
  return record.earningPeriodId ?? record.seasonPeriodId ?? null
}

/** Clave estable de categoría para agrupar y filtrar (ingresos y egresos por separado). */
export const NO_WALLET_KEY = '__none__'

function incomeCategory(
  income: ServiceIncome,
  usageMode: 'basic' | 'professional',
  names: ReadonlyMap<string, string>,
): { key: string; label: string } {
  if (isAdjustmentIncome(income)) return { key: 'in:adjustment', label: 'Ajuste' }
  if (usageMode === 'basic') {
    const id = income.personalCategoryId
    return { key: `in:personal:${id ?? ''}`, label: id ? names.get(id) ?? 'Categoría eliminada' : 'Sin categoría' }
  }
  const type = getIncomeType(income)
  return { key: `in:type:${type}`, label: getIncomeTypeLabel(income) }
}

function expenseCategory(
  expense: Expense,
  usageMode: 'basic' | 'professional',
  names: ReadonlyMap<string, string>,
): { key: string; label: string } {
  if (expense.type === 'ajuste') return { key: 'ex:adjustment', label: 'Ajuste' }
  if (usageMode === 'basic' && expense.personalCategoryId) {
    return {
      key: `ex:personal:${expense.personalCategoryId}`,
      label: names.get(expense.personalCategoryId) ?? 'Categoría eliminada',
    }
  }
  return { key: `ex:category:${expense.category || ''}`, label: expense.category || 'Sin categoría' }
}

function facetList<T>(items: readonly T[], keyOf: (item: T) => string, labelOf: (item: T) => string) {
  const map = new Map<string, { key: string; label: string; count: number }>()
  for (const item of items) {
    const key = keyOf(item)
    const current = map.get(key) ?? { key, label: labelOf(item), count: 0 }
    current.count += 1
    map.set(key, current)
  }
  return Array.from(map.values()).sort((left, right) => left.label.localeCompare(right.label, 'es'))
}

export function buildGeneralBalance(input: GeneralBalanceInput): GeneralBalanceResult {
  const { currency, usageMode, from, to } = input

  if (!isValidCutoff(to) || (from !== null && !isValidCutoff(from))) {
    throw new GeneralBalanceIntegrityError('INVALID_GENERAL_BALANCE_RANGE')
  }
  if (from !== null && from > to) {
    throw new GeneralBalanceIntegrityError('GENERAL_BALANCE_FROM_AFTER_TO')
  }

  // Mismo ámbito que el motor: modo activo y registros con temporada coherente.
  const inScope = (record: ServiceIncome | Expense) =>
    recordBelongsToUsageMode(record, usageMode) && recordBelongsToEarningPeriod(record, undefined)

  const incomes = input.incomes.filter(inScope).filter((income) => civilDate(income.date) <= to)
  const expenses = input.expenses.filter(inScope).filter((expense) => civilDate(expense.date) <= to)

  const isBefore = (date: string) => from !== null && civilDate(date) < from
  const incomesBefore = incomes.filter((income) => isBefore(income.date))
  const expensesBefore = expenses.filter((expense) => isBefore(expense.date))
  const periodIncomes = incomes.filter((income) => !isBefore(income.date))
  const periodExpenses = expenses.filter((expense) => !isBefore(expense.date))

  const run = (incomeList: readonly ServiceIncome[], expenseList: readonly Expense[]) =>
    runFinancialEngine({ incomes: incomeList, expenses: expenseList, currency, usageMode })

  const openingEngine = from === null ? null : run(incomesBefore, expensesBefore)
  const periodEngine = run(periodIncomes, periodExpenses)
  const closingEngine = run(incomes, expenses)

  const opening = openingEngine ? toTotals(openingEngine.balanceReport) : EMPTY_TOTALS
  const period = toTotals(periodEngine.balanceReport)
  const closing = toTotals(closingEngine.balanceReport)

  // Fail-closed: saldo inicial + periodo debe ser exactamente el saldo final.
  if (roundMoney(opening.balance + period.balance) !== closing.balance) {
    throw new GeneralBalanceIntegrityError('GENERAL_BALANCE_ROLLFORWARD_MISMATCH')
  }

  const periodIncomesNoAdj = periodIncomes.filter((income) => !isAdjustmentIncome(income))
  const periodExpensesNoAdj = periodExpenses.filter((expense) => expense.type !== 'ajuste')
  const incomeValue = (income: ServiceIncome) => roundMoney(getStoredIncomeValue(income, currency))
  const expenseValue = (expense: Expense) => roundMoney(getStoredExpenseValue(expense, currency))

  const incomeCategoryName = new Map(input.personalIncomeCategories.map((category) => [category.id, category.name]))
  const expenseCategoryName = new Map(input.personalExpenseCategories.map((category) => [category.id, category.name]))

  const incomesByType = periodEngine.balanceReport.incomesByType
    .filter((row) => row.type !== 'ajuste')
    .map((row) => ({ key: row.type, label: row.label, count: row.count, total: row.total }))

  const incomesByPaymentType = groupAmounts(
    periodIncomesNoAdj,
    (income) => income.paymentType ?? '',
    (key) => getPaymentTypeLabel(key || undefined),
    incomeValue,
  )

  const incomesByCategory = usageMode === 'basic'
    ? groupAmounts(
        periodIncomesNoAdj,
        (income) => income.personalCategoryId ?? '',
        (key) => (key ? incomeCategoryName.get(key) ?? 'Categoría eliminada' : 'Sin categoría'),
        incomeValue,
      )
    : []

  const incomesByLocation = groupAmounts(periodIncomesNoAdj, locationKey, locationLabel, incomeValue)

  const expensesByCategory = groupAmounts(
    periodExpensesNoAdj,
    (expense) =>
      usageMode === 'basic' && expense.personalCategoryId
        ? `personal:${expense.personalCategoryId}`
        : `category:${expense.category || ''}`,
    (key) => {
      if (key.startsWith('personal:')) {
        return expenseCategoryName.get(key.slice('personal:'.length)) ?? 'Categoría eliminada'
      }
      return key.slice('category:'.length) || 'Sin categoría'
    },
    expenseValue,
  )

  const expensesByLocation = groupAmounts(periodExpensesNoAdj, locationKey, locationLabel, expenseValue)

  // Temporadas (Profesional): reparte el periodo por temporada.
  let seasons: SeasonBalanceRow[] = []
  if (usageMode === 'professional') {
    const seasonById = new Map(
      input.seasons.filter((season) => season.id !== undefined).map((season) => [season.id as number, season]),
    )
    const keys = new Set<number | null>()
    for (const record of [...periodIncomes, ...periodExpenses]) keys.add(seasonKey(record))

    seasons = Array.from(keys).map((key) => {
      const seasonIncomes = periodIncomes.filter((income) => seasonKey(income) === key)
      const seasonExpenses = periodExpenses.filter((expense) => seasonKey(expense) === key)
      const totals = toTotals(run(seasonIncomes, seasonExpenses).balanceReport)
      const season = key === null ? undefined : seasonById.get(key)
      let goal: number | null = null
      let goalResult: number | null = null
      let goalPercentage: number | null = null
      if (season && key !== null) {
        const progress = getSeasonGoalProgress(
          season,
          calculateSeasonFinancialResult({
            incomes: incomes.filter((income) => seasonKey(income) === key),
            expenses: expenses.filter((expense) => seasonKey(expense) === key),
            currency,
            usageMode,
            earningPeriodId: key,
          }),
        )
        if (progress) {
          goal = progress.goal
          goalResult = roundMoney(progress.result)
          goalPercentage = Math.round(progress.percentage * 10) / 10
        }
      }
      return {
        seasonId: key,
        name: key === null ? 'Sin temporada' : season?.name ?? `Temporada #${key}`,
        status: season?.status ?? null,
        totals,
        goal,
        goalResult,
        goalPercentage,
      }
    }).sort((left, right) => {
      if (left.seasonId === null) return 1
      if (right.seasonId === null) return -1
      const leftStart = seasonById.get(left.seasonId)?.startDate ?? ''
      const rightStart = seasonById.get(right.seasonId)?.startDate ?? ''
      return rightStart.localeCompare(leftStart)
    })

    const seasonsSum = roundMoney(seasons.reduce((sum, row) => sum + row.totals.balance, 0))
    if (seasonsSum !== period.balance) {
      throw new GeneralBalanceIntegrityError('GENERAL_BALANCE_SEASONS_MISMATCH')
    }
  }

  // Wallets (Personal): reutiliza el modelo oficial del reporte de wallets.
  let wallets: WalletReportModel | null = null
  let walletReconciliation: WalletReconciliation | null = null
  if (usageMode === 'basic' && input.wallets.length > 0) {
    wallets = buildWalletReportModel({
      currency,
      period: { start: from ?? '0000-01-01', end: to },
      wallets: input.wallets,
      incomes,
      expenses,
      transfers: input.transfers.filter((transfer) => civilDate(transfer.date) <= to),
    })
    walletReconciliation = {
      walletsTotal: wallets.totalAvailable,
      generalClosing: closing.balance,
      unassignedDifference: roundMoney(closing.balance - wallets.totalAvailable),
      hasCurrencyMismatchTransfers: wallets.hasCurrencyMismatchTransfers,
    }
  }

  // Estado de reporte (ingresos y egresos sin ajustes del periodo).
  const statusCodes: ReportStatusCode[] = ['reported', 'pending', 'unreviewed']
  const reportStatus: ReportStatusRow[] = statusCodes.map((code) => {
    const statusIncomes = periodIncomesNoAdj.filter((income) => normalizeReportStatus(income).reportStatusCode === code)
    const statusExpenses = periodExpensesNoAdj.filter((expense) => normalizeReportStatus(expense).reportStatusCode === code)
    return {
      code,
      label: getReportStatusLabel(code),
      incomeCount: statusIncomes.length,
      incomeTotal: roundMoney(statusIncomes.reduce((sum, income) => sum + incomeValue(income), 0)),
      expenseCount: statusExpenses.length,
      expenseTotal: roundMoney(statusExpenses.reduce((sum, expense) => sum + expenseValue(expense), 0)),
    }
  })

  const walletNameById = new Map(input.wallets.map((item) => [item.id, item.name]))
  const seasonNameById = new Map(
    input.seasons.filter((season) => season.id !== undefined).map((season) => [season.id as number, season.name]),
  )
  const walletFields = (record: { walletId?: string }) =>
    usageMode === 'basic'
      ? {
          walletId: record.walletId ?? NO_WALLET_KEY,
          walletName: record.walletId ? walletNameById.get(record.walletId) ?? 'Wallet eliminada' : 'Sin wallet',
        }
      : {}
  const seasonFields = (record: { earningPeriodId?: number; seasonPeriodId?: number }) => {
    const seasonId = usageMode === 'professional' ? seasonKey(record) : null
    return {
      seasonId,
      seasonName: usageMode !== 'professional'
        ? undefined
        : seasonId === null ? 'Sin temporada' : seasonNameById.get(seasonId) ?? `Temporada #${seasonId}`,
    }
  }
  const cleanNotes = (notes?: string) => notes?.trim() || undefined

  const movements: GeneralBalanceMovement[] = [
    ...periodIncomes.map((income): GeneralBalanceMovement => {
      const category = incomeCategory(income, usageMode, incomeCategoryName)
      const adjustment = isAdjustmentIncome(income)
      return {
        kind: adjustment ? 'adjustment' : 'income',
        origin: 'income',
        id: income.id,
        date: civilDate(income.date),
        label: getIncomeDisplayName(income),
        amount: incomeValue(income),
        categoryKey: category.key,
        categoryLabel: category.label,
        ...walletFields(income),
        paymentTypeLabel: adjustment ? undefined : getPaymentTypeLabel(income.paymentType),
        locationLabel: locationLabel(locationKey(income)),
        ...seasonFields(income),
        reportStatusLabel: getReportStatusLabel(normalizeReportStatus(income).reportStatusCode),
        notes: cleanNotes(income.notes),
      }
    }),
    ...periodExpenses.map((expense): GeneralBalanceMovement => {
      const category = expenseCategory(expense, usageMode, expenseCategoryName)
      const adjustment = expense.type === 'ajuste'
      return {
        kind: adjustment ? 'adjustment' : 'expense',
        origin: 'expense',
        id: expense.id,
        date: civilDate(expense.date),
        label: getExpenseDisplayName(expense),
        amount: adjustment ? expenseValue(expense) : -expenseValue(expense),
        categoryKey: category.key,
        categoryLabel: category.label,
        ...walletFields(expense),
        locationLabel: locationLabel(locationKey(expense)),
        ...seasonFields(expense),
        reportStatusLabel: getReportStatusLabel(normalizeReportStatus(expense).reportStatusCode),
        notes: cleanNotes(expense.notes),
      }
    }),
  ].sort((left, right) => right.date.localeCompare(left.date) || (right.id ?? 0) - (left.id ?? 0))

  const transfers: GeneralBalanceTransfer[] = usageMode !== 'basic'
    ? []
    : input.transfers
        .filter((transfer) => civilDate(transfer.date) <= to && !isBefore(transfer.date))
        .map((transfer) => ({
          id: transfer.id,
          date: civilDate(transfer.date),
          fromWalletId: transfer.fromWalletId,
          fromWalletName: walletNameById.get(transfer.fromWalletId) ?? 'Wallet eliminada',
          toWalletId: transfer.toWalletId,
          toWalletName: walletNameById.get(transfer.toWalletId) ?? 'Wallet eliminada',
          amount: roundMoney(transfer.amount),
          currency: transfer.currency,
          notes: cleanNotes(transfer.note),
        }))
        .sort((left, right) => right.date.localeCompare(left.date))

  const facets: GeneralBalanceFacets = {
    categories: facetList(movements, (movement) => movement.categoryKey, (movement) => movement.categoryLabel)
      .map((facet) => ({ ...facet, origin: facet.key.startsWith('in:') ? 'income' as const : 'expense' as const })),
    wallets: usageMode === 'basic'
      ? facetList(movements, (movement) => movement.walletId ?? NO_WALLET_KEY, (movement) => movement.walletName ?? 'Sin wallet')
      : [],
    seasons: usageMode === 'professional'
      ? facetList(movements, (movement) => String(movement.seasonId ?? 'none'), (movement) => movement.seasonName ?? 'Sin temporada')
      : [],
  }

  return {
    currency,
    usageMode,
    from,
    to,
    opening,
    period,
    closing,
    hasData: periodEngine.balanceReport.hasData || (openingEngine?.balanceReport.hasData ?? false),
    incomeCount: periodEngine.incomeCount,
    expenseCount: periodEngine.expenseCount,
    adjustmentCount: periodEngine.adjustmentCount,
    incomesByType,
    incomesByPaymentType,
    incomesByCategory,
    incomesByLocation,
    expensesByCategory,
    expensesByLocation,
    seasons,
    wallets,
    walletReconciliation,
    reportStatus,
    activity: {
      serviceCount: periodIncomesNoAdj.length,
      scheduledMinutes: periodEngine.scheduledMinutes,
      actualMinutes: periodEngine.actualMinutes,
    },
    adjustments: periodEngine.balanceReport.adjustments,
    movements,
    transfers,
    facets,
  }
}
