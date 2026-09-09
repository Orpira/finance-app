import type { CurrencyCode } from '../types/settings'
import type { Wallet } from '../types/wallet'
import type { ServiceIncome } from '../types/service'
import type { Expense } from '../types/expense'
import type { InternalTransfer } from '../types/internalTransfer'
import { buildBalanceReport, type BalanceAdjustmentRecord } from './balanceReportService'
import { getStoredExpenseValue, getStoredIncomePrincipalValue, getStoredIncomeValue } from '../utils/financeStats'
import { getExpenseDisplayName, getIncomeDisplayName } from '../utils/activityLabels'
import { isAdjustmentIncome } from '../utils/incomeTypes'
import { roundMoney } from '../utils/currency'

/**
 * Read-only Wallet report model (ADR-037): separates "external income"
 * (new money entering the patrimony) from "transfer received" (money that
 * already belonged to the user, just changed Wallet) — and symmetrically
 * "expense" from "transfer sent". A transfer never appears as an income or
 * expense; it only explains how money moved between Wallets. This is the
 * single source of truth shared by the report's preview, PDF and share
 * flows — never recompute a Wallet balance independently of this model.
 */

export interface WalletReportPeriod {
  readonly start: string
  readonly end: string
}

export interface WalletIncomeReportItem {
  readonly id?: number
  readonly date: string
  readonly label: string
  readonly principal: number
  readonly additional: number
  readonly total: number
  readonly note?: string
}

export interface WalletExpenseReportItem {
  readonly id?: number
  readonly date: string
  readonly label: string
  readonly category: string
  readonly amount: number
  readonly note?: string
}

export interface WalletTransferReportItem {
  readonly id: string
  readonly date: string
  readonly createdAt: string
  readonly fromWalletId: string
  readonly fromWalletName: string
  readonly toWalletId: string
  readonly toWalletName: string
  readonly amount: number
  readonly note?: string
}

export interface WalletReportSection {
  readonly walletId: string
  readonly walletName: string
  readonly isDefault: boolean
  readonly isArchived: boolean

  readonly openingBalance: number
  readonly externalIncomeTotal: number
  readonly transferReceivedTotal: number
  readonly expenseTotal: number
  readonly transferSentTotal: number
  readonly adjustmentTotal: number
  readonly closingBalance: number

  /** True when this Wallet has transfers outside `currency` that could not
   * be included (InternalTransfer keeps no historical multi-currency
   * valuation) — surfaced so the report never silently treats them as 0. */
  readonly hasCurrencyMismatchTransfers: boolean

  readonly externalIncomes: readonly WalletIncomeReportItem[]
  readonly expenses: readonly WalletExpenseReportItem[]
  readonly adjustments: readonly BalanceAdjustmentRecord[]
  readonly receivedTransfers: readonly WalletTransferReportItem[]
  readonly sentTransfers: readonly WalletTransferReportItem[]
}

export interface WalletReportModel {
  readonly currency: CurrencyCode
  readonly period: WalletReportPeriod | null
  readonly totalAvailable: number
  readonly transferCount: number
  readonly totalMoved: number
  readonly hasCurrencyMismatchTransfers: boolean
  readonly wallets: readonly WalletReportSection[]
}

export interface BuildWalletReportModelInput {
  readonly currency: CurrencyCode
  /** `null` = whole history: opening balance is always 0 (spec §9 — never
   * inferred from the current balance, never invented). */
  readonly period: WalletReportPeriod | null
  readonly wallets: readonly Wallet[]
  /** ALL incomes (no date filter), already scoped to `usageMode: 'basic'`. */
  readonly incomes: readonly ServiceIncome[]
  /** ALL expenses (no date filter), already scoped to `usageMode: 'basic'`. */
  readonly expenses: readonly Expense[]
  /** ALL internal transfers (no date filter); `listInternalTransfers()` already scopes to `usageMode: 'basic'`. */
  readonly transfers: readonly InternalTransfer[]
}

export class WalletReportIntegrityError extends Error {}

function isBeforePeriod(date: string, period: WalletReportPeriod | null): boolean {
  return period !== null && date < period.start
}

function isWithinPeriod(date: string, period: WalletReportPeriod | null): boolean {
  if (period === null) return true
  return date >= period.start && date <= period.end
}

function sumAmount(transfers: readonly InternalTransfer[]): number {
  return roundMoney(transfers.reduce((sum, transfer) => sum + transfer.amount, 0))
}

function sortMovements<T extends { date: string; createdAt?: string; id?: string | number }>(
  items: readonly T[],
): T[] {
  return [...items].sort((left, right) =>
    left.date.localeCompare(right.date) ||
    (left.createdAt ?? '').localeCompare(right.createdAt ?? '') ||
    String(left.id ?? '').localeCompare(String(right.id ?? '')),
  )
}

function buildIncomeItem(income: ServiceIncome, currency: CurrencyCode): WalletIncomeReportItem {
  const total = roundMoney(getStoredIncomeValue(income, currency))
  const principal = roundMoney(getStoredIncomePrincipalValue(income, currency))
  return {
    id: income.id,
    date: income.date,
    label: getIncomeDisplayName(income),
    principal,
    additional: roundMoney(total - principal),
    total,
    note: income.notes,
  }
}

function buildExpenseItem(expense: Expense, currency: CurrencyCode): WalletExpenseReportItem {
  return {
    id: expense.id,
    date: expense.date,
    label: getExpenseDisplayName(expense),
    category: expense.category,
    amount: roundMoney(getStoredExpenseValue(expense, currency)),
    note: expense.notes,
  }
}

function buildTransferItem(
  transfer: InternalTransfer,
  walletNameById: ReadonlyMap<string, string>,
): WalletTransferReportItem {
  const fromWalletName = walletNameById.get(transfer.fromWalletId)
  const toWalletName = walletNameById.get(transfer.toWalletId)
  if (fromWalletName === undefined || toWalletName === undefined) {
    throw new WalletReportIntegrityError(
      `La transferencia ${transfer.id} referencia una wallet que no existe (${transfer.fromWalletId} → ${transfer.toWalletId}).`,
    )
  }
  return {
    id: transfer.id,
    date: transfer.date,
    createdAt: transfer.createdAt,
    fromWalletId: transfer.fromWalletId,
    fromWalletName,
    toWalletId: transfer.toWalletId,
    toWalletName,
    amount: transfer.amount,
    note: transfer.note,
  }
}

function buildWalletSection(
  wallet: Wallet,
  input: Pick<BuildWalletReportModelInput, 'currency' | 'period'>,
  walletIncomes: readonly ServiceIncome[],
  walletExpenses: readonly Expense[],
  walletTransfersIn: readonly InternalTransfer[],
  walletTransfersOut: readonly InternalTransfer[],
  walletNameById: ReadonlyMap<string, string>,
): WalletReportSection {
  const { currency, period } = input

  const incomesBefore = walletIncomes.filter((income) => isBeforePeriod(income.date, period))
  const incomesWithin = walletIncomes.filter((income) => isWithinPeriod(income.date, period))
  const expensesBefore = walletExpenses.filter((expense) => isBeforePeriod(expense.date, period))
  const expensesWithin = walletExpenses.filter((expense) => isWithinPeriod(expense.date, period))

  const transfersInSameCurrency = walletTransfersIn.filter((transfer) => transfer.currency === currency)
  const transfersOutSameCurrency = walletTransfersOut.filter((transfer) => transfer.currency === currency)
  const hasCurrencyMismatchTransfers =
    walletTransfersIn.some((transfer) => transfer.currency !== currency) ||
    walletTransfersOut.some((transfer) => transfer.currency !== currency)

  const transfersInBefore = transfersInSameCurrency.filter((transfer) => isBeforePeriod(transfer.date, period))
  const transfersInWithin = transfersInSameCurrency.filter((transfer) => isWithinPeriod(transfer.date, period))
  const transfersOutBefore = transfersOutSameCurrency.filter((transfer) => isBeforePeriod(transfer.date, period))
  const transfersOutWithin = transfersOutSameCurrency.filter((transfer) => isWithinPeriod(transfer.date, period))

  const openingReport = buildBalanceReport({ incomes: incomesBefore, expenses: expensesBefore, currency })
  const openingBalance = roundMoney(
    openingReport.incomeGrossTotal -
      openingReport.expenseTotal +
      openingReport.adjustmentImpactTotal +
      sumAmount(transfersInBefore) -
      sumAmount(transfersOutBefore),
  )

  const periodReport = buildBalanceReport({ incomes: incomesWithin, expenses: expensesWithin, currency })
  const transferReceivedTotal = sumAmount(transfersInWithin)
  const transferSentTotal = sumAmount(transfersOutWithin)

  const closingBalance = roundMoney(
    openingBalance +
      periodReport.incomeGrossTotal +
      transferReceivedTotal -
      periodReport.expenseTotal -
      transferSentTotal +
      periodReport.adjustmentImpactTotal,
  )

  const externalIncomes = sortMovements(
    incomesWithin.filter((income) => !isAdjustmentIncome(income)),
  ).map((income) => buildIncomeItem(income, currency))
  const expenseItems = sortMovements(
    expensesWithin.filter((expense) => expense.type !== 'ajuste'),
  ).map((expense) => buildExpenseItem(expense, currency))
  const receivedTransfers = sortMovements(transfersInWithin).map((transfer) => buildTransferItem(transfer, walletNameById))
  const sentTransfers = sortMovements(transfersOutWithin).map((transfer) => buildTransferItem(transfer, walletNameById))

  return {
    walletId: wallet.id,
    walletName: wallet.name,
    isDefault: wallet.isDefault,
    isArchived: wallet.isArchived,
    openingBalance,
    externalIncomeTotal: periodReport.incomeGrossTotal,
    transferReceivedTotal,
    expenseTotal: periodReport.expenseTotal,
    transferSentTotal,
    adjustmentTotal: periodReport.adjustmentImpactTotal,
    closingBalance,
    hasCurrencyMismatchTransfers,
    externalIncomes,
    expenses: expenseItems,
    adjustments: periodReport.adjustments,
    receivedTransfers,
    sentTransfers,
  }
}

export function buildWalletReportModel(input: BuildWalletReportModelInput): WalletReportModel {
  const invalidWallet = input.wallets.find((wallet) => wallet.usageMode !== 'basic')
  if (invalidWallet !== undefined) {
    throw new WalletReportIntegrityError(`La wallet ${invalidWallet.id} no pertenece al espacio Personal.`)
  }

  const walletNameById = new Map(input.wallets.map((wallet) => [wallet.id, wallet.name]))

  const incomesByWallet = new Map<string, ServiceIncome[]>()
  for (const income of input.incomes) {
    if (income.walletId === undefined) continue
    const list = incomesByWallet.get(income.walletId) ?? []
    list.push(income)
    incomesByWallet.set(income.walletId, list)
  }
  const expensesByWallet = new Map<string, Expense[]>()
  for (const expense of input.expenses) {
    if (expense.walletId === undefined) continue
    const list = expensesByWallet.get(expense.walletId) ?? []
    list.push(expense)
    expensesByWallet.set(expense.walletId, list)
  }
  const transfersInByWallet = new Map<string, InternalTransfer[]>()
  const transfersOutByWallet = new Map<string, InternalTransfer[]>()
  for (const transfer of input.transfers) {
    const inList = transfersInByWallet.get(transfer.toWalletId) ?? []
    inList.push(transfer)
    transfersInByWallet.set(transfer.toWalletId, inList)
    const outList = transfersOutByWallet.get(transfer.fromWalletId) ?? []
    outList.push(transfer)
    transfersOutByWallet.set(transfer.fromWalletId, outList)
  }

  const allSections = input.wallets.map((wallet) =>
    buildWalletSection(
      wallet,
      { currency: input.currency, period: input.period },
      incomesByWallet.get(wallet.id) ?? [],
      expensesByWallet.get(wallet.id) ?? [],
      transfersInByWallet.get(wallet.id) ?? [],
      transfersOutByWallet.get(wallet.id) ?? [],
      walletNameById,
    ),
  )

  // Archived Wallets stay in the report while they carry a balance or had
  // activity in the period — a historical report must never drop them
  // (spec §27) — but disappear once both are exhausted, to keep an empty
  // "all-time" report from listing every long-closed envelope.
  const wallets = allSections
    .filter((section) =>
      !section.isArchived ||
      section.closingBalance !== 0 ||
      section.externalIncomes.length > 0 ||
      section.expenses.length > 0 ||
      section.receivedTransfers.length > 0 ||
      section.sentTransfers.length > 0 ||
      section.adjustments.length > 0,
    )
    .sort((left, right) => left.walletName.localeCompare(right.walletName, 'es'))

  const periodTransfers = input.transfers.filter((transfer) => isWithinPeriod(transfer.date, input.period))
  const periodTransfersSameCurrency = periodTransfers.filter((transfer) => transfer.currency === input.currency)

  return {
    currency: input.currency,
    period: input.period,
    totalAvailable: roundMoney(wallets.reduce((sum, section) => sum + section.closingBalance, 0)),
    transferCount: periodTransfers.length,
    totalMoved: sumAmount(periodTransfersSameCurrency),
    hasCurrencyMismatchTransfers: periodTransfers.length > periodTransfersSameCurrency.length,
    wallets,
  }
}
